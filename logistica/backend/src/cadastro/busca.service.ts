import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusClienteService } from '../protheus/protheus-cliente.service.js';

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');
// Matrícula de cliente (SA1) = letra A/C/E/F + dígitos (ex.: E01047, A03551,
// C52374) — prefixos de cliente usados no balcão.
const MATRICULA_RE = /^[ACEF]\d{1,14}$/i;

/**
 * Busca unificada do operador: um termo (matrícula, telefone ou nome) varre as
 * fontes locais — ClienteLocal e histórico de entregas — e, quando o termo é
 * uma matrícula (E#####), também consulta o Protheus (cliente/SA1: nome +
 * endereço + telefone + CPF). Leitura, sem SEFAZ.
 */
@Injectable()
export class BuscaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly protheus: ProtheusClienteService,
  ) {}

  async buscaUnificada(termoRaw: string, filialId?: string) {
    const termo = (termoRaw ?? '').trim();
    const digits = onlyDigits(termo);
    const pareceMatricula = MATRICULA_RE.test(termo);
    const matriculaNorm = pareceMatricula ? termo.toUpperCase() : '';
    // Escopo por filial (cidades diferentes → não misturar endereços homônimos).
    const escopo = filialId ? { filialId } : {};

    // Protheus (SA1) pelo formato do termo: matrícula exata, telefone (>=8
    // dígitos p/ não inundar) ou nome (>=3 chars). Endpoint dedicado, leitura.
    const protheusBusca = pareceMatricula
      ? this.protheus.buscar({ matricula: matriculaNorm })
      : digits.length >= 8
        ? this.protheus.buscar({ telefone: digits })
        : termo.length >= 3
          ? this.protheus.buscar({ nome: termo })
          : Promise.resolve([]);

    const [clientesLocais, enderecosPorMatricula, historicoEntregas, clientesProtheus] = await Promise.all([
      // ClienteLocal por nome/telefone (da filial)
      termo
        ? this.prisma.clienteLocal.findMany({
            where: {
              ativo: true,
              ...escopo,
              OR: [
                { nome: { contains: termo, mode: 'insensitive' } },
                ...(digits.length >= 4 ? [{ telefone: { contains: digits } }] : []),
              ],
            },
            include: { enderecos: { where: { ativo: true } } },
            take: 20,
          })
        : Promise.resolve([]),
      // Endereços já conhecidos por matrícula na filial (cliente identificado)
      pareceMatricula
        ? this.prisma.enderecoEntrega.findMany({
            where: { ativo: true, ...escopo, matricula: matriculaNorm },
            orderBy: { criadoEm: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      // Histórico de entregas DA FILIAL (reuso por telefone/nome do destinatário)
      termo
        ? this.prisma.entrega.findMany({
            where: {
              ...escopo,
              OR: [
                ...(pareceMatricula ? [{ matricula: matriculaNorm }] : []),
                ...(digits.length >= 4 ? [{ telefone: { contains: digits } }] : []),
                { destinatarioNome: { contains: termo, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              numero: true,
              matricula: true,
              destinatarioNome: true,
              telefone: true,
              endLogradouro: true,
              endNumero: true,
              endBairro: true,
              endCidade: true,
              criadoEm: true,
            },
            orderBy: { criadoEm: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      // Protheus (SA1) — matrícula/telefone/nome conforme o termo.
      protheusBusca,
    ]);

    return {
      termo,
      pareceMatricula,
      clientesLocais,
      enderecosPorMatricula,
      historicoEntregas,
      protheus: { clientes: clientesProtheus },
    };
  }
}
