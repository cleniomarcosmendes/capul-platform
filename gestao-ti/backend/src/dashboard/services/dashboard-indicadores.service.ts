import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DashboardIndicadoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getIndicadores(mes: number, ano: number, tiposParada?: string[]) {
    // Calcular periodo
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59, 999); // ultimo dia do mes
    const diasNoMes = dataFim.getDate();
    const horasTotais = diasNoMes * 24;

    const [investimentos, licencas, disponibilidade, chamados, horasDesenvolvimento] = await Promise.all([
      this.getInvestimentos(dataInicio, dataFim),
      this.getLicencas(),
      this.getDisponibilidade(dataInicio, dataFim, horasTotais, tiposParada),
      this.getChamados(dataInicio, dataFim),
      this.getHorasDesenvolvimento(dataInicio, dataFim),
    ]);

    return {
      periodo: { mes, ano, dataInicio, dataFim, diasNoMes },
      investimentos,
      licencas,
      disponibilidade,
      chamados,
      horasDesenvolvimento,
    };
  }

  private async getInvestimentos(dataInicio: Date, dataFim: Date) {
    // Parcelas de contratos pagas no periodo
    const parcelas = await this.prisma.parcelaContrato.findMany({
      where: {
        status: 'PAGA',
        dataPagamento: { gte: dataInicio, lte: dataFim },
      },
      include: {
        contrato: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: { dataPagamento: 'asc' },
    });

    const totalParcelas = parcelas.reduce((sum, p) => sum + Number(p.valor), 0);

    // NFs no periodo (nao canceladas)
    const nfs = await this.prisma.notaFiscal.findMany({
      where: {
        status: { not: 'CANCELADA' },
        dataLancamento: { gte: dataInicio, lte: dataFim },
      },
      include: {
        fornecedor: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataLancamento: 'asc' },
    });

    const totalNFs = nfs.reduce((sum, nf) => sum + Number(nf.valorTotal), 0);

    return {
      totalParcelas,
      totalNFs,
      totalInvestimento: totalParcelas + totalNFs,
      qtdParcelas: parcelas.length,
      qtdNFs: nfs.length,
      detalheParcelas: parcelas.map(p => ({
        id: p.id,
        numero: p.numero,
        valor: Number(p.valor),
        dataPagamento: p.dataPagamento,
        contrato: p.contrato,
      })),
      detalheNFs: nfs.map(nf => ({
        id: nf.id,
        numero: nf.numero,
        valorTotal: Number(nf.valorTotal),
        dataLancamento: nf.dataLancamento,
        fornecedor: `${nf.fornecedor.codigo} - ${nf.fornecedor.nome}`,
        qtdItens: nf.itens.length,
      })),
    };
  }

  private async getLicencas() {
    const [licencasAtivas, totalSoftwares, licencasVencendo30, licencasVencendo60, licencasVencendo90] = await Promise.all([
      this.prisma.softwareLicenca.count({ where: { status: 'ATIVA' } }),
      this.prisma.software.count({ where: { status: 'ATIVO' } }),
      this.prisma.softwareLicenca.count({
        where: {
          status: 'ATIVA',
          dataVencimento: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.softwareLicenca.count({
        where: {
          status: 'ATIVA',
          dataVencimento: {
            gte: new Date(),
            lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.softwareLicenca.count({
        where: {
          status: 'ATIVA',
          dataVencimento: {
            gte: new Date(),
            lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      licencasAtivas,
      totalSoftwares,
      licencasVencendo30,
      licencasVencendo60,
      licencasVencendo90,
    };
  }

  private async getDisponibilidade(dataInicio: Date, dataFim: Date, horasTotais: number, tiposParada?: string[]) {
    // Tipos para calculo de disponibilidade (default: nao-programadas)
    const tiposCalculo = tiposParada && tiposParada.length > 0
      ? tiposParada
      : ['PARADA_NAO_PROGRAMADA'];

    // Buscar TODAS as paradas finalizadas no periodo (para exibir visao completa)
    const paradas = await this.prisma.registroParada.findMany({
      where: {
        status: 'FINALIZADA',
        inicio: { lte: dataFim },
        OR: [
          { fim: { gte: dataInicio } },
          { fim: null },
        ],
      },
      include: {
        software: { select: { id: true, nome: true } },
        motivoParada: { select: { id: true, nome: true } },
      },
      orderBy: [{ software: { nome: 'asc' } }, { inicio: 'asc' }],
    });

    // Calcular horas de cada parada no periodo
    let minutosParadaCalculo = 0; // apenas tipos selecionados
    const paradasComHoras = paradas.map(p => {
      const inicio = p.inicio < dataInicio ? dataInicio : p.inicio;
      const fim = p.fim ? (p.fim > dataFim ? dataFim : p.fim) : dataFim;
      const minutos = Math.max(0, (fim.getTime() - inicio.getTime()) / (1000 * 60));

      // Acumular apenas os tipos selecionados para calculo de disponibilidade
      if (tiposCalculo.includes(p.tipo)) {
        minutosParadaCalculo += minutos;
      }

      return {
        id: p.id,
        titulo: p.titulo,
        tipo: p.tipo,
        impacto: p.impacto,
        softwareId: p.software.id,
        softwareNome: p.software.nome,
        motivo: p.motivoParada?.nome || null,
        inicio: p.inicio,
        fim: p.fim,
        horasNoPeriodo: Number((minutos / 60).toFixed(1)),
      };
    });

    // Agrupar por software > tipo > impacto
    const porSoftware = new Map<string, {
      softwareId: string;
      softwareNome: string;
      linhas: {
        tipo: string;
        impacto: string;
        qtdParadas: number;
        horasTotal: number;
        paradas: { id: string; titulo: string; motivo: string | null; inicio: Date; fim: Date | null; horasNoPeriodo: number }[];
      }[];
    }>();

    for (const p of paradasComHoras) {
      if (!porSoftware.has(p.softwareId)) {
        porSoftware.set(p.softwareId, {
          softwareId: p.softwareId,
          softwareNome: p.softwareNome,
          linhas: [],
        });
      }

      const sw = porSoftware.get(p.softwareId)!;
      let linha = sw.linhas.find(l => l.tipo === p.tipo && l.impacto === p.impacto);
      if (!linha) {
        linha = { tipo: p.tipo, impacto: p.impacto, qtdParadas: 0, horasTotal: 0, paradas: [] };
        sw.linhas.push(linha);
      }
      linha.qtdParadas++;
      linha.horasTotal = Number((linha.horasTotal + p.horasNoPeriodo).toFixed(1));
      linha.paradas.push({
        id: p.id,
        titulo: p.titulo,
        motivo: p.motivo,
        inicio: p.inicio,
        fim: p.fim,
        horasNoPeriodo: p.horasNoPeriodo,
      });
    }

    // Ordenar linhas dentro de cada software: tipo asc, impacto asc
    for (const sw of porSoftware.values()) {
      sw.linhas.sort((a, b) => {
        const cmp = a.tipo.localeCompare(b.tipo);
        return cmp !== 0 ? cmp : a.impacto.localeCompare(b.impacto);
      });
    }

    const horasParada = minutosParadaCalculo / 60;
    const disponibilidade = horasTotais > 0 ? ((horasTotais - horasParada) / horasTotais) * 100 : 100;

    return {
      horasTotais,
      horasParada: Number(horasParada.toFixed(1)),
      disponibilidadePercent: Number(disponibilidade.toFixed(2)),
      qtdParadas: paradas.length,
      tiposFiltrados: tiposCalculo,
      porSoftware: Array.from(porSoftware.values()).sort((a, b) => a.softwareNome.localeCompare(b.softwareNome)),
    };
  }

  private async getChamados(dataInicio: Date, dataFim: Date) {
    // Chamados resolvidos/fechados no periodo
    const resolvidos = await this.prisma.chamado.count({
      where: {
        status: { in: ['RESOLVIDO', 'FECHADO'] },
        updatedAt: { gte: dataInicio, lte: dataFim },
      },
    });

    const abertos = await this.prisma.chamado.count({
      where: {
        createdAt: { gte: dataInicio, lte: dataFim },
      },
    });

    const emAberto = await this.prisma.chamado.count({
      where: {
        status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'] },
      },
    });

    // Tempo medio de resolucao (chamados fechados no periodo)
    const chamadosFechados = await this.prisma.chamado.findMany({
      where: {
        status: { in: ['RESOLVIDO', 'FECHADO'] },
        updatedAt: { gte: dataInicio, lte: dataFim },
      },
      select: { createdAt: true, updatedAt: true },
    });

    let tempoMedioHoras = 0;
    if (chamadosFechados.length > 0) {
      const totalMinutos = chamadosFechados.reduce((sum, c) => {
        return sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60);
      }, 0);
      tempoMedioHoras = Number((totalMinutos / chamadosFechados.length / 60).toFixed(1));
    }

    return {
      abertosNoPeriodo: abertos,
      resolvidosNoPeriodo: resolvidos,
      emAbertoAtual: emAberto,
      tempoMedioResolucaoHoras: tempoMedioHoras,
    };
  }

  private async getHorasDesenvolvimento(dataInicio: Date, dataFim: Date) {
    // Buscar projetos de desenvolvimento interno (pelo tipoProjeto.codigo)
    const tipoDesenv = await this.prisma.tipoProjetoConfig.findFirst({
      where: { codigo: 'DESENVOLVIMENTO_INTERNO' },
    });

    const where: Record<string, unknown> = {
      data: { gte: dataInicio, lte: dataFim },
    };

    if (tipoDesenv) {
      where.projeto = { tipoProjetoId: tipoDesenv.id };
    }

    const apontamentos = await this.prisma.apontamentoHoras.findMany({
      where,
      include: {
        projeto: { select: { id: true, numero: true, nome: true } },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { data: 'asc' },
    });

    const totalHoras = apontamentos.reduce((sum, a) => sum + Number(a.horas), 0);

    // Agrupar por projeto
    const porProjeto = new Map<string, { projeto: { id: string; numero: number; nome: string }; horas: number }>();
    for (const a of apontamentos) {
      const key = a.projeto.id;
      if (!porProjeto.has(key)) {
        porProjeto.set(key, { projeto: a.projeto, horas: 0 });
      }
      porProjeto.get(key)!.horas += Number(a.horas);
    }

    // Agrupar por analista
    const porAnalista = new Map<string, { usuario: { id: string; nome: string }; horas: number }>();
    for (const a of apontamentos) {
      const key = a.usuario.id;
      if (!porAnalista.has(key)) {
        porAnalista.set(key, { usuario: a.usuario, horas: 0 });
      }
      porAnalista.get(key)!.horas += Number(a.horas);
    }

    return {
      totalHoras: Number(totalHoras.toFixed(1)),
      totalApontamentos: apontamentos.length,
      porProjeto: Array.from(porProjeto.values()).sort((a, b) => b.horas - a.horas),
      porAnalista: Array.from(porAnalista.values()).sort((a, b) => b.horas - a.horas),
    };
  }
}
