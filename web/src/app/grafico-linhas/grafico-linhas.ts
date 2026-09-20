import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { DicaService } from '../dados/dica-service';
import { formatar, Serie } from '../dados/series';

interface Marca {
  x: number;
  y: number;
  cor: string;
}

/** Gráfico de linhas com leitura por posição (guia vertical + dica). */
@Component({
  selector: 'app-grafico-linhas',
  templateUrl: './grafico-linhas.html',
  styleUrl: './grafico-linhas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoLinhas {
  private readonly dicas = inject(DicaService);

  readonly series = input.required<Serie[]>();
  readonly rotulosX = input.required<string[]>();
  /** Quais posições do eixo x ganham rótulo — 24 horas não cabem todas. */
  readonly ticksX = input.required<number[]>();
  readonly unidade = input('°C');
  readonly casas = input(1);
  readonly descricao = input('Gráfico de linhas');

  readonly L = 560;
  readonly A = 300;
  private readonly esq = 42;
  private readonly dir = 54;
  // 28 e nao 14: a unidade do eixo fica acima da primeira grade, e com
  // margem menor o texto era cortado pela borda do viewBox
  private readonly topo = 28;
  private readonly base = 34;

  readonly posicaoAtiva = signal<number | null>(null);

  private readonly limites = computed(() => {
    const valores = this.series().flatMap((serie) => serie.valores);
    if (!valores.length) return { min: 0, max: 1 };
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    const folga = (max - min) * 0.18 || 1;
    // arredonda pra número par: eixo com 16/22/28 lê melhor que 16,4/22,7
    return { min: Math.floor((min - folga) / 2) * 2, max: Math.ceil((max + folga) / 2) * 2 };
  });

  readonly quantidade = computed(() => this.series()[0]?.valores.length ?? 0);

  x(i: number): number {
    return this.esq + (i / Math.max(this.quantidade() - 1, 1)) * (this.L - this.esq - this.dir);
  }

  y(valor: number): number {
    const { min, max } = this.limites();
    return this.topo + (1 - (valor - min) / (max - min)) * (this.A - this.topo - this.base);
  }

  readonly linhasGrade = computed(() => {
    const { min, max } = this.limites();
    const passo = (max - min) / 4;
    return Array.from({ length: 5 }, (_, i) => {
      const valor = min + passo * i;
      return { valor, y: this.y(valor), rotulo: formatar(valor, 0) };
    });
  });

  readonly caminhos = computed(() =>
    this.series().map((serie) => ({
      serie,
      d: serie.valores.map((v, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)} ${this.y(v).toFixed(1)}`).join(''),
    })),
  );

  /**
   * Rótulo no fim de cada linha: a identidade não pode depender só da cor.
   * Quando duas séries terminam quase juntas, empilha pra não sobrepor.
   */
  readonly rotulosSerie = computed(() => {
    // nunca -1: série vazia (capital sem dado mensal) daria valores[-1] e NaN
    const ultimo = Math.max(this.quantidade() - 1, 0);
    const altura = 13;
    const ordenados = this.series()
      .filter((serie) => serie.valores.length > 0)
      .map((serie) => ({ serie, y: this.y(serie.valores[ultimo]), yLinha: this.y(serie.valores[ultimo]) }))
      .sort((a, b) => a.y - b.y);

    ordenados.forEach((item, i) => {
      if (i > 0 && item.y - ordenados[i - 1].y < altura) item.y = ordenados[i - 1].y + altura;
    });
    return ordenados.map((item) => ({ uf: item.serie.uf, cor: item.serie.cor, x: this.x(ultimo) + 9, y: item.y + 4, yLinha: item.yLinha }));
  });

  readonly marcasAtivas = computed<Marca[]>(() => {
    const i = this.posicaoAtiva();
    if (i === null) return [];
    return this.series()
      .filter((serie) => serie.valores[i] !== undefined)
      .map((serie) => ({ x: this.x(i), y: this.y(serie.valores[i]), cor: serie.cor }));
  });

  readonly guiaX = computed(() => {
    const i = this.posicaoAtiva();
    return i === null ? 0 : this.x(i);
  });

  readonly alturaUtil = computed(() => this.A - this.topo - this.base);
  readonly larguraFaixa = computed(() => (this.L - this.esq - this.dir) / Math.max(this.quantidade() - 1, 1));

  faixaX(i: number): number {
    return this.x(i) - this.larguraFaixa() / 2;
  }

  aoEntrar(evento: PointerEvent, i: number): void {
    this.posicaoAtiva.set(i);
    this.dicas.mostrar(
      evento,
      this.rotulosX()[i],
      this.series()
        .filter((serie) => serie.valores[i] !== undefined)
        .map((serie) => ({
        texto: serie.nome,
        valor: `${formatar(serie.valores[i], this.casas())} ${this.unidade()}`,
      })),
    );
  }

  aoSair(): void {
    this.posicaoAtiva.set(null);
    this.dicas.esconder();
  }

  get topoY(): number {
    return this.topo;
  }

  get esqX(): number {
    return this.esq;
  }

  get direitaX(): number {
    return this.L - this.dir;
  }

  get baseY(): number {
    return this.A - this.base;
  }
}
