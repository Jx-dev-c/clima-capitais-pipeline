-- Perfil do dia: temperatura média por hora do dia, em cada capital.
-- Grão: 1 linha por capital + hora (0-23).
--
-- Só existe porque a extração guardou o dado horário: é a resposta a "que horas
-- faz mais calor em Cuiabá?" e mostra o contraste entre litoral (variação
-- curta) e interior (variação larga).

with horario as (

    select * from {{ ref('stg_clima_horario') }}

)

select
    capital_id,
    hora_do_dia,
    round(sum(temperatura_c) / count(temperatura_c), 2) as temp_media_c,
    round(sum(umidade_pct) / count(umidade_pct), 1)     as umidade_media_pct,
    -- medições de fato, não `count(*)`: hora sem leitura não pode contar como
    -- se tivesse sido medida (é o mesmo critério de `horas_medidas` no fato)
    count(temperatura_c)                                as medicoes

from horario
group by 1, 2
