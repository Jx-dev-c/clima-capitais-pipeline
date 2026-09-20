import { Injectable, signal } from '@angular/core';

/** Uma linha da dica: rótulo e valor separados, pra não precisar de innerHTML. */
export interface LinhaDica {
  texto: string;
  valor: string;
}

export interface Dica {
  titulo: string;
  linhas: LinhaDica[];
  x: number;
  y: number;
}

/**
 * Uma dica flutuante só para a página inteira: mapa, calendário e gráficos
 * escrevem nela. Evita 2.192 elementos de tooltip pendurados no calendário.
 */
@Injectable({ providedIn: 'root' })
export class DicaService {
  readonly dica = signal<Dica | null>(null);

  mostrar(evento: { clientX: number; clientY: number }, titulo: string, linhas: LinhaDica[]): void {
    this.dica.set({ titulo, linhas, x: evento.clientX, y: evento.clientY });
  }

  esconder(): void {
    this.dica.set(null);
  }
}
