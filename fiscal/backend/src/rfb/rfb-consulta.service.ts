import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReceitaFederalData } from '../cadastro/receita.client.js';

// F2.1 — Consulta pontual por CNPJ na base RFB LOCAL. Mesma forma de dados
// da Receita Federal online (ReceitaFederalData), mas instantânea, sem
// rate-limit e zero risco SEFAZ. É a FONTE PRIMÁRIA da Consulta Cadastral;
// o online (BrasilAPI/ReceitaWS) vira fallback quando o CNPJ não está na
// base local (aberto após o último snapshot ou base ainda não importada).
//
// Limitações conscientes do subconjunto essencial importado (F1.1):
// cnaesSecundarios/dataAbertura/motivoSituacao não são guardados → null
// (o fallback online cobre quando há miss). O essencial (situação, razão,
// endereço, porte, CNAE principal) está completo.

const SITUACAO: Record<string, string> = {
  '01': 'NULA', '02': 'ATIVA', '03': 'SUSPENSA', '04': 'INAPTA', '08': 'BAIXADA',
};
const PORTE: Record<string, string> = {
  '01': 'MICRO EMPRESA', '03': 'EMPRESA DE PEQUENO PORTE',
};

@Injectable()
export class RfbConsultaService {
  constructor(private readonly prisma: PrismaService) {}

  async porCnpj(cnpj: string): Promise<(ReceitaFederalData & { versaoRfb?: string }) | null> {
    const c = (cnpj || '').replace(/\D/g, '');
    if (c.length !== 14) return null; // base RFB é só CNPJ (não CPF)

    const estab = await this.prisma.rfbEstabelecimento.findUnique({ where: { cnpjCompleto: c } });
    if (!estab) return null; // não está na base local → caller faz fallback online

    const basico = c.slice(0, 8);
    const [emp, mun, cnae, ultimo] = await Promise.all([
      this.prisma.rfbEmpresa.findUnique({ where: { cnpjBasico: basico } }),
      estab.municipio
        ? this.prisma.rfbMunicipio.findUnique({ where: { codigo: estab.municipio } })
        : Promise.resolve(null),
      estab.cnaePrincipal
        ? this.prisma.rfbCnae.findUnique({ where: { codigo: estab.cnaePrincipal } })
        : Promise.resolve(null),
      this.prisma.rfbControleImportacao.findFirst({
        where: { status: 'CONCLUIDO' }, orderBy: { versaoRfb: 'desc' },
      }),
    ]);

    // Resolve a descrição da natureza jurídica (temos o domínio importado —
    // antes mostrava só o código cru, ex. "2062"). Não dá p/ ir no Promise.all
    // acima porque depende de `emp`; consulta pontual, custo desprezível.
    const nat = emp?.naturezaJuridica
      ? await this.prisma.rfbNatureza.findUnique({ where: { codigo: emp.naturezaJuridica } })
      : null;

    const sit = (estab.situacaoCadastral || '').padStart(2, '0');
    const tel = estab.ddd1 && estab.telefone1 ? `(${estab.ddd1}) ${estab.telefone1}` : null;

    return {
      cnpj: c,
      razaoSocial: emp?.razaoSocial ?? null,
      nomeFantasia: estab.nomeFantasia ?? null,
      situacao: SITUACAO[sit] ?? null,
      dataSituacao: estab.dataSituacao ?? null,
      motivoSituacao: null,
      naturezaJuridica: emp?.naturezaJuridica
        ? `${emp.naturezaJuridica}${nat?.descricao ? ' — ' + nat.descricao : ''}`
        : null,
      porte: emp?.porte ? (PORTE[emp.porte] ?? 'DEMAIS') : null,
      capitalSocial: emp?.capitalSocial != null ? Number(emp.capitalSocial) : null,
      cnaeFiscal: estab.cnaePrincipal ?? null,
      cnaeFiscalDescricao: cnae?.descricao ?? null,
      cnaesSecundarios: [],
      dataAbertura: null,
      endereco: {
        logradouro: estab.logradouro ?? null,
        numero: estab.numero ?? null,
        complemento: null,
        bairro: estab.bairro ?? null,
        municipio: mun?.descricao ?? estab.municipio ?? null,
        uf: estab.uf ?? null,
        cep: estab.cep ?? null,
      },
      telefone: tel,
      email: estab.correioEletronico ?? null,
      fonte: 'RFB_LOCAL',
      consultadoEm: new Date().toISOString(),
      versaoRfb: ultimo?.versaoRfb,
    };
  }

  /** Metadados da base local p/ a UI deixar claro a origem/idade do dado
   *  (foto mensal — pode estar desatualizada vs SEFAZ ao vivo). */
  async infoBase(): Promise<{ versaoRfb: string | null; importadaEm: Date | null }> {
    const u = await this.prisma.rfbControleImportacao.findFirst({
      where: { status: 'CONCLUIDO' },
      orderBy: { versaoRfb: 'desc' },
      select: { versaoRfb: true, dataFim: true },
    });
    return { versaoRfb: u?.versaoRfb ?? null, importadaEm: u?.dataFim ?? null };
  }
}
