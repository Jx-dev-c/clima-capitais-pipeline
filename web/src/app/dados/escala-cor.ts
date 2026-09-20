/**
 * Escalas de cor dos gráficos.
 *
 * Duas escalas, cada uma com um trabalho diferente:
 * - **divergente** (temperatura): dois matizes com cinza no meio, porque o
 *   que interessa é o desvio — acima ou abaixo da média — e não só a magnitude.
 * - **sequencial** (chuva): um matiz só, do claro ao escuro, porque zero é
 *   zero e o resto é "mais".
 *
 * Os passos vêm de uma paleta validada para daltonismo e contraste; por isso
 * são valores fixos, e não cores geradas em tempo de execução.
 */

const FRIO = ['#9ec5f4', '#3987e5', '#256abf', '#0d366b'];
const CALOR = ['#f4b0aa', '#e34948', '#c3322f', '#7a1a18'];
const CHUVA = ['#cde2fb', '#86b6ef', '#3987e5', '#256abf', '#104281'];

function componentes(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.substring(i, i + 2), 16)) as [number, number, number];
}

export function misturar(a: string, b: string, t: number): string {
  const [r1, g1, b1] = componentes(a);
  const [r2, g2, b2] = componentes(b);
  const canal = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  return '#' + canal(r1, r2) + canal(g1, g2) + canal(b1, b2);
}

/** Interpola dentro de uma lista de paradas de cor. */
export function rampa(paradas: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (paradas.length - 1);
  const i = Math.min(Math.floor(x), paradas.length - 2);
  return misturar(paradas[i], paradas[i + 1], x - i);
}

export interface FaixaTemp {
  min: number;
  meio: number;
  max: number;
  neutro: string;
}

/** Azul abaixo do meio, vermelho acima, neutro exatamente no meio. */
export function corTemperatura(valor: number, faixa: FaixaTemp): string {
  const { min, meio, max, neutro } = faixa;
  if (valor <= meio) {
    return rampa([neutro, ...FRIO], (meio - valor) / Math.max(meio - min, 0.01));
  }
  return rampa([neutro, ...CALOR], (valor - meio) / Math.max(max - meio, 0.01));
}

/**
 * Chuva usa raiz quadrada: uns poucos dias de temporal esticam a escala e
 * achatariam todo o resto do ano num tom só.
 */
export function corChuva(mm: number, max: number, neutro: string): string {
  if (mm <= 0) return neutro;
  return rampa(CHUVA, Math.sqrt(mm / Math.max(max, 0.01)));
}

/** Passo "redondo" pro eixo: todo rótulo é um número que se lê em voz alta. */
export function passoRedondo(maximo: number): number {
  return [10, 20, 25, 50, 100, 200].find((passo) => maximo / 4 <= passo) ?? 500;
}
