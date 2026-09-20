"""Gera uma amostra sintética do raw, para o CI rodar o pipeline sem rede.

O problema que isto resolve: `data/` não é versionado (são 15 MB de Parquet
regenerável), então o CI não tinha como rodar `dbt build` — os 24 testes de
qualidade, que são o principal argumento do projeto, só rodavam na minha
máquina. Baixar 162 anos-capital da API a cada push seria abusivo com um
serviço gratuito e deixaria o CI dependente de rede alheia.

A amostra cobre as 27 capitais e um ano inteiro (2024, bissexto: 8.784 horas),
com o mesmo schema e o mesmo layout de partições do dado real. Os valores são
sintéticos mas plausíveis — senoide anual em torno de uma média por capital,
com ciclo diário por cima — para que os testes de faixa e de sanidade física
sejam exercitados de verdade, e não passem por acaso.

Determinístico: mesma semente, mesmos bytes.
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.config import config
from src.extract.open_meteo import horas_do_ano, salvar_particao

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SEMENTE = 20260919


def serie_de_uma_capital(capital_id: str, latitude: float, ano: int, rng: np.random.Generator) -> pd.DataFrame:
    horas = horas_do_ano(ano)
    instantes = pd.date_range(f"{ano}-01-01", periods=horas, freq="h")

    # média anual cai conforme se afasta do equador; amplitude sobe
    media_anual = 28.0 + latitude * 0.28
    amplitude_anual = 2.0 + abs(latitude) * 0.15
    amplitude_diaria = 3.0 + abs(latitude) * 0.12

    dia_do_ano = instantes.dayofyear.to_numpy()
    hora = instantes.hour.to_numpy()

    # verão no hemisfério sul: pico em janeiro
    sazonal = amplitude_anual * np.cos(2 * np.pi * (dia_do_ano - 15) / 365)
    diario = amplitude_diaria * np.cos(2 * np.pi * (hora - 15) / 24)
    ruido = rng.normal(0, 0.8, horas)

    temperatura = np.round(media_anual + sazonal + diario + ruido, 1)
    umidade = np.clip(np.round(85 - (temperatura - media_anual) * 2 + rng.normal(0, 3, horas), 1), 10, 100)
    # chuva concentrada em poucas horas, como no dado real
    chuva = np.where(rng.random(horas) < 0.04, np.round(rng.gamma(2, 1.5, horas), 1), 0.0)

    return pd.DataFrame(
        {
            "capital_id": capital_id,
            "hora_local": instantes,
            "temperatura_c": temperatura,
            "umidade_pct": umidade,
            "precipitacao_mm": chuva,
        }
    )


def run(ano: int, raw_dir: Path | None = None) -> int:
    capitais = pd.read_csv(config.seed_capitais)
    rng = np.random.default_rng(SEMENTE)

    linhas = 0
    for _, capital in capitais.iterrows():
        df = serie_de_uma_capital(capital["capital_id"], capital["latitude"], ano, rng)
        salvar_particao(df, capital["capital_id"], ano, raw_dir=raw_dir)
        linhas += len(df)

    logger.info("Amostra sintética: %d capitais × %d horas = %d linhas", len(capitais), horas_do_ano(ano), linhas)
    return linhas


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gera amostra sintética do raw para o CI")
    parser.add_argument("--ano", type=int, default=2024)
    args = parser.parse_args()
    run(ano=args.ano)
