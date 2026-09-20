/** Formato de `public/dados.json`, gerado por `dashboard/build_dashboard.py`. */

export interface Capital {
  capital_id: string;
  capital: string;
  uf: string;
  regiao: string;
  latitude: number;
  longitude: number;
  populacao: number;
  temp_media_c: number;
  amplitude_media_c: number;
  temp_max_absoluta_c: number;
  temp_min_absoluta_c: number;
  umidade_media_pct: number;
  chuva_anual_media_mm: number;
  dias_observados: number;
  primeiro_dia: string;
  ultimo_dia: string;
}

/** [mes, temp_media, temp_max_media, temp_min_media, chuva_media_mm] */
export type LinhaMensal = [number, number, number, number, number];

/** Listas paralelas: uma posição por dia do ano. */
export interface AnoDiario {
  t: number[];
  c: number[];
}

export interface Meta {
  inicio: string;
  fim: string;
  dias: number;
  medicoes: number;
  anos: string[];
}

export interface Mapa {
  largura: number;
  altura: number;
  estados: { uf: string; d: string }[];
  projecao: { x0: number; y0: number; escala: number; dx: number; dy: number; cos: number };
}

export interface Dados {
  capitais: Capital[];
  mensal: Record<string, LinhaMensal[]>;
  horario: Record<string, number[]>;
  diario: Record<string, Record<string, AnoDiario>>;
  meta: Meta;
  mapa: Mapa;
}

export type Metrica = 'temp' | 'chuva';
