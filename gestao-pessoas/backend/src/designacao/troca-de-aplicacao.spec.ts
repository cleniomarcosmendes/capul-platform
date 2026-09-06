/**
 * ⭐ O DEFEITO SILENCIOSO QUE NASCEU DENTRO DO MÓDULO.
 *
 * `designar()` fazia `upsert` com `update: { avaliadorId, aplicacaoId, ... }`.
 * Mandar para outra aplicação alguém que já tinha avaliação no ciclo **movia a
 * pessoa**, sem aviso e sem olhar o status. O estrago é de duas naturezas:
 *
 *   1. as `Resposta` continuam apontando para as perguntas do modelo ANTIGO,
 *      enquanto `Avaliacao.aplicacaoId` passa a mandar ler as do NOVO;
 *   2. a apuração combina a `notaAvaliacao` congelada no envio — que é do
 *      questionário antigo — com o `pesoAvaliacao` e os `AplicacaoCriterio` da
 *      aplicação nova.
 *
 * O resultado é um número diferente, sem exceção, sem alerta e internamente
 * coerente. É a mesma família do que o módulo veio eliminar: o denominador 18
 * fixo e o `NVL` fora da soma também davam número errado sem acusar.
 *
 * A PRIMEIRA metade deste arquivo não testa código de guarda nenhum: ela mede a
 * aritmética, para que o motivo da recusa fique escrito em números e não em
 * adjetivos. A SEGUNDA testa a recusa.
 */
import { BadRequestException } from '@nestjs/common';
import { apurar } from '../calculo/apuracao.js';
import { calcularNotaAvaliacao, type ItemRespondido } from '../calculo/nota-avaliacao.js';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DesignacaoService } from './designacao.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 1 — a aritmética do estrago, com funções puras e sem mock nenhum.
// ─────────────────────────────────────────────────────────────────────────────

/** "Operação de Loja": 2 perguntas, peso 1, escala de 4. */
const PERGUNTAS_DO_MODELO_A = ['pA1', 'pA2'];
/** "Aprendizes": outro instrumento, outras perguntas. Ids diferentes de propósito. */
const PERGUNTAS_DO_MODELO_B = ['pB1', 'pB2'];

/** As respostas que o avaliador gravou — contra o modelo A. */
const RESPOSTAS_GRAVADAS = new Map<string, number>([
  ['pA1', 4],
  ['pA2', 2],
]);

/**
 * Réplica de `AvaliacaoService.itensRespondidos`: as perguntas vêm do modelo da
 * aplicação a que a avaliação aponta, e a resposta é buscada por `perguntaId`.
 */
function itensRespondidos(perguntasDoModelo: readonly string[]): ItemRespondido[] {
  return perguntasDoModelo.map((perguntaId) => ({
    perguntaId,
    grupoId: 'g1',
    peso: 1,
    maiorValor: 4,
    valorRespondido: RESPOSTAS_GRAVADAS.get(perguntaId) ?? (null as unknown as number),
  }));
}

describe('trocar de aplicação — a aritmética do estrago', () => {
  it('a nota do envio vem do modelo A: (4+2)/(4+4) = 75', () => {
    expect(calcularNotaAvaliacao(itensRespondidos(PERGUNTAS_DO_MODELO_A)).nota).toBe(75);
  });

  it('lidas contra o modelo B, as MESMAS respostas somem — nenhuma pergunta casa', () => {
    const itens = itensRespondidos(PERGUNTAS_DO_MODELO_B);

    // Nem uma. Os ids são de outro instrumento; o `respostas.get(p.id)` do
    // service devolve `undefined` para todas.
    expect(itens.every((i) => i.valorRespondido === null)).toBe(true);

    // E a tela do avaliador passaria a dizer "0 de 2 respondidas" enquanto
    // `Avaliacao.notaAvaliacao` continua gravado com 75.
    expect(itens.filter((i) => i.valorRespondido !== null)).toHaveLength(0);
  });

  it('⭐ a nota FINAL muda 10 pontos, sem erro nenhum, só por trocar a aplicação', () => {
    const notaDoQuestionario = 75; // congelada no envio, do modelo A
    const criterio = {
      criterioId: 'c-tempo-empresa',
      criterioNome: 'Tempo de Empresa',
      valorBruto: 12,
      valorTexto: null,
      faixaId: 'f-100',
      pontuacao: 100,
      semDado: false,
    };

    // Aplicação A — o questionário vale 70, o critério cadastral 30.
    const naAplicacaoA = apurar({
      notaAvaliacao: notaDoQuestionario,
      pesoAvaliacao: 70,
      criterios: [{ ...criterio, peso: 30 }],
    });

    // Aplicação B — aprendizes: o questionário vale 30, o critério 70.
    const naAplicacaoB = apurar({
      notaAvaliacao: notaDoQuestionario,
      pesoAvaliacao: 30,
      criterios: [{ ...criterio, peso: 70 }],
    });

    expect(naAplicacaoA.notaFinal).toBe(82.5); // (75×70 + 100×30) / 100
    expect(naAplicacaoB.notaFinal).toBe(92.5); // (75×30 + 100×70) / 100

    // O mesmo questionário, as mesmas respostas, a mesma pessoa — 10 pontos de
    // diferença porque alguém mudou a aplicação numa tela de designação.
    expect(naAplicacaoB.notaFinal - naAplicacaoA.notaFinal).toBe(10);

    // E o pior: nada nos dois resultados denuncia o problema. Nenhuma
    // renormalização, nenhum alerta — os dois são internamente coerentes.
    expect(naAplicacaoA.houveRenormalizacao).toBe(false);
    expect(naAplicacaoB.houveRenormalizacao).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTE 2 — a recusa, na API.
// ─────────────────────────────────────────────────────────────────────────────

const CICLO = 'ciclo-1';
const APP_A = 'app-operacao-loja';
const APP_B = 'app-aprendizes';
const AVALIADO = 'colab-joao';
const AVALIADOR = 'colab-supervisor';
const OUTRO_AVALIADOR = 'colab-gerente';
const RH = 'user-rh';

describe('DesignacaoService.designar — troca de aplicação', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: DesignacaoService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new DesignacaoService(prisma as never, auditoria as never);

    prisma.aplicacao.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === APP_A
          ? { id: APP_A, cicloId: CICLO, nome: 'Operação de Loja' }
          : where.id === APP_B
            ? { id: APP_B, cicloId: CICLO, nome: 'Aprendizes' }
            : null,
      ),
    );
    prisma.colaborador.findUnique.mockResolvedValue({
      id: AVALIADO,
      nome: 'JOAO DA SILVA',
      filial: '02',
      centroCusto: '21010101',
      cargoDescricao: 'REPOSITOR 2A',
    });
    prisma.avaliacao.upsert.mockResolvedValue({ id: 'aval-1' });
  });

  /** Já existe avaliação na aplicação A, no estado pedido. */
  const jaEstaNaAplicacaoA = (status: string, respostas: number) => {
    prisma.avaliacao.findUnique.mockResolvedValue({
      id: 'aval-1',
      aplicacaoId: APP_A,
      avaliadorId: AVALIADOR,
      status,
    });
    prisma.resposta.count.mockResolvedValue(respostas);
  };

  const designarPara = (aplicacaoId: string, avaliadorId = AVALIADOR) =>
    service.designar(aplicacaoId, AVALIADO, avaliadorId, RH, 'MANUAL');

  describe('recusa', () => {
    it('ENVIADA: recusa sempre, mesmo sem nenhuma resposta gravada', async () => {
      jaEstaNaAplicacaoA('ENVIADA', 0);
      await expect(designarPara(APP_B)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.avaliacao.upsert).not.toHaveBeenCalled();
    });

    it('ENVIADA: a mensagem diz onde está e o que fazer', async () => {
      jaEstaNaAplicacaoA('ENVIADA', 0);
      await expect(designarPara(APP_B)).rejects.toThrow(
        /JOAO DA SILVA.*ENVIADA.*"Operação de Loja".*reabertura/s,
      );
    });

    it('⭐ com respostas gravadas: recusa DIZENDO QUANTAS, para a tela poder perguntar', async () => {
      jaEstaNaAplicacaoA('EM_ANDAMENTO', 7);
      await expect(designarPara(APP_B)).rejects.toThrow(/7 resposta\(s\) gravada\(s\)/);
      expect(prisma.avaliacao.upsert).not.toHaveBeenCalled();
    });

    it('uma resposta só já basta — não há limiar', async () => {
      jaEstaNaAplicacaoA('EM_ANDAMENTO', 1);
      await expect(designarPara(APP_B)).rejects.toThrow(/1 resposta\(s\)/);
    });

    it('nada é gravado em auditoria quando a troca é recusada', async () => {
      jaEstaNaAplicacaoA('EM_ANDAMENTO', 3);
      await expect(designarPara(APP_B)).rejects.toThrow();
      expect(auditoria.registrar).not.toHaveBeenCalled();
    });
  });

  describe('permite', () => {
    it('PENDENTE e sem resposta: troca, e a auditoria guarda de onde veio', async () => {
      jaEstaNaAplicacaoA('PENDENTE', 0);
      await designarPara(APP_B);

      expect(prisma.avaliacao.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ aplicacaoId: APP_B }) }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'DESIGNAR_TROCA_APLICACAO',
          valorAnterior: expect.objectContaining({ aplicacaoId: APP_A, status: 'PENDENTE' }),
          valorNovo: expect.objectContaining({ aplicacaoId: APP_B }),
        }),
      );
    });

    it('primeira designação: não é troca, e a ação registrada é DESIGNAR', async () => {
      prisma.avaliacao.findUnique.mockResolvedValue(null);
      await designarPara(APP_A);
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ acao: 'DESIGNAR', valorAnterior: undefined }),
      );
    });

    it('⭐ trocar só o AVALIADOR, na mesma aplicação, não é bloqueado nem com nota enviada', async () => {
      // Nenhuma resposta muda de instrumento e nenhum modelo entra em jogo: a
      // guarda é sobre a APLICAÇÃO. Corrigir "designei o supervisor errado"
      // continua sendo um ato de uma linha para o RH.
      jaEstaNaAplicacaoA('ENVIADA', 11);
      await designarPara(APP_A, OUTRO_AVALIADOR);

      expect(prisma.avaliacao.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ avaliadorId: OUTRO_AVALIADOR }) }),
      );
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'DESIGNAR' }));
    });

    it('nem chega a contar respostas quando a aplicação não muda', async () => {
      jaEstaNaAplicacaoA('ENVIADA', 11);
      await designarPara(APP_A, OUTRO_AVALIADOR);
      expect(prisma.resposta.count).not.toHaveBeenCalled();
    });
  });

  it('autoavaliação continua barrada antes de tudo', async () => {
    jaEstaNaAplicacaoA('PENDENTE', 0);
    await expect(service.designar(APP_B, AVALIADO, AVALIADO, RH, 'MANUAL')).rejects.toThrow(
      /avaliador da própria avaliação/,
    );
  });
});
