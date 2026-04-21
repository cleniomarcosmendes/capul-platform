import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface FilialResumo {
  codigo: string;
  nomeFantasia: string;
  cnpj: string | null;
  isDefault?: boolean;
}

@Injectable()
export class FiliaisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista as filiais ATIVAS que o usuario tem acesso, conforme a tabela
   * `core.usuario_filiais` (gerenciada pelo Configurador).
   *
   * Usado pelo dropdown de filial consulente na consulta NF-e — o CNPJ da
   * filial escolhida vira o `consulente` da chamada SEFAZ NFeDistribuicaoDFe.
   *
   * Regra: se o usuario nao tem nenhuma filial vinculada em usuario_filiais,
   * retorna lista vazia — a UI mostra apenas a filial padrao do JWT como
   * fallback seguro.
   */
  async listarDoUsuario(usuarioId: string): Promise<FilialResumo[]> {
    const vinculos = await this.prisma.usuarioFilialCore.findMany({
      where: {
        usuarioId,
        filial: { status: 'ATIVO' },
      },
      select: {
        isDefault: true,
        filial: {
          select: {
            codigo: true,
            nomeFantasia: true,
            cnpj: true,
          },
        },
      },
      orderBy: { filial: { codigo: 'asc' } },
    });

    return vinculos.map((v) => ({
      codigo: v.filial.codigo,
      nomeFantasia: v.filial.nomeFantasia,
      cnpj: v.filial.cnpj,
      isDefault: v.isDefault,
    }));
  }
}
