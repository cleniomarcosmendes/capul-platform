import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProtheusClienteService } from '../protheus/protheus-cliente.service.js';

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');
// Matrícula de cliente (SA1) = E + dígitos (ex.: E01047) — formato do balcão.
const MATRICULA_RE = /^E\d{1,14}$/i;

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

    const [clientesLocais, enderecosPorMatricula, historicoEntregas, clienteProtheus] = await Promise.all([
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
      // Protheus (SA1) por matrícula — só quando o termo é matrícula.
      pareceMatricula ? this.protheus.porMatricula(matriculaNorm) : Promise.resolve(null),
    ]);

    return {
      termo,
      pareceMatricula,
      clientesLocais,
      enderecosPorMatricula,
      historicoEntregas,
      protheus: { cliente: clienteProtheus },
    };
  }
}
