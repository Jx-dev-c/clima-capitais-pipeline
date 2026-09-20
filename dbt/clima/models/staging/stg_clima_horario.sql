-- Staging: tipagem e recortes de calendário, sem regra de negócio.
--
-- As partes de data saem aqui uma vez só, e não em cada mart, porque todo
-- agregado abaixo (diário, mensal, perfil por hora) recorta o mesmo timestamp
-- de jeitos diferentes.
--
-- As métricas viram DECIMAL de propósito. Soma de ponto flutuante depende da
-- ordem das linhas, e o DuckDB agrega em paralelo, sem ordem garantida: com
-- DOUBLE, reprocessar o mesmo Parquet mudava o último dígito de alguns valores
-- (Goiânia oscilava entre 940,7 e 940,8 mm/ano, porque o resultado caía em cima
-- da fronteira do arredondamento). DECIMAL soma exato, então o mesmo raw dá
-- sempre o mesmo número.

with source as (

    select * from {{ source('raw', 'clima_horario') }}

),

renomeado as (

    select
        capital_id,
        hora_local,
        cast(hora_local as date)                as dia,
        year(hora_local)                        as ano,
        month(hora_local)                       as mes,
        hour(hora_local)                        as hora_do_dia,
        cast(temperatura_c as decimal(6, 2))    as temperatura_c,
        cast(umidade_pct as decimal(6, 2))      as umidade_pct,
        cast(precipitacao_mm as decimal(8, 2))  as precipitacao_mm,
        ano_particao

    from source

)

select * from renomeado
