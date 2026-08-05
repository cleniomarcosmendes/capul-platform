import { HttpException } from '@nestjs/common';
import { NfeService } from './nfe.service';

/**
 * Cooldown anti-loop da consulta por chave no caminho SEFAZ.
 *
 * Contexto: um clique no modo padrão dispara até 1 + MAX_FALLBACKS_PADRAO
 * chamadas SEFAZ (carrossel de consulentes); no modo "tentar todas", uma por
 * filial ativa. Reclicar a mesma chave não muda a resposta da SEFAZ — só
 * queima cota do CNPJ, que é o caminho para o cStat=656.
 */
describe('NfeService — cooldown SEFAZ por chave', () => {
  const CHAVE = '31260825834847000100550010027517211395813126';
  const FILIAL = '01';
  let service: NfeService;

  /** Chama o guard privado — é interno de propósito, o teste é do comportamento. */
  const checar = (chave: string, filial: string, todas: boolean) =>
    (service as unknown as {
      checarCooldownSefaz(c: string, f: string, t: boolean): void;
    }).checarCooldownSefaz(chave, filial, todas);

  beforeEach(() => {
    // Estado é estático (compartilhado no processo) — zerar entre casos.
    (NfeService as unknown as { ultimaConsultaSefaz: Map<string, number> }).ultimaConsultaSefaz.clear();
    // O guard só usa o logger e o estado estático; as dependências não entram.
    service = new NfeService(
      null as never, null as never, null as never, null as never, null as never,
      null as never, null as never, null as never, null as never, null as never,
    );
  });

  it('primeira consulta passa', () => {
    expect(() => checar(CHAVE, FILIAL, false)).not.toThrow();
  });

  it('repetir a mesma chave na janela é barrado com 429', () => {
    checar(CHAVE, FILIAL, false);
    try {
      checar(CHAVE, FILIAL, false);
      throw new Error('deveria ter barrado a segunda consulta');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const e = err as HttpException;
      expect(e.getStatus()).toBe(429);
      expect((e.getResponse() as { erro: string }).erro).toBe('CONSULTA_SEFAZ_EM_COOLDOWN');
    }
  });

  it('escalar para "tentar todas as filiais" NÃO é barrado pela consulta padrão', () => {
    // Fluxo legítimo: a consulta normal não acha e o usuário escala para a
    // varredura. Barrar aqui quebraria a busca da filial destinatária em
    // transferência interna.
    checar(CHAVE, FILIAL, false);
    expect(() => checar(CHAVE, FILIAL, true)).not.toThrow();
  });

  it('repetir a varredura completa é barrado', () => {
    checar(CHAVE, FILIAL, true);
    expect(() => checar(CHAVE, FILIAL, true)).toThrow(HttpException);
  });

  it('chave diferente não é afetada', () => {
    checar(CHAVE, FILIAL, false);
    const outra = '31260825834847000100550010027517211395813127';
    expect(() => checar(outra, FILIAL, false)).not.toThrow();
  });

  it('mesma chave em outra filial não é afetada', () => {
    checar(CHAVE, FILIAL, false);
    expect(() => checar(CHAVE, '02', false)).not.toThrow();
  });

  it('passada a janela, volta a permitir', () => {
    checar(CHAVE, FILIAL, false);
    const mapa = (NfeService as unknown as { ultimaConsultaSefaz: Map<string, number> })
      .ultimaConsultaSefaz;
    // Envelhece a entrada em vez de esperar 60s de relógio.
    mapa.set(`${CHAVE}:${FILIAL}:padrao`, Date.now() - 61_000);
    expect(() => checar(CHAVE, FILIAL, false)).not.toThrow();
  });
});
