import { Routes } from '@angular/router';

import { Painel } from './painel/painel';

/**
 * A rota guarda a comparação: `/pr,am,ce` abre o painel já comparando as três.
 * É o que permite mandar um link apontando pro que você está vendo.
 */
export const routes: Routes = [
  { path: '', component: Painel },
  { path: ':capitais', component: Painel },
];
