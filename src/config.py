"""Configuração central, lida de variáveis de ambiente (com defaults sensatos)."""
from dataclasses import dataclass, field
from pathlib import Path
import os

from dotenv import load_dotenv

load_dotenv()

RAIZ = Path(__file__).resolve().parents[1]


def _parse_anos(raw: str) -> list[int]:
    """Aceita '2020-2025' ou '2020,2021'."""
    raw = raw.strip()
    if "-" in raw:
        inicio, fim = (int(parte) for parte in raw.split("-", 1))
        return list(range(inicio, fim + 1))
    return [int(ano.strip()) for ano in raw.split(",") if ano.strip()]


@dataclass
class Config:
    anos: list[int] = field(default_factory=lambda: _parse_anos(os.getenv("ANOS", "2020-2025")))
    data_dir: Path = Path(os.getenv("DATA_DIR", RAIZ / "data"))
    duckdb_path: Path = Path(os.getenv("DUCKDB_PATH", RAIZ / "data" / "clima.duckdb"))
    seed_capitais: Path = Path(os.getenv("SEED_CAPITAIS", RAIZ / "dbt" / "clima" / "seeds" / "capitais.csv"))

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"


config = Config()
