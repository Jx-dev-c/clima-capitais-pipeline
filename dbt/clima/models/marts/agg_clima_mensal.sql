-- Normais mensais: como é um mês "típico" em cada capital.
-- Grão: 1 linha por capital + mês (1-12), agregando todos os anos.
--
-- A chuva é a média do *acumulado de cada ano* (e não a média das chuvas
-- diárias): "chove 250 mm em janeiro" é a leitura útil, e a média diária
-- esconderia isso num número perto de zero.
--
-- Só dia completo entra: um dia com 3 horas medidas tem máxima e acumulado
-- truncados, e puxaria a normal do mês pra baixo sem deixar rastro.

with diario as (

    select * from {{ ref('fct_clima_diario') }}
    where dia_completo

),

chuva_por_ano as (

    select
        capital_id,
        mes,
        ano,
        sum(chuva_mm) as chuva_mes_mm

    from diario
    group by 1, 2, 3

),

chuva_normal as (

    select
        capital_id,
        mes,
        round(sum(chuva_mes_mm) / count(*), 1) as chuva_media_mm

    from chuva_por_ano
    group by 1, 2

),

temperatura as (

    select
        capital_id,
        mes,
        round(sum(temp_media_c) / count(*), 2) as temp_media_c,
        round(sum(temp_max_c) / count(*), 2)   as temp_max_media_c,
        round(sum(temp_min_c) / count(*), 2)   as temp_min_media_c,
        max(temp_max_c)                        as temp_max_absoluta_c,
        min(temp_min_c)                        as temp_min_absoluta_c,
        count(*)                               as dias

    from diario
    group by 1, 2

)

select
    temperatura.capital_id,
    temperatura.mes,
    temperatura.temp_media_c,
    temperatura.temp_max_media_c,
    temperatura.temp_min_media_c,
    temperatura.temp_max_absoluta_c,
    temperatura.temp_min_absoluta_c,
    chuva_normal.chuva_media_mm,
    temperatura.dias

from temperatura
join chuva_normal
    on temperatura.capital_id = chuva_normal.capital_id
   and temperatura.mes = chuva_normal.mes
