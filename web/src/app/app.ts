import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DicaService } from './dados/dica-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly dicas = inject(DicaService);
  readonly dica = this.dicas.dica;

  /**
   * Mantém a dica dentro da janela: perto da borda, ela vira pro outro lado.
   * `computed` e não método: no template, um método roda a cada ciclo de
   * detecção — e aqui isso seria a cada movimento do mouse, duas vezes.
   */
  readonly posicao = computed(() => {
    const dica = this.dica();
    if (!dica) return { left: '0px', top: '0px' };
    const largura = 250;
    const altura = 78;
    const esquerda = dica.x + largura + 22 > window.innerWidth ? dica.x - largura - 14 : dica.x + 14;
    const topo = dica.y - altura < 8 ? dica.y + 18 : dica.y - altura;
    return { left: `${Math.max(8, esquerda)}px`, top: `${topo}px` };
  });
}
