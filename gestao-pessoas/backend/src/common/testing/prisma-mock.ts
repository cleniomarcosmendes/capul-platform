
function modelMock() {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    /**
     * ⚠️ Devolve ciclo ABERTO por padrão. `findUniqueOrThrow` entrou aqui em
     * 07/09 com a guarda do ciclo encerrado: sem um padrão, TODO spec que grava
     * teria de mockar o ciclo, e o teste passaria a falar de um assunto que não
     * é o dele. Quem testa a guarda mocka o encerrado explicitamente.
     */
    findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'ABERTO', encerradoEm: null }),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({ ultimoNumero: 1 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  };
}

/** Mock do PrismaService do gestao-pessoas (schema rh) — modelos + $transaction (chama o cb com o
 *  próprio mock como tx) + $queryRaw. */
export function createPrismaMock(): Record<string, any> {
  const m: Record<string, any> = {
    colaborador: modelMock(),
    cargo: modelMock(),
    colaboradorTreinamento: modelMock(),
    modelo: modelMock(),
    modeloVersao: modelMock(),
    classificacao: modelMock(),
    arranjoGrupo: modelMock(),
    arranjoPergunta: modelMock(),
    criterio: modelMock(),
    criterioValorInformado: modelMock(),
    pergunta: modelMock(),
    perguntaAlternativa: modelMock(),
    criterioFaixa: modelMock(),
    conceitoFaixa: modelMock(),
    ciclo: modelMock(),
    aplicacao: modelMock(),
    aplicacaoCentroCusto: modelMock(),
    aplicacaoCriterio: modelMock(),
    aplicacaoPublico: modelMock(),
    designacaoPadrao: modelMock(),
    cicloElegibilidade: modelMock(),
    importacaoDesignacao: modelMock(),
    avaliacao: modelMock(),
    resposta: modelMock(),
    resultadoAvaliacao: modelMock(),
    resultadoCriterio: modelMock(),
    auditoria: modelMock(),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  m.$transaction = jest.fn((arg: any) => (typeof arg === 'function' ? arg(m) : Promise.all(arg)));
  return m;
}
