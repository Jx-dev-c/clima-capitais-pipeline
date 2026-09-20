-- Dimensão: uma linha por capital. Grão: capital_id.
--
-- Vem do seed versionado (`seeds/capitais.csv`), não de uma chamada à API
-- de geocoding: coordenada de capital não muda, e resolver nome -> ponto
-- em toda execução deixaria o pipeline à mercê de uma busca ambígua
-- (existe uma "Manaus" no Pará além da capital do Amazonas).

with capitais as (

    select * from {{ ref('capitais') }}

)

select
    capital_id,
    capital,
    uf,
    estado,
    regiao,
    latitude,
    longitude,
    populacao

from capitais
