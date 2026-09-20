import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { DicaService } from '../dados/dica-service';
import { passoRedondo } from '../dados/escala-cor';
import { formatar, MESES, Serie } from '../dados/series';

interface Barra {
  x: number;
  y: number;
  largura: number;
  altura: number;
  raio: number;
  cor: string;
}

/** Barras agrupadas: 12 meses × até 3 capitais. */
@Component({
  selector: 'app-grafico-barras',
  templateUrl: './grafico-barras.html',
  styleUrl: './grafico-barras.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraficoBarras {
  private readonly dicas = inject(DicaService);

  readonly series = input.required<Serie[]>();
  readonly unidade = input('mm');

  readonly L = 560;
  readonly A = 300;
  private readonly esq = 44;
  private readonly dir = 12;
  // 28 e nao 14: a unidade do eixo fica acima da primeira grade, e com
  // margem menor o texto era cortado pela borda do viewBox
  private readonly topo = 28;
  private readonly base = 34;

  readonly meses = MESES;

  private readonly maximo = computed(() => {
    const valores = this.series().flatMap((serie) => serie.valores);
    const maior = valores.length ? Math.max(...valores) : 1;
    const passo = passoRedondo(maior);
    // teto nunca zero: mês inteiro sem chuva daria divisão por zero em y()
    return { passo, teto: Math.max(Math.ceil(maior / passo) * passo, passo) };
  });

  y(valor: number): number {
    return this.topo + (1 - valor / this.maximo().teto) * (this.A - this.topo - this.base);
  }

  readonly linhasGrade = computed(() => {
    const { passo, teto } = this.maximo();
    const linhas = [];
    for (let valor = 0; valor <= teto; valor += passo) {
      linhas.push({ valor, y: this.y(valor), rotulo: formatar(valor, 0) });
    }
    return linhas;
  });

  private readonly larguraGrupo = computed(() => (this.L - this.esq - this.dir) / 12);

  readonly larguraBarra = computed(() =>
    Math.max(3, (this.larguraGrupo() - 8) / Math.max(this.series().length, 1) - 2),
  );

  readonly grupos = computed(() =>
    this.meses.map((mes, m) => {
      const x0 = this.esq + m * this.larguraGrupo() + 4;
      const barras: Barra[] = this.series().map((serie, k) => {
        const valor = serie.valores[m] ?? 0;
        return {
          // 2px de respiro entre barras vizinhas
          x: x0 + k * (this.larguraBarra() + 2),
          y: this.y(valor),
          largura: this.larguraBarra(),
          // sem altura mínima: desenhar 2px onde o valor é 0 é mentir no gráfico
          altura: Math.max(0, this.y(0) - this.y(valor)),
          raio: Math.min(4, this.larguraBarra() / 2),
          cor: serie.cor,
        };
      });
      return { mes, m, x0, centro: x0 + (this.larguraGrupo() - 8) / 2, barras };
    }),
  );

  faixaX(m: number): number {
    return this.esq + m * this.larguraGrupo();
  }

  readonly larguraFaixa = computed(() => this.larguraGrupo());
  readonly alturaUtil = computed(() => this.A - this.topo - this.base);

  aoApontar(evento: PointerEvent, m: number): void {
    this.dicas.mostrar(
      evento,
      MESES[m],
      this.series().map((serie) => ({
        texto: serie.nome,
        valor: `${formatar(serie.valores[m] ?? 0, 0)} ${this.unidade()}`,
      })),
    );
  }

  esconder(): void {
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
