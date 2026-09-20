/** Uma série é uma capital dentro de um gráfico de comparação. */
export interface Serie {
  id: string;
  nome: string;
  uf: string;
  cor: string;
  valores: number[];
}

/**
 * A cor segue a posição na seleção, e as três primeiras vagas da paleta são
 * as validadas para daltonismo. Nunca gerar matiz nova em tempo de execução.
 */
export function corSerie(indice: number): string {
  return `var(--serie-${Math.max(0, indice) + 1})`;
}

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function formatar(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
