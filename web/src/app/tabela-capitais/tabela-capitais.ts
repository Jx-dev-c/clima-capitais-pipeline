import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { ClimaService } from '../dados/clima-service';

/**
 * A tabela não é só acessibilidade: três cores da paleta ficam abaixo de 3:1
 * de contraste no tema claro, e a regra é oferecer os números em texto quando
 * isso acontece.
 */
@Component({
  selector: 'app-tabela-capitais',
  imports: [DecimalPipe],
  templateUrl: './tabela-capitais.html',
  styleUrl: './tabela-capitais.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabelaCapitais {
  private readonly clima = inject(ClimaService);

  readonly linhas = computed(() =>
    [...this.clima.capitais()].sort((a, b) => b.temp_media_c - a.temp_media_c),
  );

  readonly selecionadas = this.clima.selecionadas;

  alternar(id: string): void {
    this.clima.alternar(id);
  }
}
