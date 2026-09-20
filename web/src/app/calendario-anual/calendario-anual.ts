import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ClimaService } from '../dados/clima-service';
import { DicaService } from '../dados/dica-service';
import { TemaService } from '../dados/tema-service';
import { corChuva, corTemperatura } from '../dados/escala-cor';
import { formatar, MESES } from '../dados/series';
import { AnoDiario } from '../dados/tipos';

interface Celula {
  x: number;
  dia: number;
  cor: string;
  valor: number;
}

interface LinhaAno {
  ano: string;
  y: number;
  celulas: Celula[];
}

/** Um quadradinho por dia: 6 anos × 365 dias da capital principal. */
@Component({
  selector: 'app-calendario-anual',
  imports: [DecimalPipe],
  templateUrl: './calendario-anual.html',
  styleUrl: './calendario-anual.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarioAnual {
  private readonly clima = inject(ClimaService);
  private readonly dicas = inject(DicaService);
  private readonly tema = inject(TemaService);

  readonly principal = this.clima.principal;
  readonly metrica = this.clima.metrica;

  readonly larguraCelula = 2.9;
  readonly alturaLinha = 26;
  private readonly esq = 38;
  private readonly topo = 22;

  readonly L = this.esq + 366 * this.larguraCelula + 8;

  /** Primeiro dia de cada mês num ano comum — serve de régua no topo. */
  private readonly iniciosDeMes = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  readonly rotulosMes = computed(() =>
    this.iniciosDeMes.map((dia, m) => ({ mes: MESES[m], x: this.esq + dia * this.larguraCelula })),
  );

  private readonly serie = computed(() => {
    const dados = this.clima.dados();
    const capital = this.principal();
    if (!dados || !capital) return null;

    const porAno = dados.diario[capital.capital_id];
    if (!porAno) return null;
    // tipado como chave de AnoDiario: sem isso o acesso vira index de string
    const chave: keyof AnoDiario = this.metrica() === 'temp' ? 't' : 'c';
    // só os anos que esta capital realmente tem: `meta.anos` é o universo,
    // e uma capital pode não cobrir todos
    const anos = dados.meta.anos.filter((ano) => porAno[ano]);
    if (!anos.length) return null;
    const valores = anos.flatMap((ano) => porAno[ano][chave]);
    return {
      anos,
      porAno,
      chave,
      min: Math.min(...valores),
      max: Math.max(...valores),
      meio: valores.reduce((a, b) => a + b, 0) / valores.length,
    };
  });

  readonly A = computed(() => this.topo + (this.serie()?.anos.length ?? 0) * this.alturaLinha + 6);

  readonly linhas = computed<LinhaAno[]>(() => {
    const serie = this.serie();
    if (!serie) return [];
    const neutro = this.tema.neutro();
    const temp = this.metrica() === 'temp';

    return serie.anos.map((ano, i) => ({
      ano,
      y: this.topo + i * this.alturaLinha,
      celulas: serie.porAno[ano][serie.chave].map((valor, dia) => ({
        dia,
        valor,
        x: this.esq + dia * this.larguraCelula,
        cor: temp
          ? corTemperatura(valor, { min: serie.min, meio: serie.meio, max: serie.max, neutro })
          : corChuva(valor, serie.max, neutro),
      })),
    }));
  });

  readonly alturaCelula = this.alturaLinha - 8;

  aoApontar(evento: PointerEvent, ano: string, celula: Celula): void {
    const data = new Date(Date.UTC(Number(ano), 0, 1 + celula.dia));
    const titulo = data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const linha =
      this.metrica() === 'temp'
        ? { texto: 'Média do dia', valor: `${formatar(celula.valor, 1)} °C` }
        : { texto: 'Chuva', valor: `${formatar(celula.valor, 1)} mm` };
    this.dicas.mostrar(evento, titulo, [linha]);
  }

  esconder(): void {
    this.dicas.esconder();
  }

  trocar(metrica: 'temp' | 'chuva'): void {
    this.clima.metrica.set(metrica);
  }

  get esqX(): number {
    return this.esq;
  }
}
