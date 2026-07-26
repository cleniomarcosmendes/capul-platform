import { isoDeDataHora, dataBR, horaBR, mascaraData, mascaraHora } from '../dataHoraLocal';

describe('máscaras de digitação', () => {
  it('data: insere as barras conforme digita', () => {
    expect(mascaraData('2')).toBe('2');
    expect(mascaraData('26')).toBe('26');
    expect(mascaraData('2607')).toBe('26/07');
    expect(mascaraData('26072026')).toBe('26/07/2026');
  });

  it('hora: insere os dois-pontos conforme digita', () => {
    expect(mascaraHora('0')).toBe('0');
    expect(mascaraHora('07')).toBe('07');
    expect(mascaraHora('0730')).toBe('07:30');
  });

  it('ignora o que não é dígito e não deixa passar do tamanho', () => {
    expect(mascaraData('26/07/2026999')).toBe('26/07/2026');
    expect(mascaraHora('07:30:59')).toBe('07:30');
    expect(mascaraHora('ab12')).toBe('12');
  });

  it('apagar caractere volta ao formato anterior (não trava o backspace)', () => {
    expect(mascaraData('26/0')).toBe('26/0');
    expect(mascaraData('26/')).toBe('26');
    expect(mascaraHora('07:')).toBe('07');
  });

  it('o resultado da máscara é aceito pelo conversor', () => {
    expect(isoDeDataHora(mascaraData('26072026'), mascaraHora('0730'))).not.toBeNull();
  });
});

// Campos de TEXTO (sem picker nativo, p/ não quebrar o OTA) => o operador digita
// e a validação é nossa. 31/02 e hora 25:00 têm que morrer aqui, senão viram
// data "corrigida" silenciosamente pelo construtor do Date.

describe('isoDeDataHora', () => {
  it('converte data e hora digitadas com separadores', () => {
    const iso = isoDeDataHora('26/07/2026', '07:30');
    expect(iso).not.toBeNull();
    const d = new Date(iso!);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // julho
    expect(d.getDate()).toBe(26);
    expect(d.getHours()).toBe(7);
    expect(d.getMinutes()).toBe(30);
  });

  it('aceita sem separadores (digitação rápida no celular)', () => {
    expect(isoDeDataHora('26072026', '0730')).toBe(isoDeDataHora('26/07/2026', '07:30'));
  });

  it('interpreta como horário LOCAL do aparelho, não UTC', () => {
    const d = new Date(isoDeDataHora('26/07/2026', '07:30')!);
    expect(d.getHours()).toBe(7); // volta como 7h locais
  });

  it('recusa data incompleta', () => {
    expect(isoDeDataHora('26/07', '07:30')).toBeNull();
    expect(isoDeDataHora('26/07/2026', '7')).toBeNull();
  });

  it('recusa dia que não existe no mês (31/02 não pode virar 03/03)', () => {
    expect(isoDeDataHora('31/02/2026', '07:30')).toBeNull();
  });

  it('recusa mês e hora fora de faixa', () => {
    expect(isoDeDataHora('26/13/2026', '07:30')).toBeNull();
    expect(isoDeDataHora('26/07/2026', '25:00')).toBeNull();
    expect(isoDeDataHora('26/07/2026', '07:75')).toBeNull();
  });

  it('aceita 29/02 em ano bissexto e recusa em ano comum', () => {
    expect(isoDeDataHora('29/02/2024', '10:00')).not.toBeNull();
    expect(isoDeDataHora('29/02/2026', '10:00')).toBeNull();
  });
});

describe('dataBR / horaBR', () => {
  it('formata com zero à esquerda', () => {
    const d = new Date(2026, 6, 5, 8, 4);
    expect(dataBR(d)).toBe('05/07/2026');
    expect(horaBR(d)).toBe('08:04');
  });

  it('ida e volta: formata e reconverte para o mesmo instante', () => {
    const d = new Date(2026, 6, 26, 15, 20, 0, 0);
    const iso = isoDeDataHora(dataBR(d), horaBR(d));
    expect(new Date(iso!).getTime()).toBe(d.getTime());
  });
});
