/**
 * ⭐ A RÉGUA DE CONCEITOS, editável — e a fronteira que a decide.
 *
 * O critério NÃO é "só em RASCUNHO", e isso é decisão, não descuido: o conceito
 * é gravado como SNAPSHOT no resultado (`conceitoDescricao`), e ciclo ABERTO não
 * volta para RASCUNHO. Ver o comentário de `CicloService.ajustarConceitos`.
 */
import { BadRequestException } from '@nestjs/common';
import { createPrismaMock } from '../common/testing/prisma-mock.js';
import { CicloService } from './ciclo.service.js';

const CICLO = 'ciclo-1';
const RH = 'user-rh';
const REGUA = [
  { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 25 },
  { descricao: 'Adequado', limiteInferior: 25, limiteSuperior: 75 },
  { descricao: 'Excelente', limiteInferior: 75, limiteSuperior: 100 },
];

describe('ajustar a régua de conceitos', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let auditoria: { registrar: jest.Mock };
  let service: CicloService;

  beforeEach(() => {
    prisma = createPrismaMock();
    auditoria = { registrar: jest.fn() };
    service = new CicloService(prisma as never, auditoria as never);
    prisma.ciclo.findUnique.mockResolvedValue({ id: CICLO, status: 'ABERTO' });
    prisma.conceitoFaixa.findMany.mockResolvedValue([]);
    prisma.resultadoAvaliacao.count.mockResolvedValue(0);
  });

  it('com o ciclo ABERTO e ninguém apurado, MUDA — a fronteira é a apuração, não o status', async () => {
    await service.ajustarConceitos(CICLO, REGUA, RH);
    expect(prisma.conceitoFaixa.createMany).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ entidade: 'Ciclo', acao: 'AJUSTAR_CONCEITOS' }),
    );
  });

  /**
   * ⚠️ O conceito foi gravado junto com a nota. Mudar a régua depois deixaria o
   * resultado dizendo "Supera" e a régua dizendo outra coisa para o mesmo
   * número — duas verdades, e nada na tela denunciando.
   */
  it('com resultado apurado, RECUSA — e diz quantos, e por quê', async () => {
    prisma.resultadoAvaliacao.count.mockResolvedValue(37);
    await expect(service.ajustarConceitos(CICLO, REGUA, RH)).rejects.toThrow(BadRequestException);
    await expect(service.ajustarConceitos(CICLO, REGUA, RH)).rejects.toThrow(/apuradas: 37/);
    await expect(service.ajustarConceitos(CICLO, REGUA, RH)).rejects.toThrow(/gravado junto com a nota/);
    expect(prisma.conceitoFaixa.deleteMany).not.toHaveBeenCalled();
  });

  /**
   * ⭐ A MESMA função da abertura (`validarConceitos`) — não uma segunda cópia.
   * Se esta régua passasse aqui e fosse recusada ao abrir, a tela teria
   * autorizado o que o ato nega.
   */
  it('buraco na régua é recusado com a MESMA validação da abertura', async () => {
    const comBuraco = [
      { descricao: 'Baixo', limiteInferior: 0, limiteSuperior: 25 },
      { descricao: 'Alto', limiteInferior: 50, limiteSuperior: 100 },
    ];
    await expect(service.ajustarConceitos(CICLO, comBuraco, RH)).rejects.toThrow(BadRequestException);
    expect(prisma.conceitoFaixa.deleteMany).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ ACHADO AO CONFERIR NO AR (09/09): a tela travava no ciclo ENCERRADO e a
   * API aceitava. Tela mais restritiva que a API é o mesmo defeito do avesso —
   * um dos dois está mentindo, e quem descobre é quem tentar pela API.
   */
  it('ciclo ENCERRADO recusa, mesmo sem ninguém apurado', async () => {
    prisma.ciclo.findUnique.mockResolvedValue({
      id: CICLO,
      status: 'ENCERRADO',
      encerradoEm: new Date('2026-09-09'),
    });
    await expect(service.ajustarConceitos(CICLO, REGUA, RH)).rejects.toThrow(/encerrado/i);
    // ⭐ E a recusa ensina a saída, como todas as outras do módulo.
    await expect(service.ajustarConceitos(CICLO, REGUA, RH)).rejects.toThrow(/reabr/i);
    expect(prisma.conceitoFaixa.deleteMany).not.toHaveBeenCalled();
  });

  it('a trilha guarda a régua ANTERIOR — é o que responde "o que mudou"', async () => {
    prisma.conceitoFaixa.findMany.mockResolvedValueOnce([
      { descricao: 'Atende', limiteInferior: 50, limiteSuperior: 75 },
    ]);
    await service.ajustarConceitos(CICLO, REGUA, RH);
    const registro = auditoria.registrar.mock.calls[0][0];
    expect(registro.valorAnterior.conceitos[0]).toMatchObject({ descricao: 'Atende' });
    expect(registro.valorNovo.conceitos).toHaveLength(3);
  });
});
