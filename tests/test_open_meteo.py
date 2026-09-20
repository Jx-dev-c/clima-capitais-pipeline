"""Testes da extração. Nenhum teste bate na API de verdade: as respostas
são fixtures no formato real observado (listas paralelas em `hourly`,
com `null` onde não houve medição)."""
import pandas as pd
import pytest

from src.extract import open_meteo


def _raw(horas, temps, umidades, chuvas, latitude=-25.42, longitude=-49.27, fuso="America/Sao_Paulo"):
    return {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": fuso,
        "hourly_units": {"temperature_2m": "°C", "precipitation": "mm"},
        "hourly": {
            "time": horas,
            "temperature_2m": temps,
            "relative_humidity_2m": umidades,
            "precipitation": chuvas,
        },
    }


def test_parse_ano_converte_listas_paralelas_em_linhas():
    raw = _raw(["2024-01-01T00:00", "2024-01-01T01:00"], [18.2, 17.9], [88, 90], [0.0, 1.2])

    df = open_meteo.parse_ano(raw, capital_id="pr")

    assert list(df.columns) == ["capital_id", "hora_local", "temperatura_c", "umidade_pct", "precipitacao_mm"]
    assert len(df) == 2
    assert df["capital_id"].unique().tolist() == ["pr"]
    assert df["hora_local"].dtype.kind == "M"  # datetime, não string
    assert df.iloc[1]["precipitacao_mm"] == 1.2


def test_parse_ano_preserva_medicao_ausente_como_nulo():
    """Hora sem medição não pode virar 0: 'não mediu' é diferente de
    'choveu 0 mm', e a média da agregação mudaria."""
    raw = _raw(["2024-01-01T00:00", "2024-01-01T01:00"], [18.2, None], [88, None], [0.0, None])

    df = open_meteo.parse_ano(raw, capital_id="pr")

    assert df["temperatura_c"].isna().tolist() == [False, True]
    assert df["precipitacao_mm"].iloc[1] != 0


def test_fetch_ano_raw_pede_hora_local_e_o_ano_inteiro(mocker):
    """O fuso vai na requisição pra API devolver hora local — sem isso o
    dia do heatmap sai deslocado nas capitais fora de GMT-3."""
    get = mocker.patch("src.extract.open_meteo.requests.get")
    get.return_value.json.return_value = _raw([], [], [], [])

    open_meteo.fetch_ano_raw(-25.42, -49.27, 2024, "America/Sao_Paulo")

    params = get.call_args.kwargs["params"]
    assert params["start_date"] == "2024-01-01" and params["end_date"] == "2024-12-31"
    assert params["timezone"] == "America/Sao_Paulo"
    assert "temperature_2m" in params["hourly"]


def test_fetch_ano_raw_faz_retry_e_propaga_erro(monkeypatch, mocker):
    import requests

    monkeypatch.setattr("time.sleep", lambda *a, **k: None)
    mocker.patch("src.extract.open_meteo.requests.get", side_effect=requests.exceptions.ConnectionError("simulado"))

    with pytest.raises(requests.exceptions.ConnectionError):
        open_meteo.fetch_ano_raw(0, 0, 2024, "UTC")

    assert open_meteo.requests.get.call_count == 3


def test_particao_separa_capital_e_ano(tmp_path):
    df = pd.DataFrame({"capital_id": ["pr"], "hora_local": [pd.Timestamp("2024-01-01")], "temperatura_c": [18.2]})

    caminho = open_meteo.salvar_particao(df, "pr", 2024, raw_dir=tmp_path)

    assert caminho == tmp_path / "open_meteo" / "capital=pr" / "ano=2024" / "clima.parquet"
    assert pd.read_parquet(caminho)["temperatura_c"].iloc[0] == 18.2


def _ano_completo(ano):
    """Resposta com o ano inteiro de horas — o que a API devolve pra ano fechado."""
    horas = open_meteo.horas_do_ano(ano)
    return _raw([f"{ano}-01-01T00:00"] * horas, [18.2] * horas, [88] * horas, [0.0] * horas)


def _seed(tmp_path):
    seed = tmp_path / "capitais.csv"
    seed.write_text(
        "capital_id,capital,uf,estado,regiao,latitude,longitude,populacao,fuso\n"
        "pr,Curitiba,PR,Paraná,Sul,-25.42,-49.27,1963726,America/Sao_Paulo\n",
        encoding="utf-8",
    )
    return seed


def test_run_pula_particao_ja_extraida(tmp_path, monkeypatch, mocker):
    """Ano fechado nao muda: reexecutar nao deve rebaixar 1,4 milhao de linhas."""
    monkeypatch.setattr(open_meteo.config, "data_dir", tmp_path)
    monkeypatch.setattr(open_meteo.config, "seed_capitais", _seed(tmp_path))
    fetch = mocker.patch("src.extract.open_meteo.fetch_ano_raw", return_value=_ano_completo(2024))

    open_meteo.run(anos=[2024])
    open_meteo.run(anos=[2024])  # segunda vez: particao ja existe

    assert fetch.call_count == 1


def test_run_recusa_ano_fechado_incompleto(tmp_path, monkeypatch, mocker):
    """Ano fechado com menos horas que o calendario e erro, nao dado parcial:
    gravar congelaria o buraco, ja que a execucao seguinte pula o que existe."""
    monkeypatch.setattr(open_meteo.config, "data_dir", tmp_path)
    monkeypatch.setattr(open_meteo.config, "seed_capitais", _seed(tmp_path))
    mocker.patch(
        "src.extract.open_meteo.fetch_ano_raw",
        return_value=_raw(["2024-01-01T00:00"], [18.2], [88], [0.0]),
    )

    with pytest.raises(ValueError, match="esperado 8784"):
        open_meteo.run(anos=[2024])

    assert not open_meteo.caminho_particao("pr", 2024, tmp_path).exists()


def test_run_nao_grava_ano_em_aberto(tmp_path, monkeypatch, mocker):
    """O ano corrente volta truncado (o ERA5 tem ~5 dias de atraso) e a API nao
    sinaliza isso — melhor nao gravar do que congelar um ano pela metade."""
    from datetime import datetime

    ano_corrente = datetime.now().year
    monkeypatch.setattr(open_meteo.config, "data_dir", tmp_path)
    monkeypatch.setattr(open_meteo.config, "seed_capitais", _seed(tmp_path))
    mocker.patch(
        "src.extract.open_meteo.fetch_ano_raw",
        return_value=_raw([f"{ano_corrente}-01-01T00:00"], [18.2], [88], [0.0]),
    )

    open_meteo.run(anos=[ano_corrente])

    assert not open_meteo.caminho_particao("pr", ano_corrente, tmp_path).exists()


def test_fetch_recusa_resposta_em_outro_fuso(mocker):
    """A API responde 200 mesmo ignorando o fuso pedido (cai pra GMT): sem
    conferir, o dia do calendario sairia deslocado sem nenhum sintoma."""
    get = mocker.patch("src.extract.open_meteo.requests.get")
    get.return_value.json.return_value = _raw([], [], [], [], fuso="GMT")

    with pytest.raises(ValueError, match="fuso"):
        open_meteo.fetch_ano_raw(-25.42, -49.27, 2024, "America/Sao_Paulo")


def test_fetch_recusa_ponto_distante_do_pedido(mocker):
    """Erro de sinal na longitude traria o clima de outro lugar com HTTP 200."""
    get = mocker.patch("src.extract.open_meteo.requests.get")
    get.return_value.json.return_value = _raw([], [], [], [], longitude=49.27)

    with pytest.raises(ValueError, match="longe do pedido"):
        open_meteo.fetch_ano_raw(-25.42, -49.27, 2024, "America/Sao_Paulo")


def test_horas_do_ano_conta_bissexto():
    assert open_meteo.horas_do_ano(2023) == 8760
    assert open_meteo.horas_do_ano(2024) == 8784
