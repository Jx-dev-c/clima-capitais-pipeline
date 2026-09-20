import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { Capital, Dados, Metrica } from './tipos';

/** Quantas capitais podem ser comparadas ao mesmo tempo. */
export const MAX_SELECAO = 3;

/** Abertura padrão: extremos do país (mais fria, mais quente e uma do litoral). */
const PADRAO = ['pr', 'am', 'ce'];

@Injectable({ providedIn: 'root' })
export class ClimaService {
  private readonly http = inject(HttpClient);

  /**
   * O JSON inteiro (~610 KB) é carregado de uma vez: é dado histórico fechado,
   * então uma requisição no boot vale mais que várias sob demanda.
   *
   * O estado tem três valores, não dois: sem `erro`, uma falha de rede ficaria
   * indistinguível de "ainda carregando" e a tela travaria no spinner.
   */
  private readonly resposta = toSignal(
    this.http.get<Dados>('dados.json').pipe(
      map((dados) => ({ dados, erro: false })),
      catchError(() => of({ dados: null, erro: true })),
    ),
    { initialValue: { dados: null, erro: false } },
  );

  readonly dados = computed(() => this.resposta().dados);
  readonly erro = computed(() => this.resposta().erro);
  readonly carregando = computed(() => !this.resposta().dados && !this.resposta().erro);

  readonly capitais = computed<Capital[]>(() => this.dados()?.capitais ?? []);
  readonly porId = computed(() => new Map(this.capitais().map((c) => [c.capital_id, c])));

  private readonly _selecionadas = signal<string[]>(PADRAO);
  /**
   * Filtra contra o dado carregado: o padrão é escrito à mão, e uma capital que
   * saísse do dataset viraria `undefined` em todo consumidor.
   */
  readonly selecionadas = computed(() => {
    const existe = this.porId();
    if (!existe.size) return this._selecionadas();
    const validas = this._selecionadas().filter((id) => existe.has(id));
    return validas.length ? validas : [this.capitais()[0].capital_id];
  });
  /** A primeira selecionada é a que o calendário e a leitura detalham. */
  readonly principal = computed(() => this.porId().get(this.selecionadas()[0]));

  readonly metrica = signal<Metrica>('temp');

  /** Faixa do mapa: extremos das médias, com o meio na média nacional. */
  readonly faixaNacional = computed(() => {
    const medias = this.capitais().map((c) => c.temp_media_c);
    if (!medias.length) return { min: 0, meio: 0, max: 0 };
    return {
      min: Math.min(...medias),
      max: Math.max(...medias),
      meio: medias.reduce((a, b) => a + b, 0) / medias.length,
    };
  });

  /**
   * Clicar numa capital já selecionada a remove; numa nova, adiciona. No
   * limite, a mais antiga sai — assim o clique nunca "não faz nada", que é
   * pior do que trocar a comparação.
   */
  alternar(id: string): void {
    const atuais = this.selecionadas();
    if (atuais.includes(id)) {
      if (atuais.length === 1) return; // sempre resta uma pra detalhar
      this._selecionadas.set(atuais.filter((outro) => outro !== id));
      return;
    }
    const base = atuais.length === MAX_SELECAO ? atuais.slice(1) : atuais;
    this._selecionadas.set([...base, id]);
  }

  definirSelecao(ids: string[]): void {
    const validos = ids.filter((id) => this.porId().has(id)).slice(0, MAX_SELECAO);
    this._selecionadas.set(validos.length ? validos : PADRAO);
  }

  /** Índice da capital na seleção — é ele que define a cor da série. */
  indice(id: string): number {
    return this.selecionadas().indexOf(id);
  }
}
