"""Extração do histórico horário de clima das capitais (API Open-Meteo).

Fonte: `archive-api.open-meteo.com` — reanálise ERA5, gratuita, sem chave e
documentada. Cada requisição traz um ano de uma capital em resolução
horária (8.760 linhas), e o resultado é gravado em Parquet particionado
por capital e ano.

Duas decisões que valem explicação:

- **Horário, não diário.** A API entrega média diária pronta, mas puxar o
  dado horário deixa a agregação (mínima, máxima, média, amplitude) na
  camada de transformação, onde ela é testável e versionada — e é o que
  permite responder "que horas faz mais calor em Cuiabá?".
- **Particionar por capital/ano.** Ano fechado nunca muda: reprocessar
  2021 não deve tocar em 2020, e uma extração interrompida na metade é
  retomada sem refazer o que já baixou.
"""
from __future__ import annotations

import argparse
import calendar
import logging
import os
from pathlib import Path

import pandas as pd
import requests
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
VARIAVEIS = ["temperature_2m", "relative_humidity_2m", "precipitation"]

COLUNAS = {
    "time": "hora_local",
    "temperature_2m": "temperatura_c",
    "relative_humidity_2m": "umidade_pct",
    "precipitation": "precipitacao_mm",
}


def horas_do_ano(ano: int) -> int:
    """8.760 horas, ou 8.784 em ano bissexto."""
    return 366 * 24 if calendar.isleap(ano) else 365 * 24


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=2, min=2, max=30), reraise=True)
def fetch_ano_raw(latitude: float, longitude: float, ano: int, fuso: str) -> dict:
    """Busca um ano de dados horários de um ponto.

    O fuso vai na requisição para que a API devolva hora local: o dado é
    lido como "que horas eram naquela cidade", não em UTC — senão o dia
    do heatmap ficaria deslocado nas capitais do Acre e do Amazonas.

    A resposta é conferida contra o que foi pedido. A Open-Meteo responde
    HTTP 200 mesmo quando ignora o que não entendeu: fuso inválido vira GMT
    e a coordenada é "encaixada" na célula de grade mais próxima. Sem essa
    checagem, um erro de sinal na longitude traria o clima de outro lugar
    sem nenhum sintoma.
    """
    resposta = requests.get(
        ARCHIVE_URL,
        params={
            "latitude": latitude,
            "longitude": longitude,
            "start_date": f"{ano}-01-01",
            "end_date": f"{ano}-12-31",
            "hourly": ",".join(VARIAVEIS),
            "timezone": fuso,
        },
        timeout=120,
    )
    resposta.raise_for_status()
    raw = resposta.json()

    if raw.get("timezone") != fuso:
        raise ValueError(f"API respondeu no fuso {raw.get('timezone')!r}, esperado {fuso!r}")

    distancia = max(abs(raw.get("latitude", 0) - latitude), abs(raw.get("longitude", 0) - longitude))
    if distancia > 0.5:
        raise ValueError(
            f"API devolveu ponto ({raw.get('latitude')}, {raw.get('longitude')}), "
            f"longe do pedido ({latitude}, {longitude})"
        )
    return raw


def parse_ano(raw: dict, capital_id: str) -> pd.DataFrame:
    """Converte o formato colunar da API (listas paralelas) em linhas.

    A API responde `{"hourly": {"time": [...], "temperature_2m": [...]}}`,
    e não uma lista de registros — as listas são paralelas e alinhadas por
    posição. Horas sem medição vêm como `null` e viram NaN, não zero:
    "não mediu" é diferente de "choveu 0 mm".
    """
    horario = raw["hourly"]
    df = pd.DataFrame({destino: horario[origem] for origem, destino in COLUNAS.items()})
    df["hora_local"] = pd.to_datetime(df["hora_local"])
    df.insert(0, "capital_id", capital_id)
    return df


def caminho_particao(capital_id: str, ano: int, raw_dir: Path | None = None) -> Path:
    base = (raw_dir or config.raw_dir) / "open_meteo" / f"capital={capital_id}" / f"ano={ano}"
    return base / "clima.parquet"


def salvar_particao(df: pd.DataFrame, capital_id: str, ano: int, raw_dir: Path | None = None) -> Path:
    """Grava a partição de forma atômica.

    Escrever direto no destino final deixava, ao interromper no meio, um
    Parquet sem rodapé — e como `run()` pula partição que já existe, o arquivo
    quebrado ficava lá para sempre, estourando só depois, no load.
    """
    caminho = caminho_particao(capital_id, ano, raw_dir)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    provisorio = caminho.with_suffix(".parquet.tmp")
    df.to_parquet(provisorio, index=False, compression="zstd")
    os.replace(provisorio, caminho)
    return caminho


def carregar_capitais() -> pd.DataFrame:
    """Lê o seed versionado com as coordenadas (ver scripts/gerar_seed_capitais.py)."""
    return pd.read_csv(config.seed_capitais)


def run(anos: list[int], capitais: list[str] | None = None, forcar: bool = False) -> list[Path]:
    catalogo = carregar_capitais()
    if capitais:
        catalogo = catalogo[catalogo["capital_id"].isin(capitais)]

    salvos: list[Path] = []
    for _, capital in catalogo.iterrows():
        for ano in anos:
            destino = caminho_particao(capital["capital_id"], ano)
            if destino.exists() and not forcar:
                logger.info("%s/%d já extraído — pulando (use --forcar pra refazer)", capital["capital_id"], ano)
                salvos.append(destino)
                continue

            raw = fetch_ano_raw(capital["latitude"], capital["longitude"], ano, capital["fuso"])
            df = parse_ano(raw, capital["capital_id"])

            # Ano em aberto volta truncado: a API corta no último dia publicado
            # do ERA5 (uns 5 dias de atraso), sem erro. Gravar isso congelaria
            # um ano incompleto, já que a próxima execução pula o que existe.
            esperado = horas_do_ano(ano)
            if len(df) != esperado:
                if ano >= datetime.now().year:
                    logger.warning(
                        "%s/%d ainda em aberto (%d de %d horas) — não gravado",
                        capital["capital_id"], ano, len(df), esperado,
                    )
                    continue
                raise ValueError(
                    f"{capital['capital_id']}/{ano}: {len(df)} horas, esperado {esperado}"
                )

            caminho = salvar_particao(df, capital["capital_id"], ano)
            logger.info("%s %s/%d: %d horas -> %s", capital["uf"], capital["capital"], ano, len(df), caminho)
            salvos.append(caminho)
    return salvos


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extrai o histórico horário de clima das capitais (Open-Meteo)")
    parser.add_argument("--anos", type=str, default=None, help="Intervalo ou lista, ex: 2020-2025 ou 2024,2025")
    parser.add_argument("--capitais", type=str, default=None, help="IDs separados por vírgula, ex: pr,am,rs")
    parser.add_argument("--forcar", action="store_true", help="Reextrai partições que já existem")
    args = parser.parse_args()

    from src.config import _parse_anos

    run(
        anos=_parse_anos(args.anos) if args.anos else config.anos,
        capitais=[c.strip() for c in args.capitais.split(",")] if args.capitais else None,
        forcar=args.forcar,
    )
