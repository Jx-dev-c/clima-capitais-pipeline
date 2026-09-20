-- Cobertura: toda combinação capital × ano esperada precisa existir, completa.
--
-- A versão anterior deste teste agrupava o próprio fato e procurava ano com
-- menos de 365 dias. Isso não pega o pior caso: se uma partição inteira
-- (capital=pr/ano=2023) nunca for extraída, o grupo simplesmente não existe, e
-- um teste que só olha o que existe não tem linha nenhuma pra reprovar. Foi
-- confirmado apagando a partição: passava limpo.
--
-- Aqui o universo esperado é construído do seed (27 capitais) cruzado com os
-- anos configurados em `vars.anos_esperados`, e o fato entra por LEFT JOIN — a
-- ausência vira linha de falha. Ano bissexto cobra 366 dias.

{% set anos = var('anos_esperados') %}

with esperado as (

    select
        capitais.capital_id,
        anos.ano,
        case
            when anos.ano % 4 = 0 and (anos.ano % 100 != 0 or anos.ano % 400 = 0) then 366
            else 365
        end as dias_esperados

    from {{ ref('capitais') }} as capitais
    cross join (
        select unnest([{{ anos | join(', ') }}]) as ano
    ) as anos

),

observado as (

    select
        capital_id,
        ano,
        count(*)                                as dias,
        count(*) filter (where dia_completo)    as dias_completos

    from {{ ref('fct_clima_diario') }}
    group by 1, 2

)

select
    esperado.capital_id,
    esperado.ano,
    esperado.dias_esperados,
    coalesce(observado.dias, 0)           as dias_encontrados,
    coalesce(observado.dias_completos, 0) as dias_completos

from esperado
left join observado
    on esperado.capital_id = observado.capital_id
   and esperado.ano = observado.ano

where observado.capital_id is null
   or observado.dias < esperado.dias_esperados
   or observado.dias_completos < esperado.dias_esperados
