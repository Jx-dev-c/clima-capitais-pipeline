import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ClimaService, MAX_SELECAO } from './clima-service';
import { Dados } from './tipos';

function capital(id: string, temp: number) {
  return {
    capital_id: id,
    capital: id.toUpperCase(),
    uf: id.toUpperCase(),
    regiao: 'Sul',
    latitude: -25,
    longitude: -49,
    populacao: 1,
    temp_media_c: temp,
    amplitude_media_c: 8,
    temp_max_absoluta_c: temp + 10,
    temp_min_absoluta_c: temp - 10,
    umidade_media_pct: 80,
    chuva_anual_media_mm: 1400,
    dias_observados: 2192,
    primeiro_dia: '2020-01-01',
    ultimo_dia: '2025-12-31',
  };
}

const DADOS = {
  capitais: [capital('pr', 18), capital('am', 28), capital('ce', 27), capital('rs', 20)],
  mensal: {},
  horario: {},
  diario: {},
  meta: { inicio: '2020-01-01', fim: '2025-12-31', dias: 59184, medicoes: 1420416, anos: ['2020'] },
  mapa: { largura: 1000, altura: 1000, estados: [], projecao: { x0: 0, y0: 0, escala: 1, dx: 0, dy: 0, cos: 1 } },
} as unknown as Dados;

describe('ClimaService', () => {
  let service: ClimaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClimaService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne('dados.json').flush(DADOS);
  });

  it('carrega as capitais numa requisição só', () => {
    expect(service.carregando()).toBe(false);
    expect(service.capitais()).toHaveLength(4);
    http.verify();
  });

  it('calcula a faixa nacional com o meio na média das capitais', () => {
    const faixa = service.faixaNacional();
    expect(faixa.min).toBe(18);
    expect(faixa.max).toBe(28);
    expect(faixa.meio).toBeCloseTo(23.25);
  });

  it('remove a capital ao clicar de novo', () => {
    service.definirSelecao(['pr', 'am']);
    service.alternar('am');
    expect(service.selecionadas()).toEqual(['pr']);
  });

  it('nunca fica sem nenhuma capital selecionada', () => {
    service.definirSelecao(['pr']);
    service.alternar('pr');
    expect(service.selecionadas()).toEqual(['pr']);
  });

  it('no limite, descarta a mais antiga em vez de ignorar o clique', () => {
    service.definirSelecao(['pr', 'am', 'ce']);
    service.alternar('rs');
    expect(service.selecionadas()).toEqual(['am', 'ce', 'rs']);
    expect(service.selecionadas()).toHaveLength(MAX_SELECAO);
  });

  it('ignora id inválido vindo da URL e cai no padrão', () => {
    service.definirSelecao(['xx', 'zz']);
    expect(service.selecionadas()).toEqual(['pr', 'am', 'ce']);
  });

  it('a principal é a primeira da seleção — é ela que o calendário detalha', () => {
    service.definirSelecao(['ce', 'pr']);
    expect(service.principal()?.capital_id).toBe('ce');
  });
});
