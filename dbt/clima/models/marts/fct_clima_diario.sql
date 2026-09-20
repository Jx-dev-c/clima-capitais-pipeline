-- Fato: clima diário por capital. Grão: 1 linha por capital + dia.
--
-- É aqui que o dado horário vira o que as pessoas de fato perguntam: máxima,
-- mínima, amplitude e chuva acumulada do dia. Manter a agregação no dbt (e não
-- pedir o resumo diário pronto pra API) deixa a regra versionada e testável —
-- e preserva o horário cru pra `agg_perfil_horario`.
--
-- `sum(...) / count(...)` em vez de `avg(...)`: a média é calculada sobre
-- DECIMAL pra ser reproduzível (ver o comentário em stg_clima_horario).

{{ config(materialized='table') }}

with horario as (

    select * from {{ ref('stg_clima_horario') }}

),

diario as (

    select
        capital_id,
        dia,
        ano,
        mes,
        min(temperatura_c)                                   as temp_min_c,
        max(temperatura_c)                                   as temp_max_c,
        round(sum(temperatura_c) / count(temperatura_c), 2)  as temp_media_c,
        round(max(temperatura_c) - min(temperatura_c), 2)    as amplitude_c,
        round(sum(umidade_pct) / count(umidade_pct), 1)      as umidade_media_pct,
        round(sum(precipitacao_mm), 2)                       as chuva_mm,
        -- quantas horas realmente têm medição: dia incompleto distorce média e
        -- amplitude, então fica explícito em vez de escondido
        count(temperatura_c)                                 as horas_medidas

    from horario
    group by 1, 2, 3, 4

)

select
    *,
    horas_medidas = 24 as dia_completo

from diario
