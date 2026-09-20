-- Toda capital da dimensão precisa aparecer no fato.
--
-- O teste de `relationships` só olha o sentido fato → dimensão: se uma capital
-- inteira sumir da extração, o fato continua íntegro e o `agg_capital_resumo`
-- (que junta por dentro) apenas deixa de emitir a linha. O mapa desenharia 26
-- pontos com o CI verde. Este teste fecha o outro sentido.

select
    capital.capital_id,
    capital.capital

from {{ ref('dim_capital') }} as capital
left join (
    select distinct capital_id from {{ ref('fct_clima_diario') }}
) as fato
    on capital.capital_id = fato.capital_id

where fato.capital_id is null
