"""Testes do load. Usam DuckDB de verdade (em arquivo temporário) sobre
Parquet gerado na hora — é rápido e testa o que importa: o glob das
partições e o schema resultante."""
import duckdb
import pandas as pd
import pytest

from src.extract.open_meteo import salvar_particao
from src.load import load_to_duckdb


@pytest.fixture
def raw_dir(tmp_path):
    for capital, ano, temp in (("pr", 2024, 18.2), ("am", 2024, 31.5), ("pr", 2025, 19.0)):
        df = pd.DataFrame(
            {
                "capital_id": [capital],
                "hora_local": [pd.Timestamp(f"{ano}-01-01 12:00")],
                "temperatura_c": [temp],
                "umidade_pct": [80.0],
                "precipitacao_mm": [0.0],
            }
        )
        salvar_particao(df, capital, ano, raw_dir=tmp_path)
    return tmp_path


def test_carregar_le_todas_as_particoes(raw_dir, tmp_path):
    with duckdb.connect(str(tmp_path / "t.duckdb")) as con:
        linhas = load_to_duckdb.carregar(con, raw_dir=raw_dir)
        capitais = con.execute("SELECT DISTINCT capital_id FROM raw.clima_horario ORDER BY 1").fetchall()

    assert linhas == 3
    assert capitais == [("am",), ("pr",)]


def test_carregar_promove_a_particao_de_ano_a_coluna(raw_dir, tmp_path):
    """O ano vem do caminho (`ano=2024`), não do timestamp — é o que
    permite filtrar partição sem abrir o arquivo inteiro."""
    with duckdb.connect(str(tmp_path / "t.duckdb")) as con:
        load_to_duckdb.carregar(con, raw_dir=raw_dir)
        anos = con.execute("SELECT DISTINCT ano_particao FROM raw.clima_horario ORDER BY 1").fetchall()

    assert anos == [(2024,), (2025,)]


def test_carregar_e_idempotente(raw_dir, tmp_path):
    with duckdb.connect(str(tmp_path / "t.duckdb")) as con:
        load_to_duckdb.carregar(con, raw_dir=raw_dir)
        linhas = load_to_duckdb.carregar(con, raw_dir=raw_dir)

    assert linhas == 3  # segunda carga não duplica
