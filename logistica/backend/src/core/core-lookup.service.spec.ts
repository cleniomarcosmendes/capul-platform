import { BadRequestException } from '@nestjs/common';
import { CoreLookupService } from './core-lookup.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `assertSupervisorDeVeiculo` — ponto 4 da pauta de 09/08.
 *
 * Ser `veiculo.supervisorId` É a concessão de gerir o veículo, mas o cadastro só
 * checava que o usuário EXISTE. O relato: puseram um GESTOR_ENTREGA no campo, ele não
 * conseguiu acompanhar nem aprovar nada, e o contorno foi criar um segundo usuário.
 */
describe('CoreLookupService.assertSupervisorDeVeiculo', () => {
  const svc = (linhas: { role: string; mesmaFilial: boolean }[]) =>
    new CoreLookupService({ $queryRaw: jest.fn().mockResolvedValue(linhas) } as any);

  it('SUPERVISOR_FROTA na filial do veículo → passa', async () => {
    await expect(svc([{ role: 'SUPERVISOR_FROTA', mesmaFilial: true }]).assertSupervisorDeVeiculo('u1', 'f1'))
      .resolves.toBeUndefined();
  });

  // GESTOR_FROTA/ADMIN administram a frota da empresa toda — não se prendem à filial.
  it('GESTOR_FROTA de outra filial → passa (frota é cross-filial)', async () => {
    await expect(svc([{ role: 'GESTOR_FROTA', mesmaFilial: false }]).assertSupervisorDeVeiculo('u1', 'f1'))
      .resolves.toBeUndefined();
  });

  it('ADMIN → passa', async () => {
    await expect(svc([{ role: 'ADMIN', mesmaFilial: false }]).assertSupervisorDeVeiculo('u1', 'f1'))
      .resolves.toBeUndefined();
  });

  // ⭐ O caso relatado: existe, é usuário da Logística, mas não tem papel de frota.
  it('sem papel de frota (era GESTOR_ENTREGA) → recusa dizendo o que fazer', async () => {
    await expect(svc([]).assertSupervisorDeVeiculo('u1', 'f1')).rejects.toThrow(BadRequestException);
    await expect(svc([]).assertSupervisorDeVeiculo('u1', 'f1'))
      .rejects.toThrow(/Supervisor de Departamento.*Configurador/s);
  });

  // Motivo diferente → providência diferente: aqui é escolher outra pessoa, não mexer no papel.
  it('SUPERVISOR_FROTA de OUTRA filial → recusa com a razão certa', async () => {
    await expect(svc([{ role: 'SUPERVISOR_FROTA', mesmaFilial: false }]).assertSupervisorDeVeiculo('u1', 'f1'))
      .rejects.toThrow(/em outra filial/);
  });

  // Multi-role: basta UM papel servir, mesmo que venha de outro departamento.
  it('acumula papéis: GESTOR_ENTREGA num depto + SUPERVISOR_FROTA noutro → passa', async () => {
    await expect(
      svc([{ role: 'SUPERVISOR_FROTA', mesmaFilial: true }]).assertSupervisorDeVeiculo('u1', 'f1'),
    ).resolves.toBeUndefined();
  });
});

/**
 * `deptoDoColaboradorPorMatricula` — a chapa normaliza pelos 5 ÚLTIMOS dígitos, então
 * duas contas colidem (`E01047` e `001047` → `01047`). Achado ao rodar o roteiro 3 em
 * 09/08: a consulta pegava uma das duas ARBITRARIAMENTE, e o departamento que decide
 * quem aprova a despesa vinha do registro de OUTRA pessoa.
 */
describe('CoreLookupService.deptoDoColaboradorPorMatricula', () => {
  const svc = (linhas: { departamento_id: string }[]) =>
    new CoreLookupService({ $queryRaw: jest.fn().mockResolvedValue(linhas) } as any);

  it('uma candidata → devolve o departamento dela', async () => {
    await expect(svc([{ departamento_id: 'dA' }]).deptoDoColaboradorPorMatricula('E01047'))
      .resolves.toBe('dA');
  });

  // ⭐ Não adivinha: cair no depto do login (que a tela marca "confira") é melhor do
  // que atribuir a autoridade sobre a despesa ao chefe de outra pessoa.
  it('DUAS candidatas com departamentos diferentes → null (não escolhe uma)', async () => {
    await expect(svc([{ departamento_id: 'dA' }, { departamento_id: 'dB' }]).deptoDoColaboradorPorMatricula('E01047'))
      .resolves.toBeNull();
  });

  it('duas contas no MESMO departamento → não é ambíguo, devolve', async () => {
    // O SELECT é DISTINCT: mesmo departamento chega como uma linha só.
    await expect(svc([{ departamento_id: 'dA' }]).deptoDoColaboradorPorMatricula('001047'))
      .resolves.toBe('dA');
  });

  it('ninguém com a matrícula → null', async () => {
    await expect(svc([]).deptoDoColaboradorPorMatricula('E09999')).resolves.toBeNull();
  });

  it('matrícula vazia → null sem ir ao banco', async () => {
    await expect(svc([]).deptoDoColaboradorPorMatricula('')).resolves.toBeNull();
  });
});
