/**
 * DESIGNAR NÃO DÁ ACESSO — os três degraus, e a ordem entre eles.
 *
 * Nasceu do ciclo de simulação de 09/09: 24 das 50 designações estavam em
 * avaliadores sem conta, e a fila os mostrava iguais aos demais.
 */
import {
  classificarAcesso,
  motivoDoAcesso,
  type ContaEncontrada,
} from './acesso-do-avaliador.js';

const conta = (o: Partial<ContaEncontrada> = {}): ContaEncontrada => ({
  usuarioId: 'u1',
  username: 'fulano',
  statusConta: 'ATIVO',
  permissoesNoModulo: 1,
  ...o,
});

describe('classificarAcesso', () => {
  it('conta ativa com permissão no módulo: consegue responder', () => {
    expect(classificarAcesso(conta())).toBe('OK');
    expect(motivoDoAcesso('OK')).toBeNull();
  });

  it('⭐ sem conta nenhuma — o caso dos 24 do ciclo de simulação', () => {
    expect(classificarAcesso(null)).toBe('SEM_CONTA');
    expect(motivoDoAcesso('SEM_CONTA')).toMatch(/não tem conta/);
  });

  it('conta desativada', () => {
    expect(classificarAcesso(conta({ statusConta: 'INATIVO' }))).toBe('CONTA_INATIVA');
  });

  it('conta ativa, mas sem permissão no Gestão de Pessoas', () => {
    expect(classificarAcesso(conta({ permissoesNoModulo: 0 }))).toBe('SEM_PERMISSAO');
    expect(motivoDoAcesso('SEM_PERMISSAO')).toMatch(/nenhuma permissão/);
  });

  /**
   * ⚠️ A ORDEM é a mesma do login, e importa para a frase. Dizer "sem permissão"
   * de quem não tem conta mandaria alguém procurar a tela de permissões de um
   * usuário que não existe.
   */
  it('⚠️ sem conta vence sem permissão — a frase manda a pessoa ao lugar certo', () => {
    expect(classificarAcesso(null)).toBe('SEM_CONTA');
    expect(motivoDoAcesso('SEM_CONTA')).not.toMatch(/permissão/);
  });

  it('conta inativa vence sem permissão', () => {
    expect(classificarAcesso(conta({ statusConta: 'INATIVO', permissoesNoModulo: 0 }))).toBe(
      'CONTA_INATIVA',
    );
  });

  it('toda situação diferente de OK tem frase — nenhuma cai em silêncio', () => {
    for (const a of ['SEM_CONTA', 'CONTA_INATIVA', 'SEM_PERMISSAO'] as const) {
      expect(motivoDoAcesso(a)).toBeTruthy();
    }
  });
});
