"""Carrega o Parquet cru para a zona `raw` do DuckDB.

O DuckDB lê Parquet direto do disco, então dava pra apontar o dbt para os
arquivos e pular esta etapa. Ela existe por dois motivos práticos:

- **Contrato explícito.** O dbt lê de uma tabela com schema e tipos
  declarados, não de um glob de arquivos que pode estar pela metade — se
  a extração parou no meio, isso aparece aqui e não no meio de um model.
- **Velocidade de consulta.** Materializar uma vez evita reabrir 162
  arquivos Parquet a cada `dbt run` e a cada gráfico do dashboard.

A carga é um `CREATE OR REPLACE` da tabela inteira. Com ~1,4 milhão de
linhas isso leva poucos segundos, e reconstruir tudo é mais simples e mais
auditável do que carga incremental: o estado final depende só do que está
em `data/raw/`, nunca do histórico de execuções. Numa escala em que isso
deixasse de ser barato, o passo seguinte seria inserir partição por
partição (`DELETE` + `INSERT` por capital/ano).
"""
from __future__ import annotations

import argparse
import logging
from pathlib import Path

import duckdb

import pandas as pd

from src.config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

RAW_SCHEMA = "raw"
TABELA = "clima_horario"


def padrao_parquet(raw_dir: Path | None = None) -> str:
    """Glob das partições `capital=<uf>/ano=<ano>/clima.parquet`."""
    base = (raw_dir or config.raw_dir) / "open_meteo"
    return str(base / "capital=*" / "ano=*" / "*.parquet").replace("\\", "/")


def carregar(con: duckdb.DuckDBPyConnection, raw_dir: Path | None = None) -> int:
    padrao = padrao_parquet(raw_dir)
    con.execute(f"CREATE SCHEMA IF NOT EXISTS {RAW_SCHEMA}")
    con.execute(
        f"""
        CREATE OR REPLACE TABLE {RAW_SCHEMA}.{TABELA} AS
        SELECT
            capital_id,
            hora_local,
            temperatura_c,
            umidade_pct,
            precipitacao_mm,
            -- a partição `ano=` do caminho vira coluna: barato de filtrar
            -- e serve de conferência contra o próprio timestamp
            CAST(ano AS INTEGER) AS ano_particao
        FROM read_parquet('{padrao}', hive_partitioning = true)
        """
    )
    linhas = con.execute(f"SELECT count(*) FROM {RAW_SCHEMA}.{TABELA}").fetchone()[0]
    return linhas


def conferir_volume(con: duckdb.DuckDBPyConnection, capitais_esperadas: int) -> tuple[int, int]:
    """Recusa uma carga que não tem todas as capitais do seed.

    `CREATE OR REPLACE` é idempotente, mas obediente: se `data/raw/` estiver
    com metade das partições (extração interrompida, pasta parcial), ele troca
    a tabela inteira por essa metade sem reclamar. O dbt roda verde e o mapa
    aparece com menos pontos — falha silenciosa, que é a pior.
    """
    capitais, anos = con.execute(
        f"SELECT count(DISTINCT capital_id), count(DISTINCT ano_particao) FROM {RAW_SCHEMA}.{TABELA}"
    ).fetchone()

    if capitais < capitais_esperadas:
        raise ValueError(
            f"Só {capitais} capitais em {RAW_SCHEMA}.{TABELA}, esperado {capitais_esperadas}. "
            "Rode a extração completa antes do load."
        )
    return capitais, anos


def run(db_path: Path | None = None, raw_dir: Path | None = None) -> int:
    destino = db_path or config.duckdb_path
    destino.parent.mkdir(parents=True, exist_ok=True)
    esperadas = len(pd.read_csv(config.seed_capitais))

    with duckdb.connect(str(destino)) as con:
        linhas = carregar(con, raw_dir)
        capitais, anos = conferir_volume(con, esperadas)

    logger.info("%s.%s: %d linhas (%d capitais, %d anos) em %s", RAW_SCHEMA, TABELA, linhas, capitais, anos, destino)
    return linhas


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Carrega o Parquet cru para o DuckDB")
    parser.add_argument("--db", type=str, default=None, help="Caminho do arquivo .duckdb")
    args = parser.parse_args()
    run(db_path=Path(args.db) if args.db else None)
