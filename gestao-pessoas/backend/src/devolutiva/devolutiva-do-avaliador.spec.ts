/**
 * ⭐⭐ ETAPA 2 — O AVALIADOR VÊ.
 *
 * ⛳ O PORTÃO: ele alcança a memória COMPLETA das pessoas que **ele** avaliou e
 * que o **RH liberou** — e mais nada.
 *
 * ⚠️ Este spec cobra também a **ORDEM** das checagens, que não é detalhe: com a
 * "é sua?" antes da "é a própria?", quem tentasse abrir a própria avaliação
 * receberia *"esta avaliação não é sua"* — **falso**, porque ela é dele, e é
 * justamente por ser dele que ele não pode vê-la. E o rastro que a §8 da spec
 * exige não seria gravado.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { DevolutivaService } from './devolutiva.service.js';

const EU = 'col-chefe';
const USUARIO = 'user-chefe';
const AV = 'aval-1';
const LIBERADA_EM = new Date('2026-09-13T10:00:00Z');

/** A memória que o `ResultadoService` devolveria — só o que basta para provar. */
const MEMORIA = {
  id: 'res-1',
  notaFinal: 69.9,
  conceito: 'Atende',
  porQuestao: [{ perguntaId: 'p1', enunciado: 'Assiduidade', respostaEscolhida: 'Raramente falta' }],
  criterios: [
    { nome: 'ESCOLARIDADE', valorTexto: 'Superior completo', faixaRotulo: 'Superior', pontuacao: 75, peso: 10 },
    { nome: 'TEMPO_EMPRESA', valorBruto: 8, faixaRotulo: 'de 5 a 10 anos', pontuacao: 75, peso: 10 },
    { nome: 'TEMPO_FUNCAO', valorBruto: 1, faixaRotulo: 'menos de 2 anos', pontuacao: 25, peso: 10 },
  ],
};

describe('a devolutiva do lado do avaliador', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let resultados: { memoria: jest.Mock };
  let service: DevolutivaService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    resultados = { memoria: jest.fn().mockResolvedValue(MEMORIA) };
    service = new DevolutivaService(prisma as never, auditoria as never, resultados as never);
  });

  /** `avaliadorId` é EU por padrão — quem testa "de outro" troca. */
  const cenario = (over: Record<string, unknown> = {}, comResultado = true) => {
    prisma.avaliacao.findUnique.mockResolvedValue({
      id: AV,
      avaliadoId: 'col-subordinado',
      avaliadorId: EU,
      devolutivaLiberadaEm: LIBERADA_EM,
      ...over,
    });
    prisma.resultadoAvaliacao.findUnique.mockResolvedValue(comResultado ? { id: 'res-1' } : null);
  };

  const abrir = () =>
    service.paraOAvaliador(AV, { colaboradorId: EU, usuarioId: USUARIO, ip: '10.0.0.1' });

  describe('⛳ A MATRIZ', () => {
    it('avaliação que ele fez, LIBERADA → memória completa', async () => {
      cenario();
      const r = await abrir();

      expect(r.notaFinal).toBe(69.9);
      expect(r.conceito).toBe('Atende');
      expect(r.porQuestao).toHaveLength(1);
      // ⭐ Os TRÊS critérios, com valor, faixa, pontos e peso — decisão do
      //   Clenio em 13/09: sem eles o avaliador não explica por que a final é
      //   69,90 quando o questionário deu 63,19.
      expect(r.criterios.map((c) => c.nome)).toEqual([
        'ESCOLARIDADE',
        'TEMPO_EMPRESA',
        'TEMPO_FUNCAO',
      ]);
      expect(r.criterios[2]).toMatchObject({ faixaRotulo: 'menos de 2 anos', pontuacao: 25, peso: 10 });
      expect(r.devolutivaLiberadaEm).toEqual(LIBERADA_EM);
    });

    it('⭐ apurada e NÃO liberada → 403 TEMPORÁRIO, e a frase diz que não é permissão', async () => {
      cenario({ devolutivaLiberadaEm: null });
      await expect(abrir()).rejects.toBeInstanceOf(ForbiddenException);
      await expect(abrir()).rejects.toThrow(/RH ainda não liberou/);
      await expect(abrir()).rejects.toThrow(/não é falta de permissão sua/);
      expect(resultados.memoria).not.toHaveBeenCalled();
    });

    it('NÃO apurada → o MESMO 403 de "não liberada", e isso é decisão', async () => {
      // Do lado dele os dois estados são indistinguíveis e a ação é a mesma:
      // esperar. Separar as frases vazaria estado interno do RH ("já apuraram,
      // mas não liberaram") sem lhe dar nada que ele possa fazer.
      cenario({ devolutivaLiberadaEm: null }, false);
      await expect(abrir()).rejects.toThrow(/RH ainda não liberou/);
    });

    it('avaliação de OUTRO avaliador, liberada → 403 DEFINITIVO, com outra frase', async () => {
      cenario({ avaliadorId: 'col-outro-chefe' });
      await expect(abrir()).rejects.toBeInstanceOf(ForbiddenException);
      await expect(abrir()).rejects.toThrow(/não é sua/);
      expect(resultados.memoria).not.toHaveBeenCalled();
    });

    it('⭐⭐ a avaliação em que ELE é o avaliado → 403 COM AUDITORIA', async () => {
      cenario({ avaliadoId: EU, avaliadorId: 'col-superior' });
      await expect(abrir()).rejects.toThrow(/sua própria avaliação não fica visível/);

      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          entidade: 'Avaliacao',
          entidadeId: AV,
          acao: 'ACESSO_NEGADO_PROPRIO_AVALIADO:devolutiva',
          usuarioId: USUARIO,
          ip: '10.0.0.1',
        }),
      );
    });
  });

  describe('⚠️ A ORDEM das checagens é regra, não detalhe', () => {
    it('a PRÓPRIA vence a de "não é sua" — senão a frase mente e o rastro some', async () => {
      // Quem é o avaliado e NÃO é o avaliador falharia nas duas checagens. Se a
      // de escopo viesse primeiro, ele leria "esta avaliação não é sua" — falso,
      // ela é dele — e nada seria auditado.
      cenario({ avaliadoId: EU, avaliadorId: 'col-superior' });
      await expect(abrir()).rejects.toThrow(/sua própria avaliação/);
      await expect(abrir()).rejects.not.toThrow(/não é sua/);
      expect(auditoria.registrar).toHaveBeenCalled();
    });

    it('a de ESCOPO vence a de liberação — "não é sua" não vira "aguarde o RH"', async () => {
      // Invertida, o avaliador de outra equipe ficaria esperando para sempre uma
      // liberação que não mudaria nada para ele.
      cenario({ avaliadorId: 'col-outro-chefe', devolutivaLiberadaEm: null });
      await expect(abrir()).rejects.toThrow(/não é sua/);
      await expect(abrir()).rejects.not.toThrow(/ainda não liberou/);
    });
  });

  describe('⭐ dois 403 que NÃO são o mesmo 403', () => {
    it('o temporário diz o que vai acontecer; o definitivo diz de quem é', async () => {
      cenario({ devolutivaLiberadaEm: null });
      const temporario = await abrir().catch((e: Error) => e.message);
      cenario({ avaliadorId: 'outro' });
      const definitivo = await abrir().catch((e: Error) => e.message);

      expect(temporario).not.toEqual(definitivo);
      // A família do "403 que parece falta de permissão" já custou três vezes
      // neste módulo: a pessoa vai ao Configurador pedir acesso que já tem.
      expect(temporario).toMatch(/aparecem aqui/);
      expect(definitivo).toMatch(/conduzida por quem avaliou/);
    });
  });

  describe('a chave, não o conteúdo', () => {
    it('⭐ traduz avaliacaoId → resultadoId e REUSA memoria(), sem remontar nada', async () => {
      cenario();
      await abrir();
      expect(prisma.resultadoAvaliacao.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { avaliacaoId: AV } }),
      );
      // ⚠️ E passa o CONTEXTO adiante: a auditoria de leitura é a do memoria(),
      //    que já isenta o avaliador designado. Duas trilhas para o mesmo acesso
      //    fariam a contagem de leituras mentir.
      expect(resultados.memoria).toHaveBeenCalledWith('res-1', {
        colaboradorId: EU,
        usuarioId: USUARIO,
        ip: '10.0.0.1',
      });
    });

    it('liberada mas SEM resultado é incoerência de estado → 404 que manda procurar o RH', async () => {
      // `liberar` recusa avaliação sem apuração, então este nulo só acontece se
      // a avaliação foi reaberta depois de liberada. Não é "aguarde".
      cenario({}, false);
      await expect(abrir()).rejects.toBeInstanceOf(NotFoundException);
      await expect(abrir()).rejects.toThrow(/deve ter sido reaberta/);
    });

    it('avaliação inexistente é 404', async () => {
      prisma.avaliacao.findUnique.mockResolvedValue(null);
      await expect(abrir()).rejects.toBeInstanceOf(NotFoundException);
    });

    it('⚠️ sem colaborador resolvido não passa — nem por acidente de nulo', async () => {
      // `ehProprioAvaliado` recusa afirmar com id nulo; a checagem de escopo
      // precisa barrar explicitamente, senão `null !== 'col-x'` já resolveria
      // por acaso e a garantia dependeria do acidente.
      cenario();
      await expect(
        service.paraOAvaliador(AV, { colaboradorId: null, usuarioId: USUARIO }),
      ).rejects.toThrow(/não é sua/);
    });
  });
});
