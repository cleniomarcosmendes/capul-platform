import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '');

/**
 * Busca unificada do operador: um termo (matrícula, telefone ou nome) varre as
 * fontes locais — ClienteLocal e histórico de entregas (EnderecoEntrega +
 * Entrega). A fonte Protheus (endereços por matrícula, com fallback) entra na
 * PR2b; aqui retornamos um marcador `protheus.pendente` para a UI saber.
 */
@Injectable()
export class BuscaService {
  constructor(private readonly prisma: PrismaService) {}

  async buscaUnificada(termoRaw: string) {
    const termo = (termoRaw ?? '').trim();
    const digits = onlyDigits(termo);
    const pareceMatricula = /^\d{1,15}$/.test(digits) && termo === digits;

    const [clientesLocais, enderecosPorMatricula, historicoEntregas] = await Promise.all([
      // ClienteLocal por nome/telefone
      termo
        ? this.prisma.clienteLocal.findMany({
            where: {
              ativo: true,
              OR: [
                { nome: { contains: termo, mode: 'insensitive' } },
                ...(digits.length >= 4 ? [{ telefone: { contains: digits } }] : []),
              ],
            },
            include: { enderecos: { where: { ativo: true } } },
            take: 20,
          })
        : Promise.resolve([]),
      // Endereços já conhecidos por matrícula (histórico de cliente identificado)
      pareceMatricula
        ? this.prisma.enderecoEntrega.findMany({
            where: { ativo: true, matricula: digits },
            orderBy: { criadoEm: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
      // Histórico de entregas (cobre eventual reuso por telefone/nome do destinatário)
      termo
        ? this.prisma.entrega.findMany({
            where: {
              OR: [
                ...(pareceMatricula ? [{ matricula: digits }] : []),
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
    ]);

    return {
      termo,
      pareceMatricula,
      clientesLocais,
      enderecosPorMatricula,
      historicoEntregas,
      protheus: {
        pendente: true,
        mensagem:
          'Consulta de endereços no Protheus por matrícula entra na PR2b (com fallback). Por ora, fontes locais.',
      },
    };
  }
}
