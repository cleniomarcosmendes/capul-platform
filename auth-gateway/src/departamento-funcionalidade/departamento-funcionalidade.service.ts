import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FuncionalidadeWorkspace } from '@prisma/client';
import { UpdateFuncionalidadesDto } from './dto/update-funcionalidades.dto';

/**
 * Workspace Multi-Departamento (Onda 1 Sub-fase 1.6.2 — D32).
 * CRUD de funcionalidades habilitadas por departamento.
 */
@Injectable()
export class DepartamentoFuncionalidadeService {
  constructor(private prisma: PrismaService) {}

  private readonly TODAS_FUNCIONALIDADES: FuncionalidadeWorkspace[] = [
    'CHAMADO',
    'PROJETO',
    'OS',
    'EQUIPE',
    'CONTRATO',
    'NOTA_FISCAL',
    'SOFTWARE',
    'LICENCA',
    'ATIVO',
    'PARADA',
    'INDICADOR_OPERACIONAL',
    'INDICADOR_ESTRATEGICO',
    'PAINEL_GESTAO_CHAMADO',
    'PAINEL_GESTAO_PROJETO',
    // S16.4 (27/05) — Cadastros operacionais
    'CADASTRO_DEPARTAMENTO',
    'CADASTRO_CENTRO_CUSTO',
    'CADASTRO_NATUREZA_FINANCEIRA',
    'CADASTRO_TIPO_CONTRATO',
    'CADASTRO_FORNECEDOR',
    'CADASTRO_PRODUTO',
    'CADASTRO_TIPO_PRODUTO',
    'CADASTRO_TIPO_PROJETO',
    'CADASTRO_CATEGORIA_LICENCA',
  ];

  /**
   * Lista todas as 14 funcionalidades + status (ativo true/false) pro depto.
   * Funcionalidades nunca ativadas retornam `ativo: false` (registro inexistente
   * no DB). Funcionalidades inativadas (mas com histórico) retornam o registro
   * com `desativadoEm/Por`.
   */
  async listarPorDepto(departamentoId: string) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: departamentoId },
      select: { id: true, nome: true },
    });
    if (!departamento) {
      throw new NotFoundException(`Departamento ${departamentoId} não encontrado`);
    }

    const registros = await this.prisma.departamentoFuncionalidade.findMany({
      where: { departamentoId },
    });

    return this.TODAS_FUNCIONALIDADES.map((f) => {
      const registro = registros.find((r) => r.funcionalidade === f);
      if (!registro) {
        return {
          funcionalidade: f,
          ativo: false,
          ativadoEm: null,
          ativadoPorId: null,
          desativadoEm: null,
          desativadoPorId: null,
        };
      }
      return {
        funcionalidade: registro.funcionalidade,
        ativo: registro.ativo,
        ativadoEm: registro.ativadoEm,
        ativadoPorId: registro.ativadoPor,
        desativadoEm: registro.desativadoEm,
        desativadoPorId: registro.desativadoPor,
      };
    });
  }

  /**
   * Bulk update das funcionalidades pra um depto. Diff vs estado atual:
   *   - Funcionalidade no DTO com ativo=true E sem registro no DB → INSERT
   *   - Funcionalidade no DTO com ativo=true E registro existe com ativo=false → UPDATE ativo=true (clear desativado_*)
   *   - Funcionalidade no DTO com ativo=true E registro existe com ativo=true → no-op
   *   - Funcionalidade no DTO com ativo=false E registro existe com ativo=true → UPDATE ativo=false (set desativado_*)
   *   - Funcionalidade no DTO com ativo=false E sem registro → no-op
   */
  async atualizar(
    departamentoId: string,
    dto: UpdateFuncionalidadesDto,
    userId: string,
  ) {
    const departamento = await this.prisma.departamento.findUnique({
      where: { id: departamentoId },
      select: { id: true },
    });
    if (!departamento) {
      throw new NotFoundException(`Departamento ${departamentoId} não encontrado`);
    }

    const registrosAtuais = await this.prisma.departamentoFuncionalidade.findMany({
      where: { departamentoId },
    });
    const mapAtual = new Map(registrosAtuais.map((r) => [r.funcionalidade, r]));

    const ops: Promise<unknown>[] = [];
    for (const item of dto.funcionalidades) {
      const funcionalidade = item.funcionalidade as FuncionalidadeWorkspace;
      const atual = mapAtual.get(funcionalidade);

      if (item.ativo) {
        if (!atual) {
          ops.push(
            this.prisma.departamentoFuncionalidade.create({
              data: {
                departamentoId,
                funcionalidade,
                ativo: true,
                ativadoPor: userId,
              },
            }),
          );
        } else if (!atual.ativo) {
          ops.push(
            this.prisma.departamentoFuncionalidade.update({
              where: { id: atual.id },
              data: {
                ativo: true,
                ativadoEm: new Date(),
                ativadoPor: userId,
                desativadoEm: null,
                desativadoPor: null,
              },
            }),
          );
        }
      } else {
        if (atual && atual.ativo) {
          ops.push(
            this.prisma.departamentoFuncionalidade.update({
              where: { id: atual.id },
              data: {
                ativo: false,
                desativadoEm: new Date(),
                desativadoPor: userId,
              },
            }),
          );
        }
      }
    }

    await Promise.all(ops);
    return this.listarPorDepto(departamentoId);
  }
}
