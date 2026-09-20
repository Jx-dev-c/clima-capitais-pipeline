"""Gera `dbt/clima/seeds/capitais.csv` — roda uma vez, não faz parte do pipeline.

As coordenadas das 27 capitais vêm da API de geocoding do Open-Meteo, mas
ficam *congeladas* num CSV versionado de propósito: a busca por nome é
ambígua (existe uma "Manaus" no Pará além da capital do Amazonas), e um
pipeline que resolve nome -> coordenada em toda execução pode mudar de
cidade sem ninguém perceber. Filtramos por `feature_code` de capital
(PPLC = capital do país, PPLA = capital de unidade federativa) e conferimos
o estado retornado (`admin1`) contra o esperado.
"""
from __future__ import annotations

import csv
import sys
import time
from pathlib import Path

import requests

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
SEED_PATH = Path(__file__).resolve().parents[1] / "dbt" / "clima" / "seeds" / "capitais.csv"

# (capital, UF, estado como o geocoding devolve, região)
CAPITAIS = [
    ("Rio Branco", "AC", "Acre", "Norte"),
    ("Maceió", "AL", "Alagoas", "Nordeste"),
    ("Macapá", "AP", "Amapá", "Norte"),
    ("Manaus", "AM", "Amazonas", "Norte"),
    ("Salvador", "BA", "Bahia", "Nordeste"),
    ("Fortaleza", "CE", "Ceará", "Nordeste"),
    ("Brasília", "DF", "Distrito Federal", "Centro-Oeste"),
    ("Vitória", "ES", "Espírito Santo", "Sudeste"),
    ("Goiânia", "GO", "Goiás", "Centro-Oeste"),
    ("São Luís", "MA", "Maranhão", "Nordeste"),
    ("Cuiabá", "MT", "Mato Grosso", "Centro-Oeste"),
    ("Campo Grande", "MS", "Mato Grosso do Sul", "Centro-Oeste"),
    ("Belo Horizonte", "MG", "Minas Gerais", "Sudeste"),
    ("Belém", "PA", "Pará", "Norte"),
    ("João Pessoa", "PB", "Paraíba", "Nordeste"),
    ("Curitiba", "PR", "Paraná", "Sul"),
    ("Recife", "PE", "Pernambuco", "Nordeste"),
    ("Teresina", "PI", "Piauí", "Nordeste"),
    ("Rio de Janeiro", "RJ", "Rio de Janeiro", "Sudeste"),
    ("Natal", "RN", "Rio Grande do Norte", "Nordeste"),
    ("Porto Alegre", "RS", "Rio Grande do Sul", "Sul"),
    ("Porto Velho", "RO", "Rondônia", "Norte"),
    ("Boa Vista", "RR", "Roraima", "Norte"),
    ("Florianópolis", "SC", "Santa Catarina", "Sul"),
    ("São Paulo", "SP", "São Paulo", "Sudeste"),
    ("Aracaju", "SE", "Sergipe", "Nordeste"),
    ("Palmas", "TO", "Tocantins", "Norte"),
]

CAPITAL_FEATURE_CODES = {"PPLC", "PPLA"}


def buscar(nome: str, estado: str) -> dict:
    resposta = requests.get(
        GEOCODING_URL, params={"name": nome, "count": 10, "country": "BR", "language": "pt"}, timeout=30
    )
    resposta.raise_for_status()
    for resultado in resposta.json().get("results", []):
        if resultado.get("feature_code") in CAPITAL_FEATURE_CODES and resultado.get("admin1") == estado:
            return resultado
    raise LookupError(f"Nenhuma capital encontrada para {nome}/{estado}")


def main() -> int:
    linhas = []
    for nome, uf, estado, regiao in CAPITAIS:
        local = buscar(nome, estado)
        linhas.append(
            {
                "capital_id": uf.lower(),
                "capital": nome,
                "uf": uf,
                "estado": estado,
                "regiao": regiao,
                "latitude": round(local["latitude"], 4),
                "longitude": round(local["longitude"], 4),
                "populacao": local.get("population") or "",
                "fuso": local["timezone"],
            }
        )
        print(f"{uf} {nome}: {local['latitude']:.4f}, {local['longitude']:.4f}")
        time.sleep(0.5)  # a API é gratuita; não vale martelar

    SEED_PATH.parent.mkdir(parents=True, exist_ok=True)
    with SEED_PATH.open("w", encoding="utf-8", newline="") as arquivo:
        writer = csv.DictWriter(arquivo, fieldnames=list(linhas[0]))
        writer.writeheader()
        writer.writerows(linhas)
    print(f"\n{len(linhas)} capitais salvas em {SEED_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
