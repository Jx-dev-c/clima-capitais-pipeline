-- Sanidade física: mínima não pode ser maior que máxima.
-- Um teste de intervalo não pegaria esse caso — os dois valores podem
-- estar dentro da faixa plausível e ainda assim invertidos, o que
-- denunciaria erro de agregação (min/max trocados, por exemplo).

select
    capital_id,
    dia,
    temp_min_c,
    temp_max_c

from {{ ref('fct_clima_diario') }}
where temp_min_c > temp_max_c
