import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { CalendarioAnual } from '../calendario-anual/calendario-anual';
import { ClimaService, MAX_SELECAO } from '../dados/clima-service';
import { GraficoBarras } from '../grafico-barras/grafico-barras';
import { GraficoLinhas } from '../grafico-linhas/grafico-linhas';
import { MapaBrasil } from '../mapa-brasil/mapa-brasil';
import { TabelaCapitais } from '../tabela-capitais/tabela-capitais';
import { corSerie, formatar, MESES, Serie } from '../dados/series';

@Component({
  selector: 'app-painel',
  imports: [MapaBrasil, GraficoLinhas, GraficoBarras, CalendarioAnual, TabelaCapitais],
  templateUrl: './painel.html',
  styleUrl: './painel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Painel {
  private readonly clima = inject(ClimaService);
  private readonly router = inject(Router);

  /** Vem da rota `/:capitais` (ex.: `/pr,am,ce`) — o link guarda a comparação. */
  readonly capitais = input<string>('');

  readonly maxSelecao = MAX_SELECAO;
  readonly carregando = this.clima.carregando;
  readonly erro = this.clima.erro;
  readonly totalCapitais = computed(() => this.clima.capitais().length);
  readonly meta = computed(() => this.clima.dados()?.meta);
  readonly principal = this.clima.principal;

  readonly selecionadas = computed(() =>
    this.clima.selecionadas().map((id, i) => ({ capital: this.clima.porId().get(id)!, cor: corSerie(i) })),
  );

  readonly rotulosMes = MESES;
  readonly ticksMes = [0, 2, 4, 6, 8, 10, 11];
  readonly rotulosHora = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0') + 'h');
  readonly ticksHora = [0, 4, 8, 12, 16, 20, 23];

  constructor() {
    // rota -> estado
    effect(() => {
      const daRota = this.capitais();
      if (daRota) this.clima.definirSelecao(daRota.split(','));
    });
    // estado -> rota (URL sempre compartilhável)
    effect(() => {
      const ids = this.clima.selecionadas();
      if (!this.clima.carregando()) {
        void this.router.navigate(['/', ids.join(',')], { replaceUrl: true });
      }
    });
  }

  private serie(valores: (id: string) => number[]): Serie[] {
    return this.clima.selecionadas().map((id, i) => {
      const capital = this.clima.porId().get(id)!;
      return { id, nome: capital.capital, uf: capital.uf, cor: corSerie(i), valores: valores(id) };
    });
  }

  readonly seriesMensais = computed(() =>
    this.serie((id) => (this.clima.dados()?.mensal[id] ?? []).map((linha) => linha[1])),
  );

  readonly seriesHorarias = computed(() => this.serie((id) => this.clima.dados()?.horario[id] ?? []));

  readonly seriesChuva = computed(() =>
    this.serie((id) => (this.clima.dados()?.mensal[id] ?? []).map((linha) => linha[4])),
  );

  /** Quatro números que resumem o país — ficam no topo, antes de qualquer gráfico. */
  readonly destaques = computed(() => {
    const capitais = this.clima.capitais();
    const meta = this.meta();
    if (!capitais.length || !meta) return [];

    const maisQuente = capitais.reduce((a, b) => (a.temp_media_c > b.temp_media_c ? a : b));
    const maisFria = capitais.reduce((a, b) => (a.temp_media_c < b.temp_media_c ? a : b));
    const maisChuvosa = capitais.reduce((a, b) => (a.chuva_anual_media_mm > b.chuva_anual_media_mm ? a : b));

    return [
      {
        rotulo: 'Medições horárias',
        valor: formatar(meta.medicoes / 1e6, 2) + ' mi',
        nota: `${formatar(meta.dias, 0)} dias × ${capitais.length} capitais`,
      },
      {
        rotulo: 'Capital mais quente',
        valor: formatar(maisQuente.temp_media_c, 1) + ' °C',
        nota: `${maisQuente.capital} (${maisQuente.uf}), média do período`,
      },
      {
        rotulo: 'Capital mais fria',
        valor: formatar(maisFria.temp_media_c, 1) + ' °C',
        nota: `${maisFria.capital} (${maisFria.uf}), mínima de ${formatar(maisFria.temp_min_absoluta_c, 1)} °C`,
      },
      {
        rotulo: 'Mais chuvosa',
        valor: formatar(maisChuvosa.chuva_anual_media_mm, 0) + ' mm',
        nota: `${maisChuvosa.capital} (${maisChuvosa.uf}), de chuva por ano`,
      },
    ];
  });

  readonly leitura = computed(() => {
    const c = this.principal();
    if (!c) return [];
    return [
      { rotulo: 'Média', valor: formatar(c.temp_media_c, 1) + ' °C', nota: 'no período inteiro' },
      { rotulo: 'Amplitude típica', valor: formatar(c.amplitude_media_c, 1) + ' °C', nota: 'entre mínima e máxima do dia' },
      { rotulo: 'Máxima absoluta', valor: formatar(c.temp_max_absoluta_c, 1) + ' °C', nota: 'recorde dos seis anos' },
      { rotulo: 'Mínima absoluta', valor: formatar(c.temp_min_absoluta_c, 1) + ' °C', nota: 'recorde dos seis anos' },
      { rotulo: 'Chuva', valor: formatar(c.chuva_anual_media_mm, 0) + ' mm', nota: 'por ano, em média' },
      { rotulo: 'Umidade', valor: formatar(c.umidade_media_pct, 0) + '%', nota: 'média do ar' },
    ];
  });

  readonly periodo = computed(() => {
    const meta = this.meta();
    return meta ? `${meta.inicio.slice(0, 4)}–${meta.fim.slice(0, 4)}` : '—';
  });

  remover(id: string): void {
    this.clima.alternar(id);
  }

  recarregar(): void {
    window.location.reload();
  }
}
