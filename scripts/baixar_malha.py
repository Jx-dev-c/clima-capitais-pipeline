"""Baixa a malha dos estados (API de malhas do IBGE) para `data/malha_uf.geojson`.

Roda uma vez, antes de gerar o dashboard. O arquivo não é versionado (fica em
`data/`, junto com o resto do que é regenerável) — mas, diferente do seed de
capitais, aqui não há ambiguidade a resolver: é o mesmo GeoJSON oficial sempre,
identificado por código de UF.

`qualidade=minima` é de propósito: o contorno vira `path` SVG no build do
dashboard, e a malha detalhada (vários MB) não mudaria nada num mapa de
1000 px de largura.
"""
from __future__ import annotations

import logging
import sys

import requests

from src.config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

URL = "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR"
UFS_ESPERADAS = 27


def main() -> int:
    resposta = requests.get(
        URL,
        params={
            "formato": "application/vnd.geo+json",
            "intrarregiao": "UF",
            "qualidade": "minima",
        },
        timeout=120,
    )
    resposta.raise_for_status()
    geojson = resposta.json()

    quantidade = len(geojson.get("features", []))
    if quantidade != UFS_ESPERADAS:
        raise ValueError(f"Esperava {UFS_ESPERADAS} unidades federativas, vieram {quantidade}")

    destino = config.data_dir / "malha_uf.geojson"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(resposta.text, encoding="utf-8")
    logger.info("%s salvo: %d UFs, %.0f KB", destino, quantidade, destino.stat().st_size / 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
