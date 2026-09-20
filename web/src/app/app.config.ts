import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';

// sem isto o DecimalPipe cai no locale padrão en-US e a tabela imprime
// "1,589 mm" — que em português se lê "um vírgula cinco"
registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    // withComponentInputBinding: o parâmetro da rota chega como input do
    // componente (`capitais`), sem precisar assinar o ActivatedRoute
    provideRouter(routes, withComponentInputBinding()),
  ],
};
