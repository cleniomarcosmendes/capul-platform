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
    const licSelect = {
      id: true, nome: true, modeloLicenca: true, quantidade: true, dataVencimento: true, status: true,
      software: { select: { id: true, nome: true } },
      categoria: { select: { id: true, nome: true } },
    };

    const [licencasAtivasList, softwaresAtivosList, licencasVencendo30List, licencasVencendo90List] = await Promise.all([
      this.prisma.softwareLicenca.findMany({
        where: { status: 'ATIVA' },
        select: licSelect,
        orderBy: [{ software: { nome: 'asc' } }, { nome: 'asc' }],
      }),
      this.prisma.software.findMany({
        where: { status: 'ATIVO' },
        select: { id: true, nome: true, fabricante: true, tipo: true, criticidade: true, versaoAtual: true, _count: { select: { licencas: true, modulos: true } } },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.softwareLicenca.findMany({
        where: {
          status: 'ATIVA',
          dataVencimento: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
        select: licSelect,
        orderBy: { dataVencimento: 'asc' },
      }),
      this.prisma.softwareLicenca.findMany({
        where: {
          status: 'ATIVA',
          dataVencimento: { gte: new Date(), lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
        },
        select: licSelect,
        orderBy: { dataVencimento: 'asc' },
      }),
    ]);

    return {
      licencasAtivas: licencasAtivasList.length,
      totalSoftwares: softwaresAtivosList.length,
      licencasVencendo30: licencasVencendo30List.length,
      licencasVencendo60: 0,
      licencasVencendo90: licencasVencendo90List.length,
      detalheSoftwares: softwaresAtivosList,
      detalheLicencasAtivas: licencasAtivasList,
      detalheLicencasVencendo30: licencasVencendo30List,
      detalheLicencasVencendo90: licencasVencendo90List,
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
    const chamadoSelect = {
      id: true, numero: true, titulo: true, status: true, prioridade: true,
      createdAt: true, updatedAt: true,
      solicitante: { select: { id: true, nome: true } },
      tecnico: { select: { id: true, nome: true } },
      equipeAtual: { select: { id: true, sigla: true } },
    };

    const [abertosList, resolvidosList, emAbertoList] = await Promise.all([
      this.prisma.chamado.findMany({
        where: { createdAt: { gte: dataInicio, lte: dataFim } },
        select: chamadoSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.chamado.findMany({
        where: {
          status: { in: ['RESOLVIDO', 'FECHADO'] },
          updatedAt: { gte: dataInicio, lte: dataFim },
        },
        select: chamadoSelect,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.chamado.findMany({
        where: { status: { in: ['ABERTO', 'EM_ATENDIMENTO', 'PENDENTE', 'REABERTO'] } },
        select: chamadoSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let tempoMedioHoras = 0;
    if (resolvidosList.length > 0) {
      const totalMinutos = resolvidosList.reduce((sum, c) => {
        return sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60);
      }, 0);
      tempoMedioHoras = Number((totalMinutos / resolvidosList.length / 60).toFixed(1));
    }

    return {
      abertosNoPeriodo: abertosList.length,
      resolvidosNoPeriodo: resolvidosList.length,
      emAbertoAtual: emAbertoList.length,
      tempoMedioResolucaoHoras: tempoMedioHoras,
      detalheAbertos: abertosList,
      detalheResolvidos: resolvidosList,
      detalheEmAberto: emAbertoList,
    };
  }

  private async getHorasDesenvolvimento(dataInicio: Date, dataFim: Date) {
    // Buscar projetos de desenvolvimento interno (pelo tipoProjeto.codigo)
    const tipoDesenv = await this.prisma.tipoProjetoConfig.findFirst({
      where: { codigo: 'DESENVOLVIMENTO_INTERNO' },
    });

    // Buscar registros de tempo (player) das atividades de projetos do tipo Desenvolvimento Interno
    const where: Record<string, unknown> = {
      horaInicio: { gte: dataInicio, lte: dataFim },
      horaFim: { not: null },
      duracaoMinutos: { not: null, gt: 0 },
    };

    if (tipoDesenv) {
      where.atividade = { projeto: { tipoProjetoId: tipoDesenv.id } };
    }

    const registros = await this.prisma.registroTempo.findMany({
      where,
      include: {
        atividade: {
          select: {
            id: true,
            projeto: { select: { id: true, numero: true, nome: true } },
          },
        },
        usuario: { select: { id: true, nome: true } },
      },
      orderBy: { horaInicio: 'asc' },
    });

    const totalMinutos = registros.reduce((sum, r) => sum + (r.duracaoMinutos || 0), 0);
    const totalHoras = totalMinutos / 60;

    // Agrupar por projeto
    const porProjeto = new Map<string, { projeto: { id: string; numero: number; nome: string }; horas: number }>();
    for (const r of registros) {
      const proj = r.atividade.projeto;
      const key = proj.id;
      if (!porProjeto.has(key)) {
        porProjeto.set(key, { projeto: proj, horas: 0 });
      }
      porProjeto.get(key)!.horas += (r.duracaoMinutos || 0) / 60;
    }

    // Agrupar por analista
    const porAnalista = new Map<string, { usuario: { id: string; nome: string }; horas: number }>();
    for (const r of registros) {
      const key = r.usuario.id;
      if (!porAnalista.has(key)) {
        porAnalista.set(key, { usuario: r.usuario, horas: 0 });
      }
      porAnalista.get(key)!.horas += (r.duracaoMinutos || 0) / 60;
    }

    return {
      totalHoras: Number(totalHoras.toFixed(1)),
      totalApontamentos: registros.length,
      porProjeto: Array.from(porProjeto.values())
        .map(p => ({ ...p, horas: Number(p.horas.toFixed(1)) }))
        .sort((a, b) => b.horas - a.horas),
      porAnalista: Array.from(porAnalista.values())
        .map(a => ({ ...a, horas: Number(a.horas.toFixed(1)) }))
        .sort((a, b) => b.horas - a.horas),
    };
  }
}
