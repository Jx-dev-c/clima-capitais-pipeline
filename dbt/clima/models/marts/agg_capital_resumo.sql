-- Cartão-resumo de cada capital: o que o mapa e os destaques do dashboard
-- mostram. Grão: 1 linha por capital.
--
-- Junta a dimensão (coordenada, população) com os números do período inteiro,
-- pra que o front leia uma linha por ponto do mapa em vez de agregar no
-- navegador.
--
-- A média é ponderada por `horas_medidas`, não a média das médias diárias:
-- hoje todo dia tem 24 horas e os dois resultados batem, mas no primeiro dia
-- parcial a média simples daria peso de dia inteiro a um dia de 3 horas.

with diario as (

    select * from {{ ref('fct_clima_diario') }}

),

capital as (

    select * from {{ ref('dim_capital') }}

),

resumo as (

    select
        capital_id,
        round(sum(temp_media_c * horas_medidas) / sum(horas_medidas), 2)      as temp_media_c,
        round(sum(amplitude_c) / count(*), 2)                                 as amplitude_media_c,
        max(temp_max_c)                                                       as temp_max_absoluta_c,
        min(temp_min_c)                                                       as temp_min_absoluta_c,
        round(sum(umidade_media_pct * horas_medidas) / sum(horas_medidas), 1) as umidade_media_pct,
        -- chuva anual média: total do período dividido pelos anos cobertos
        round(sum(chuva_mm) / count(distinct ano), 1)                         as chuva_anual_media_mm,
        count(*)                                                              as dias_observados,
        sum(horas_medidas)                                                    as horas_medidas,
        min(dia)                                                              as primeiro_dia,
        max(dia)                                                              as ultimo_dia

    from diario
    group by 1

)

select
    capital.capital_id,
    capital.capital,
    capital.uf,
    capital.regiao,
    capital.latitude,
    capital.longitude,
    capital.populacao,
    resumo.temp_media_c,
    resumo.amplitude_media_c,
    resumo.temp_max_absoluta_c,
    resumo.temp_min_absoluta_c,
    resumo.umidade_media_pct,
    resumo.chuva_anual_media_mm,
    resumo.dias_observados,
    resumo.horas_medidas,
    resumo.primeiro_dia,
    resumo.ultimo_dia

from capital
join resumo using (capital_id)
