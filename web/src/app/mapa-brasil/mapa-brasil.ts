import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ClimaService } from '../dados/clima-service';
import { DicaService } from '../dados/dica-service';
import { TemaService } from '../dados/tema-service';
import { corTemperatura } from '../dados/escala-cor';
import { corSerie, formatar } from '../dados/series';
import { Capital } from '../dados/tipos';

interface Ponto {
  capital: Capital;
  x: number;
  y: number;
  cor: string;
  selecionada: boolean;
  corSelecao: string;
}

@Component({
  selector: 'app-mapa-brasil',
  templateUrl: './mapa-brasil.html',
  styleUrl: './mapa-brasil.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaBrasil {
  private readonly clima = inject(ClimaService);
  private readonly dicas = inject(DicaService);
  private readonly tema = inject(TemaService);

  readonly mapa = computed(() => this.clima.dados()?.mapa);
  readonly faixa = this.clima.faixaNacional;

  /** Cinza do meio da escala — signal, pra recolorir quando o tema muda. */
  private readonly neutro = computed(() => this.tema.neutro());

  /**
   * Rótulo de capital selecionada. Capitais vizinhas (São Paulo e Rio, por
   * exemplo) escreviam uma por cima da outra: quem estiver a menos de 34 px
   * de uma já rotulada escreve embaixo do ponto, não em cima.
   */
  readonly rotulos = computed(() => {
    const escolhidos: { x: number; y: number }[] = [];
    return this.pontos()
      .filter((ponto) => ponto.selecionada)
      .map((ponto) => {
        const perto = escolhidos.some(
          (outro) => Math.abs(outro.x - ponto.x) < 90 && Math.abs(outro.y - ponto.y) < 34,
        );
        const y = perto ? ponto.y + 30 : ponto.y - 22;
        escolhidos.push({ x: ponto.x, y });
        return { nome: ponto.capital.capital, x: ponto.x, y };
      });
  });

  readonly pontos = computed<Ponto[]>(() => {
    const mapa = this.mapa();
    if (!mapa) return [];
    const { projecao } = mapa;
    const faixa = { ...this.faixa(), neutro: this.neutro() };

    return this.clima.capitais().map((capital) => {
      const indice = this.clima.indice(capital.capital_id);
      return {
        capital,
        x: (capital.longitude * projecao.cos - projecao.x0) * projecao.escala + projecao.dx,
        y: (-capital.latitude - projecao.y0) * projecao.escala + projecao.dy,
        cor: corTemperatura(capital.temp_media_c, faixa),
        selecionada: indice >= 0,
        corSelecao: corSerie(indice),
      };
    });
  });

  /** Gradiente da legenda, amostrado na mesma função que pinta os pontos. */
  readonly gradiente = computed(() => {
    const faixa = { ...this.faixa(), neutro: this.neutro() };
    const paradas = Array.from({ length: 11 }, (_, i) => {
      const valor = faixa.min + (faixa.max - faixa.min) * (i / 10);
      return `${corTemperatura(valor, faixa)} ${i * 10}%`;
    });
    return `linear-gradient(90deg, ${paradas.join(',')})`;
  });

  readonly rotuloMin = computed(() => formatar(this.faixa().min, 1) + ' °C');
  readonly rotuloMax = computed(() => formatar(this.faixa().max, 1) + ' °C');

  /** Texto lido por leitor de tela no lugar da cor do ponto. */
  rotuloDe(capital: Capital): string {
    return `${formatar(capital.temp_media_c, 1)} graus de media`;
  }

  alternar(id: string): void {
    this.clima.alternar(id);
  }

  aoTeclar(evento: KeyboardEvent, id: string): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      this.alternar(id);
    }
  }

  aoApontar(evento: PointerEvent, capital: Capital): void {
    this.dicas.mostrar(evento, `${capital.capital} — ${capital.uf}`, [
      { texto: 'Média', valor: `${formatar(capital.temp_media_c, 1)} °C` },
      {
        texto: 'Extremos',
        valor: `${formatar(capital.temp_min_absoluta_c, 1)} a ${formatar(capital.temp_max_absoluta_c, 1)} °C`,
      },
      { texto: 'Chuva', valor: `${formatar(capital.chuva_anual_media_mm, 0)} mm/ano` },
    ]);
  }

  esconder(): void {
    this.dicas.esconder();
  }
}
