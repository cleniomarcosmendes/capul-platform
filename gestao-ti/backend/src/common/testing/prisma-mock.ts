/* eslint-disable @typescript-eslint/no-explicit-any */

function modelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: {} }),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

export function createPrismaMock(): Record<string, any> {
  return {
    chamado: modelMock(),
    historicoChamado: modelMock(),
    equipeTI: modelMock(),
    membroEquipe: modelMock(),
    slaDefinicao: modelMock(),
    notificacao: modelMock(),
    software: modelMock(),
    softwareModulo: modelMock(),
    softwareLicenca: modelMock(),
    contrato: modelMock(),
    parcelaContrato: modelMock(),
    parcelaRateioItem: modelMock(),
    rateioTemplate: modelMock(),
    rateioTemplateItem: modelMock(),
    anexoContrato: modelMock(),
    contratoRenovacaoReg: modelMock(),
    naturezaContrato: modelMock(),
    tipoContratoConfig: modelMock(),
    contratoHistorico: modelMock(),
    ordemServico: modelMock(),
    registroParada: modelMock(),
    projeto: modelMock(),
    apontamentoHoras: modelMock(),
    riscoProjeto: modelMock(),
    ativo: modelMock(),
    artigoConhecimento: modelMock(),
    filial: modelMock(),
    usuario: modelMock(),
  };
}
