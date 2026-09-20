import { describe, expect, it } from 'vitest';

import { corChuva, corTemperatura, misturar, passoRedondo, rampa } from './escala-cor';

const FAIXA = { min: 10, meio: 20, max: 30, neutro: '#eceff2' };

describe('misturar', () => {
  it('devolve os extremos sem alterar', () => {
    expect(misturar('#000000', '#ffffff', 0)).toBe('#000000');
    expect(misturar('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('interpola pelo meio', () => {
    expect(misturar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('rampa', () => {
  it('prende valores fora de 0..1 nos extremos', () => {
    const paradas = ['#000000', '#ffffff'];
    expect(rampa(paradas, -3)).toBe('#000000');
    expect(rampa(paradas, 9)).toBe('#ffffff');
  });
});

describe('corTemperatura', () => {
  it('usa o neutro exatamente no meio da faixa', () => {
    expect(corTemperatura(20, FAIXA)).toBe(FAIXA.neutro);
  });

  it('vai para o azul abaixo do meio e para o vermelho acima', () => {
    const frio = corTemperatura(10, FAIXA);
    const quente = corTemperatura(30, FAIXA);
    const canal = (hex: string, i: number) => parseInt(hex.substring(i, i + 2), 16);

    // azul: canal B domina; vermelho: canal R domina
    expect(canal(frio, 5)).toBeGreaterThan(canal(frio, 1));
    expect(canal(quente, 1)).toBeGreaterThan(canal(quente, 5));
  });

  it('não estoura quando a faixa é degenerada (um único valor)', () => {
    const plana = { min: 25, meio: 25, max: 25, neutro: '#eceff2' };
    expect(corTemperatura(25, plana)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('corChuva', () => {
  it('trata dia seco como neutro, não como a cor mais clara da rampa', () => {
    expect(corChuva(0, 100, '#eceff2')).toBe('#eceff2');
  });

  it('é monotônica: mais chuva, cor mais escura', () => {
    const luminancia = (hex: string) =>
      [1, 3, 5].reduce((soma, i) => soma + parseInt(hex.substring(i, i + 2), 16), 0);

    expect(luminancia(corChuva(5, 100, '#eceff2'))).toBeGreaterThan(luminancia(corChuva(80, 100, '#eceff2')));
  });
});

describe('passoRedondo', () => {
  it('escolhe passo que deixa o eixo com números inteiros legíveis', () => {
    expect(passoRedondo(35)).toBe(10);
    expect(passoRedondo(190)).toBe(50);
    expect(passoRedondo(700)).toBe(200);
  });
});
