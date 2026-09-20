import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Cinza do meio da escala divergente, por tema. */
const NEUTRO = { claro: '#eceff2', escuro: '#383835' } as const;

/**
 * O tema como signal, não como leitura de CSS.
 *
 * A cor neutra vinha de `getComputedStyle` dentro de um `computed` — que não lê
 * signal nenhum, então calculava uma vez e congelava: trocar o tema com a
 * página aberta deixava o mapa com o cinza do tema anterior (a legenda ficava
 * cinza-chumbo sobre fundo claro). Aqui a fonte da verdade é o `matchMedia`
 * mais o atributo `data-theme`, ambos observados de verdade.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly _escuro = signal(this.lerTemaAtual());
  readonly escuro = this._escuro.asReadonly();

  constructor() {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => this._escuro.set(this.lerTemaAtual());

    consulta.addEventListener('change', aoMudar);
    // o atributo data-theme é o carimbo de escolha explícita do visitante
    const observador = new MutationObserver(aoMudar);
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    inject(DestroyRef).onDestroy(() => {
      consulta.removeEventListener('change', aoMudar);
      observador.disconnect();
    });
  }

  /** Cor do meio da escala divergente no tema atual. */
  neutro(): string {
    return this._escuro() ? NEUTRO.escuro : NEUTRO.claro;
  }

  private lerTemaAtual(): boolean {
    const carimbo = document.documentElement.getAttribute('data-theme');
    if (carimbo === 'dark') return true;
    if (carimbo === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
