"""Gera `web/public/dados.json` — os números que o dashboard Angular desenha.

Lê só as tabelas `marts` do DuckDB (nunca a raw): se um número aparece na
tela, ele passou pelos testes do dbt. Também converte a malha oficial dos
estados (API de malhas do IBGE) em caminhos SVG já projetados, pra que o
navegador não precise nem baixar GeoJSON nem projetar coordenada.

Formato compacto de propósito: a série diária vai como lista de números
por capital/ano (não como lista de objetos), o que deixa 118 mil valores
em poucas centenas de KB.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import duckdb

from src.config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

AQUI = Path(__file__).resolve().parent
MALHA = config.data_dir / "malha_uf.geojson"
SAIDA = AQUI.parent / "web" / "public" / "dados.json"

# Códigos do IBGE para UF: estáveis desde 1988, seguros de fixar aqui.
COD_UF = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
    "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
    "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}

# Projeção equirretangular com paralelo padrão em -14° (meio do país): o
# Brasil fica com proporção correta sem depender de lib de projeção.
PARALELO_PADRAO = math.radians(-14)
LARGURA, ALTURA, MARGEM = 1000, 1000, 12


def _projetar(lon: float, lat: float) -> tuple[float, float]:
    return lon * math.cos(PARALELO_PADRAO), -lat


def _limites(geojson: dict) -> tuple[float, float, float, float]:
    xs, ys = [], []
    for feature in geojson["features"]:
        for anel in _aneis(feature["geometry"]):
            for lon, lat in anel:
                x, y = _projetar(lon, lat)
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def _aneis(geometry: dict):
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        for poligono in geometry["coordinates"]:
            yield from poligono


def malha_para_svg(geojson: dict) -> tuple[list[dict], dict]:
    """Converte a malha em paths SVG e devolve a função de escala usada,
    pra que os pontos das capitais caiam exatamente sobre o mapa."""
    x0, y0, x1, y1 = _limites(geojson)
    escala = min((LARGURA - 2 * MARGEM) / (x1 - x0), (ALTURA - 2 * MARGEM) / (y1 - y0))
    desloc_x = MARGEM + ((LARGURA - 2 * MARGEM) - (x1 - x0) * escala) / 2
    desloc_y = MARGEM + ((ALTURA - 2 * MARGEM) - (y1 - y0) * escala) / 2

    def tela(lon: float, lat: float) -> tuple[float, float]:
        x, y = _projetar(lon, lat)
        return round((x - x0) * escala + desloc_x, 1), round((y - y0) * escala + desloc_y, 1)

    estados = []
    for feature in geojson["features"]:
        partes = []
        for anel in _aneis(feature["geometry"]):
            pontos = [tela(lon, lat) for lon, lat in anel]
            partes.append("M" + "L".join(f"{x} {y}" for x, y in pontos) + "Z")
        estados.append({"uf": COD_UF[feature["properties"]["codarea"]], "d": "".join(partes)})

    projecao = {"x0": x0, "y0": y0, "escala": escala, "dx": desloc_x, "dy": desloc_y,
                "cos": math.cos(PARALELO_PADRAO)}
    return estados, projecao


def coletar(con: duckdb.DuckDBPyConnection) -> dict:
    capitais = con.execute(
        """
        select capital_id, capital, uf, regiao, latitude, longitude, populacao,
               temp_media_c, amplitude_media_c, temp_max_absoluta_c, temp_min_absoluta_c,
               umidade_media_pct, chuva_anual_media_mm, dias_observados
        from main.agg_capital_resumo
        order by capital
        """
    ).df().to_dict(orient="records")

    mensal: dict[str, list] = {}
    for linha in con.execute(
        "select capital_id, mes, temp_media_c, temp_max_media_c, temp_min_media_c, chuva_media_mm "
        "from main.agg_clima_mensal order by capital_id, mes"
    ).fetchall():
        mensal.setdefault(linha[0], []).append(list(linha[1:]))

    horario: dict[str, list] = {}
    for linha in con.execute(
        "select capital_id, hora_do_dia, temp_media_c from main.agg_perfil_horario order by capital_id, hora_do_dia"
    ).fetchall():
        horario.setdefault(linha[0], []).append(linha[2])

    # série diária: {capital: {ano: {"t": [...], "c": [...]}}} — listas
    # paralelas, uma posição por dia do ano
    diario: dict[str, dict[str, dict[str, list]]] = {}
    for capital_id, ano, temp, chuva in con.execute(
        "select capital_id, ano, temp_media_c, chuva_mm from main.fct_clima_diario order by capital_id, dia"
    ).fetchall():
        por_ano = diario.setdefault(capital_id, {}).setdefault(str(ano), {"t": [], "c": []})
        por_ano["t"].append(round(temp, 1))
        por_ano["c"].append(round(chuva, 1))

    # tudo sai dos marts — inclusive a contagem de medições, que antes vinha de
    # `raw.clima_horario` e era, ironicamente, o único número do dashboard que
    # não passava por teste nenhum
    periodo = con.execute(
        """
        select min(primeiro_dia), max(ultimo_dia), sum(dias_observados), sum(horas_medidas)
        from main.agg_capital_resumo
        """
    ).fetchone()
    medicoes = periodo[3]

    return {
        "capitais": capitais,
        "mensal": mensal,
        "horario": horario,
        "diario": diario,
        "meta": {
            "inicio": str(periodo[0]),
            "fim": str(periodo[1]),
            "dias": int(periodo[2]),
            "medicoes": int(medicoes),
            "anos": sorted({ano for capital in diario.values() for ano in capital}),
        },
    }


def main() -> None:
    geojson = json.loads(MALHA.read_text(encoding="utf-8"))
    estados, projecao = malha_para_svg(geojson)

    with duckdb.connect(str(config.duckdb_path), read_only=True) as con:
        dados = coletar(con)

    dados["mapa"] = {"largura": LARGURA, "altura": ALTURA, "estados": estados, "projecao": projecao}
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    # ensure_ascii: o JSON sai 100% ASCII, entao "Belem" nao depende do
    # charset anunciado pelo servidor pra nao virar "BelA©m"
    SAIDA.write_text(
        # default=float: os marts guardam DECIMAL (e o que torna o numero
        # reproduzivel) e JSON nao tem esse tipo — a conversao acontece so
        # aqui, na fronteira de apresentacao
        json.dumps(dados, ensure_ascii=True, separators=(",", ":"), default=float),
        encoding="utf-8",
    )
    logger.info("%s gerado: %.1f KB", SAIDA.name, SAIDA.stat().st_size / 1024)


if __name__ == "__main__":
    main()
