-- Cardinalidade dos agregados: 12 meses e 24 horas por capital, sempre.
--
-- Um `unique_combination_of_columns` garante que não há linha repetida, mas
-- não que não está faltando linha. Se um mês inteiro sumisse da normal (ou uma
-- hora do perfil), o gráfico só desenharia um ponto a menos — sem erro.

with mensal as (

    select capital_id, count(*) as linhas, 12 as esperado, 'agg_clima_mensal' as modelo
    from {{ ref('agg_clima_mensal') }}
    group by 1

),

horario as (

    select capital_id, count(*) as linhas, 24 as esperado, 'agg_perfil_horario' as modelo
    from {{ ref('agg_perfil_horario') }}
    group by 1

),

tudo as (

    select * from mensal
    union all
    select * from horario

)

select *
from tudo
where linhas != esperado
