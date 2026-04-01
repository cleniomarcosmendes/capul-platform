/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed Gestao TI — Iniciando...\n');

  // ── 1. Lookup IDs do schema core ──────────────────────────────────

  const filial = await prisma.filial.findFirstOrThrow({ where: { codigo: '01' } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { username: 'admin' } });
  const deptoTI = await prisma.departamento.findFirstOrThrow({ where: { nome: 'Tecnologia da Informacao', filialId: filial.id } });
  const filialId = filial.id;
  const adminId = admin.id;
  const departamentoId = deptoTI.id;
  console.log(`Filial: ${filial.nomeFantasia} (${filialId})`);
  console.log(`Admin:  ${admin.nome} (${adminId})`);
  console.log(`Depto:  ${deptoTI.nome} (${departamentoId})\n`);

  // ── 2. Equipes TI ────────────────────────────────────────────────

  let equipeSup = await prisma.equipeTI.findFirst({ where: { nome: 'Suporte N1' } });
  if (!equipeSup) {
    equipeSup = await prisma.equipeTI.create({
      data: { nome: 'Suporte N1', sigla: 'SUP', cor: '#3B82F6', descricao: 'Atendimento de primeiro nivel a usuarios', aceitaChamadoExterno: true, ordem: 1 },
    });
  }

  let equipeInf = await prisma.equipeTI.findFirst({ where: { nome: 'Infraestrutura' } });
  if (!equipeInf) {
    equipeInf = await prisma.equipeTI.create({
      data: { nome: 'Infraestrutura', sigla: 'INF', cor: '#10B981', descricao: 'Redes, servidores e infraestrutura de TI', aceitaChamadoExterno: false, ordem: 2 },
    });
  }

  let equipeDev = await prisma.equipeTI.findFirst({ where: { nome: 'Desenvolvimento' } });
  if (!equipeDev) {
    equipeDev = await prisma.equipeTI.create({
      data: { nome: 'Desenvolvimento', sigla: 'DEV', cor: '#8B5CF6', descricao: 'Desenvolvimento e manutencao de sistemas', aceitaChamadoExterno: false, ordem: 3 },
    });
  }

  console.log(`Equipes: ${equipeSup.nome}, ${equipeInf.nome}, ${equipeDev.nome}`);

  // ── 3. Membros Equipe (admin como lider) ──────────────────────────

  for (const equipe of [equipeSup, equipeInf, equipeDev]) {
    await prisma.membroEquipe.upsert({
      where: { usuarioId_equipeId: { usuarioId: adminId, equipeId: equipe.id } },
      update: {},
      create: { usuarioId: adminId, equipeId: equipe.id, isLider: true },
    });
  }
  console.log('Membros: admin como lider das 3 equipes');

  // ── 4. Catalogo de Servicos ───────────────────────────────────────

  const catalogoData = [
    { nome: 'Instalacao de Software', equipeId: equipeSup.id, prioridadePadrao: 'MEDIA' as any, slaPadraoHoras: 24 },
    { nome: 'Reset de Senha', equipeId: equipeSup.id, prioridadePadrao: 'BAIXA' as any, slaPadraoHoras: 8 },
    { nome: 'Problema de Rede', equipeId: equipeInf.id, prioridadePadrao: 'ALTA' as any, slaPadraoHoras: 8 },
    { nome: 'Configuracao de Servidor', equipeId: equipeInf.id, prioridadePadrao: 'MEDIA' as any, slaPadraoHoras: 24 },
    { nome: 'Correcao de Bug', equipeId: equipeDev.id, prioridadePadrao: 'ALTA' as any, slaPadraoHoras: 8 },
    { nome: 'Nova Funcionalidade', equipeId: equipeDev.id, prioridadePadrao: 'MEDIA' as any, slaPadraoHoras: 48 },
  ];

  for (const c of catalogoData) {
    await prisma.catalogoServico.upsert({
      where: { equipeId_nome: { equipeId: c.equipeId, nome: c.nome } },
      update: {},
      create: c,
    });
  }
  console.log(`Catalogo: ${catalogoData.length} servicos`);

  // ── 5. SLA Definicoes (4 prioridades x 3 equipes) ────────────────

  const prioridades = [
    { prioridade: 'CRITICA' as any, horasResposta: 1, horasResolucao: 4 },
    { prioridade: 'ALTA' as any, horasResposta: 2, horasResolucao: 8 },
    { prioridade: 'MEDIA' as any, horasResposta: 4, horasResolucao: 24 },
    { prioridade: 'BAIXA' as any, horasResposta: 8, horasResolucao: 48 },
  ];

  let slaCount = 0;
  for (const equipe of [equipeSup, equipeInf, equipeDev]) {
    for (const p of prioridades) {
      await prisma.slaDefinicao.upsert({
        where: { equipeId_prioridade: { equipeId: equipe.id, prioridade: p.prioridade } },
        update: {},
        create: {
          nome: `SLA ${equipe.sigla} - ${p.prioridade}`,
          equipeId: equipe.id,
          ...p,
        },
      });
      slaCount++;
    }
  }
  console.log(`SLA: ${slaCount} definicoes`);

  // ── 6. Softwares ──────────────────────────────────────────────────

  const sap = await prisma.software.upsert({
    where: { nome: 'SAP Business One' },
    update: {},
    create: {
      nome: 'SAP Business One',
      fabricante: 'SAP',
      tipo: 'ERP',
      criticidade: 'CRITICO',
      versaoAtual: '10.0 FP2312',
      ambiente: 'ON_PREMISE',
      equipeResponsavelId: equipeDev.id,
    },
  });

  const salesforce = await prisma.software.upsert({
    where: { nome: 'Salesforce CRM' },
    update: {},
    create: {
      nome: 'Salesforce CRM',
      fabricante: 'Salesforce',
      tipo: 'CRM',
      criticidade: 'ALTO',
      ambiente: 'CLOUD',
      urlAcesso: 'https://capul.my.salesforce.com',
      equipeResponsavelId: equipeDev.id,
    },
  });

  const kaspersky = await prisma.software.upsert({
    where: { nome: 'Kaspersky Endpoint Security' },
    update: {},
    create: {
      nome: 'Kaspersky Endpoint Security',
      fabricante: 'Kaspersky Lab',
      tipo: 'SEGURANCA',
      criticidade: 'CRITICO',
      versaoAtual: '12.6',
      ambiente: 'ON_PREMISE',
      equipeResponsavelId: equipeInf.id,
    },
  });

  const m365 = await prisma.software.upsert({
    where: { nome: 'Microsoft 365' },
    update: {},
    create: {
      nome: 'Microsoft 365',
      fabricante: 'Microsoft',
      tipo: 'COLABORACAO',
      criticidade: 'ALTO',
      ambiente: 'CLOUD',
      urlAcesso: 'https://portal.office.com',
      equipeResponsavelId: equipeInf.id,
    },
  });

  const gitlab = await prisma.software.upsert({
    where: { nome: 'GitLab' },
    update: {},
    create: {
      nome: 'GitLab',
      fabricante: 'GitLab Inc',
      tipo: 'OPERACIONAL',
      criticidade: 'MEDIO',
      versaoAtual: '16.11',
      ambiente: 'CLOUD',
      urlAcesso: 'https://gitlab.capul.com',
      equipeResponsavelId: equipeDev.id,
    },
  });

  console.log('Softwares: SAP, Salesforce, Kaspersky, M365, GitLab');

  // ── 7. Modulos SAP ───────────────────────────────────────────────

  const moduloNames = ['Financeiro', 'Estoque', 'Compras', 'Vendas'];
  const modulos: any[] = [];
  for (const nome of moduloNames) {
    const m = await prisma.softwareModulo.upsert({
      where: { softwareId_nome: { softwareId: sap.id, nome } },
      update: {},
      create: { nome, softwareId: sap.id, descricao: `Modulo ${nome} do SAP` },
    });
    modulos.push(m);
  }
  console.log(`Modulos SAP: ${moduloNames.join(', ')}`);

  // ── 8. Software-Filial (todos vinculados a filial 01) ─────────────

  for (const sw of [sap, salesforce, kaspersky, m365, gitlab]) {
    await prisma.softwareFilial.upsert({
      where: { softwareId_filialId: { softwareId: sw.id, filialId } },
      update: {},
      create: { softwareId: sw.id, filialId },
    });
  }
  console.log('Software-Filial: 5 vinculos');

  // ── 9. Licencas ───────────────────────────────────────────────────

  const now = new Date();

  await prisma.softwareLicenca.create({
    data: {
      softwareId: sap.id,
      modeloLicenca: 'PERPETUA',
      quantidade: 50,
      valorTotal: 120000,
      valorUnitario: 2400,
      dataInicio: new Date(now.getFullYear(), 0, 1),
      dataVencimento: new Date(now.getFullYear() + 1, 0, 1),
      chaveSerial: 'SAP-2025-PERP-XXXXX',
      fornecedor: 'SAP Brasil Ltda',
    },
  });

  await prisma.softwareLicenca.create({
    data: {
      softwareId: kaspersky.id,
      modeloLicenca: 'SUBSCRICAO',
      quantidade: 100,
      valorTotal: 15000,
      valorUnitario: 150,
      dataInicio: new Date(now.getFullYear(), 0, 1),
      dataVencimento: new Date(now.getFullYear(), 6, 1),
      fornecedor: 'Kaspersky Brasil',
    },
  });

  await prisma.softwareLicenca.create({
    data: {
      softwareId: m365.id,
      modeloLicenca: 'POR_USUARIO',
      quantidade: 80,
      valorTotal: 48000,
      valorUnitario: 600,
      dataInicio: new Date(now.getFullYear(), 0, 1),
      dataVencimento: new Date(now.getFullYear(), 11, 1),
      fornecedor: 'Microsoft',
    },
  });

  console.log('Licencas: 3 (SAP, Kaspersky, M365)');

  // ── 10. Cadastros: Naturezas e Tipos de Contrato ─────────────────

  const natSoftware = await prisma.naturezaContrato.upsert({
    where: { codigo: '232035' },
    update: {},
    create: { codigo: '232035', nome: 'Software e Licenciamento' },
  });

  const natServicos = await prisma.naturezaContrato.upsert({
    where: { codigo: '232040' },
    update: {},
    create: { codigo: '232040', nome: 'Servicos de TI' },
  });

  const tipoSuporte = await prisma.tipoContratoConfig.upsert({
    where: { codigo: 'C05' },
    update: {},
    create: { codigo: 'C05', nome: 'Suporte e Manutencao' },
  });

  const tipoLicenc = await prisma.tipoContratoConfig.upsert({
    where: { codigo: 'C01' },
    update: {},
    create: { codigo: 'C01', nome: 'Licenciamento' },
  });

  // ── 10b. Categorias de Licenca ───────────────────────────────────────

  const categoriasLicenca = [
    { codigo: 'CERT_DIGITAL', nome: 'Certificado Digital', descricao: 'Certificados digitais e-CPF, e-CNPJ, etc.' },
    { codigo: 'DOMINIO', nome: 'Dominio', descricao: 'Registro de dominios de internet' },
    { codigo: 'SSL_TLS', nome: 'SSL/TLS', descricao: 'Certificados SSL/TLS para websites' },
    { codigo: 'CLOUD', nome: 'Servico Cloud', descricao: 'Servicos de nuvem (AWS, Azure, GCP)' },
    { codigo: 'ASSINATURA', nome: 'Assinatura Eletronica', descricao: 'Servicos de assinatura eletronica/digital' },
    { codigo: 'OUTRO', nome: 'Outro', descricao: 'Outras categorias' },
  ];

  for (const cat of categoriasLicenca) {
    await prisma.categoriaLicenca.upsert({
      where: { codigo: cat.codigo },
      update: {},
      create: cat,
    });
  }

  console.log('Cadastros: 2 naturezas + 2 tipos contrato + 6 categorias licenca');

  // ── 11. Contratos + Parcelas ────────────────────────────────────────

  const ccTI = await prisma.centroCusto.findFirst({ where: { codigo: { contains: '010224' } } });

  const contratoSAP = await prisma.contrato.create({
    data: {
      titulo: 'Suporte SAP Business One - Anual',
      numeroContrato: '000672',
      status: 'ATIVO',
      fornecedor: 'SAP Brasil Ltda',
      codigoFornecedor: 'F00300',
      lojaFornecedor: '0001',
      valorTotal: 60000,
      valorMensal: 5000,
      dataInicio: new Date(now.getFullYear(), 0, 1),
      dataFim: new Date(now.getFullYear(), 11, 31),
      dataAssinatura: new Date(now.getFullYear() - 1, 11, 15),
      renovacaoAutomatica: true,
      softwareId: sap.id,
      tipoContratoId: tipoSuporte.id,
      filialId,
    },
  });

  const contratoM365 = await prisma.contrato.create({
    data: {
      titulo: 'Licenciamento Microsoft 365 Business',
      numeroContrato: '000680',
      status: 'ATIVO',
      fornecedor: 'Microsoft Corporation',
      codigoFornecedor: 'F00150',
      lojaFornecedor: '0001',
      valorTotal: 48000,
      valorMensal: 4000,
      dataInicio: new Date(now.getFullYear(), 0, 1),
      dataFim: new Date(now.getFullYear(), 11, 31),
      dataAssinatura: new Date(now.getFullYear() - 1, 11, 20),
      renovacaoAutomatica: true,
      softwareId: m365.id,
      tipoContratoId: tipoLicenc.id,
      filialId,
    },
  });

  // Parcelas mensais (6 meses, 2 primeiras pagas)
  for (const contrato of [contratoSAP, contratoM365]) {
    const valorParcela = contrato.id === contratoSAP.id ? 5000 : 4000;
    for (let i = 1; i <= 6; i++) {
      const dataVencimento = new Date(now.getFullYear(), i - 1, 10);
      const paga = i <= 2;
      await prisma.parcelaContrato.create({
        data: {
          numero: i,
          descricao: `Parcela ${i}/12`,
          valor: valorParcela,
          dataVencimento,
          dataPagamento: paga ? new Date(now.getFullYear(), i - 1, 8) : null,
          status: paga ? 'PAGA' : 'PENDENTE',
          contratoId: contrato.id,
        },
      });
    }
  }

  // Historico de criacao dos contratos
  for (const contrato of [contratoSAP, contratoM365]) {
    await prisma.contratoHistorico.create({
      data: {
        tipo: 'CRIACAO',
        descricao: 'Contrato cadastrado no sistema',
        contratoId: contrato.id,
        usuarioId: adminId,
      },
    });
    await prisma.contratoHistorico.create({
      data: {
        tipo: 'ATIVACAO',
        descricao: 'Contrato ativado',
        contratoId: contrato.id,
        usuarioId: adminId,
      },
    });
  }

  console.log('Contratos: 2 (SAP + M365) com 12 parcelas total');

  // ── 11. Chamados ──────────────────────────────────────────────────

  const slaCritica = await prisma.slaDefinicao.findFirst({
    where: { equipeId: equipeSup.id, prioridade: 'CRITICA' },
  });
  const slaAlta = await prisma.slaDefinicao.findFirst({
    where: { equipeId: equipeSup.id, prioridade: 'ALTA' },
  });
  const slaMedia = await prisma.slaDefinicao.findFirst({
    where: { equipeId: equipeSup.id, prioridade: 'MEDIA' },
  });
  const slaBaixa = await prisma.slaDefinicao.findFirst({
    where: { equipeId: equipeSup.id, prioridade: 'BAIXA' },
  });

  const chamadosData = [
    {
      titulo: 'Erro no modulo Financeiro do SAP',
      descricao: 'Ao gerar relatorio de balancete, o sistema exibe erro 500 e nao completa a operacao.',
      prioridade: 'ALTA' as any,
      status: 'ABERTO' as any,
      equipeAtualId: equipeDev.id,
      softwareId: sap.id,
      softwareModuloId: modulos[0].id,
      softwareNome: 'SAP Business One',
      moduloNome: 'Financeiro',
      slaDefinicaoId: slaAlta?.id,
      dataLimiteSla: slaAlta ? new Date(now.getTime() + slaAlta.horasResolucao * 3600000) : null,
    },
    {
      titulo: 'Lentidao no sistema SAP',
      descricao: 'O SAP esta demorando mais de 30 segundos para abrir telas desde ontem.',
      prioridade: 'MEDIA' as any,
      status: 'EM_ATENDIMENTO' as any,
      equipeAtualId: equipeInf.id,
      tecnicoId: adminId,
      softwareId: sap.id,
      softwareNome: 'SAP Business One',
      slaDefinicaoId: slaMedia?.id,
      dataLimiteSla: slaMedia ? new Date(now.getTime() + slaMedia.horasResolucao * 3600000) : null,
    },
    {
      titulo: 'Instalar antivirus na estacao 15',
      descricao: 'Nova estacao de trabalho precisa do Kaspersky instalado e configurado.',
      prioridade: 'BAIXA' as any,
      status: 'PENDENTE' as any,
      equipeAtualId: equipeSup.id,
      softwareId: kaspersky.id,
      softwareNome: 'Kaspersky Endpoint Security',
      slaDefinicaoId: slaBaixa?.id,
      dataLimiteSla: slaBaixa ? new Date(now.getTime() + slaBaixa.horasResolucao * 3600000) : null,
    },
    {
      titulo: 'Configurar VPN para home office',
      descricao: 'Colaborador do financeiro precisa de acesso VPN para trabalho remoto.',
      prioridade: 'MEDIA' as any,
      status: 'RESOLVIDO' as any,
      equipeAtualId: equipeInf.id,
      tecnicoId: adminId,
      dataResolucao: new Date(now.getTime() - 2 * 86400000),
      slaDefinicaoId: slaMedia?.id,
      dataLimiteSla: new Date(now.getTime() + 10 * 86400000),
    },
    {
      titulo: 'Liberar acesso Salesforce para nova vendedora',
      descricao: 'Maria Silva precisa de acesso ao Salesforce CRM com perfil de vendedora.',
      prioridade: 'BAIXA' as any,
      status: 'FECHADO' as any,
      equipeAtualId: equipeSup.id,
      tecnicoId: adminId,
      softwareId: salesforce.id,
      softwareNome: 'Salesforce CRM',
      dataResolucao: new Date(now.getTime() - 5 * 86400000),
      dataFechamento: new Date(now.getTime() - 3 * 86400000),
      notaSatisfacao: 5,
      comentarioSatisfacao: 'Excelente atendimento, rapido e eficiente!',
      slaDefinicaoId: slaBaixa?.id,
      dataLimiteSla: new Date(now.getTime() + 10 * 86400000),
    },
    {
      titulo: 'Bug no relatorio de vendas',
      descricao: 'Relatorio de vendas por regiao esta mostrando valores duplicados no modulo Vendas.',
      prioridade: 'CRITICA' as any,
      status: 'EM_ATENDIMENTO' as any,
      equipeAtualId: equipeDev.id,
      tecnicoId: adminId,
      softwareId: sap.id,
      softwareModuloId: modulos[3].id,
      softwareNome: 'SAP Business One',
      moduloNome: 'Vendas',
      slaDefinicaoId: slaCritica?.id,
      dataLimiteSla: slaCritica ? new Date(now.getTime() + slaCritica.horasResolucao * 3600000) : null,
    },
    {
      titulo: 'Solicitar novo notebook para estagiario',
      descricao: 'Novo estagiario de TI inicia segunda-feira, precisa de notebook configurado.',
      prioridade: 'BAIXA' as any,
      status: 'ABERTO' as any,
      equipeAtualId: equipeSup.id,
    },
    {
      titulo: 'Backup do servidor nao executou ontem',
      descricao: 'O job de backup noturno do servidor SRV-001 falhou as 02:00. Verificar logs urgente.',
      prioridade: 'CRITICA' as any,
      status: 'ABERTO' as any,
      equipeAtualId: equipeInf.id,
      slaDefinicaoId: slaCritica?.id,
      dataLimiteSla: slaCritica ? new Date(now.getTime() + slaCritica.horasResolucao * 3600000) : null,
    },
  ];

  const chamados: any[] = [];
  for (const c of chamadosData) {
    const chamado = await prisma.chamado.create({
      data: {
        ...c,
        solicitanteId: adminId,
        filialId,
        departamentoId,
      },
    });
    chamados.push(chamado);

    // Historico de abertura
    await prisma.historicoChamado.create({
      data: {
        tipo: 'ABERTURA',
        descricao: 'Chamado aberto',
        publico: true,
        chamadoId: chamado.id,
        usuarioId: adminId,
      },
    });
  }

  // Historicos adicionais para chamados nao-ABERTO
  // Chamado 2 (EM_ATENDIMENTO) — assumido
  await prisma.historicoChamado.create({
    data: { tipo: 'ASSUMIDO', descricao: 'Chamado assumido para analise', publico: true, chamadoId: chamados[1].id, usuarioId: adminId },
  });

  // Chamado 3 (PENDENTE) — assumido + comentario
  await prisma.historicoChamado.create({
    data: { tipo: 'ASSUMIDO', descricao: 'Chamado assumido', publico: true, chamadoId: chamados[2].id, usuarioId: adminId },
  });
  await prisma.historicoChamado.create({
    data: { tipo: 'COMENTARIO', descricao: 'Aguardando chegada do equipamento para instalacao', publico: true, chamadoId: chamados[2].id, usuarioId: adminId },
  });

  // Chamado 4 (RESOLVIDO) — assumido + resolvido
  await prisma.historicoChamado.create({
    data: { tipo: 'ASSUMIDO', descricao: 'Chamado assumido', publico: true, chamadoId: chamados[3].id, usuarioId: adminId },
  });
  await prisma.historicoChamado.create({
    data: { tipo: 'RESOLVIDO', descricao: 'VPN configurada com sucesso. Perfil FortiClient instalado.', publico: true, chamadoId: chamados[3].id, usuarioId: adminId },
  });

  // Chamado 5 (FECHADO) — assumido + resolvido + fechado
  await prisma.historicoChamado.create({
    data: { tipo: 'ASSUMIDO', descricao: 'Chamado assumido', publico: true, chamadoId: chamados[4].id, usuarioId: adminId },
  });
  await prisma.historicoChamado.create({
    data: { tipo: 'RESOLVIDO', descricao: 'Acesso liberado e testado com a colaboradora.', publico: true, chamadoId: chamados[4].id, usuarioId: adminId },
  });
  await prisma.historicoChamado.create({
    data: { tipo: 'FECHADO', descricao: 'Chamado fechado pelo solicitante', publico: true, chamadoId: chamados[4].id, usuarioId: adminId },
  });

  // Chamado 6 (EM_ATENDIMENTO) — assumido + comentario
  await prisma.historicoChamado.create({
    data: { tipo: 'ASSUMIDO', descricao: 'Investigando a duplicidade nos dados', publico: true, chamadoId: chamados[5].id, usuarioId: adminId },
  });
  await prisma.historicoChamado.create({
    data: { tipo: 'COMENTARIO', descricao: 'Identificado: problema na query de agrupamento por regiao. Correcao em andamento.', publico: false, chamadoId: chamados[5].id, usuarioId: adminId },
  });

  console.log(`Chamados: ${chamados.length} (com historicos)`);

  // ── 12. Ordens de Servico ─────────────────────────────────────────

  await prisma.ordemServico.create({
    data: {
      titulo: 'Manutencao preventiva switchs rack 01',
      descricao: 'Limpeza e verificacao de firmware dos switchs do rack principal',
      status: 'ABERTA',
      filialId,
      solicitanteId: adminId,
      dataAgendamento: new Date(now.getTime() + 3 * 86400000),
      tecnicos: { create: { tecnicoId: adminId } },
    },
  });

  await prisma.ordemServico.create({
    data: {
      titulo: 'Troca de HD servidor backup',
      descricao: 'Substituicao do disco 3 do RAID que apresentou falha SMART',
      status: 'CONCLUIDA',
      filialId,
      solicitanteId: adminId,
      dataAgendamento: new Date(now.getTime() - 7 * 86400000),
      dataInicio: new Date(now.getTime() - 7 * 86400000),
      dataFim: new Date(now.getTime() - 6 * 86400000),
      observacoes: 'HD substituido, RAID reconstruido com sucesso.',
      tecnicos: { create: { tecnicoId: adminId } },
    },
  });

  console.log('Ordens de Servico: 2');

  // ── 13. Paradas ───────────────────────────────────────────────────

  const paradaFinalizada = await prisma.registroParada.create({
    data: {
      titulo: 'Atualizacao programada SAP - Patch FP2312',
      descricao: 'Atualizacao de seguranca e correcoes do SAP Business One',
      tipo: 'PARADA_PROGRAMADA',
      impacto: 'TOTAL',
      status: 'FINALIZADA',
      inicio: new Date(now.getTime() - 5 * 86400000),
      fim: new Date(now.getTime() - 5 * 86400000 + 120 * 60000),
      duracaoMinutos: 120,
      softwareId: sap.id,
      registradoPorId: adminId,
      finalizadoPorId: adminId,
      observacoes: 'Atualizacao concluida sem problemas. Todos os modulos verificados.',
    },
  });

  await prisma.paradaFilialAfetada.create({
    data: { paradaId: paradaFinalizada.id, filialId },
  });

  const paradaAtiva = await prisma.registroParada.create({
    data: {
      titulo: 'Instabilidade rede interna - investigando',
      descricao: 'Perda intermitente de pacotes na rede do andar 2. Switch SW-001 com possivel falha.',
      tipo: 'PARADA_NAO_PROGRAMADA',
      impacto: 'PARCIAL',
      status: 'EM_ANDAMENTO',
      inicio: new Date(now.getTime() - 2 * 3600000),
      softwareId: kaspersky.id,
      registradoPorId: adminId,
    },
  });

  await prisma.paradaFilialAfetada.create({
    data: { paradaId: paradaAtiva.id, filialId },
  });

  console.log('Paradas: 2 (1 finalizada + 1 em andamento)');

  // ── 14. Projetos ──────────────────────────────────────────────────

  const projetoSalesforce = await prisma.projeto.create({
    data: {
      nome: 'Implantacao Salesforce CRM',
      descricao: 'Implantacao do Salesforce CRM para as equipes de vendas e marketing, incluindo migracao de dados do sistema legado.',
      tipo: 'IMPLANTACAO_TERCEIRO',
      modo: 'COMPLETO',
      status: 'EM_ANDAMENTO',
      nivel: 1,
      dataInicio: new Date(now.getFullYear(), 0, 15),
      dataFimPrevista: new Date(now.getFullYear(), 8, 30),
      custoPrevisto: 85000,
      custoRealizado: 32000,
      softwareId: salesforce.id,
      responsavelId: adminId,
    },
  });

  const projetoSAP = await prisma.projeto.create({
    data: {
      nome: 'Upgrade SAP Business One 10.1',
      descricao: 'Atualizacao do SAP para versao 10.1 com novos recursos fiscais.',
      tipo: 'INFRAESTRUTURA',
      modo: 'COMPLETO',
      status: 'PLANEJAMENTO',
      nivel: 1,
      dataInicio: new Date(now.getFullYear(), 3, 1),
      dataFimPrevista: new Date(now.getFullYear(), 5, 30),
      custoPrevisto: 25000,
      softwareId: sap.id,
      responsavelId: adminId,
    },
  });

  // Sub-projeto do Salesforce
  await prisma.projeto.create({
    data: {
      nome: 'Modulo RH - Salesforce',
      descricao: 'Configuracao do modulo de RH dentro do Salesforce.',
      tipo: 'IMPLANTACAO_TERCEIRO',
      modo: 'COMPLETO',
      status: 'PLANEJAMENTO',
      nivel: 2,
      projetoPaiId: projetoSalesforce.id,
      softwareId: salesforce.id,
      responsavelId: adminId,
    },
  });

  // Membro RACI no projeto Salesforce
  await prisma.membroProjeto.create({
    data: {
      projetoId: projetoSalesforce.id,
      usuarioId: adminId,
      papel: 'RESPONSAVEL',
    },
  });

  // Fases do projeto Salesforce (completo)
  const faseNomes = [
    { nome: 'Levantamento de Requisitos', ordem: 1, status: 'APROVADA' as any },
    { nome: 'Configuracao e Customizacao', ordem: 2, status: 'EM_ANDAMENTO' as any },
    { nome: 'Migracao de Dados e Go-Live', ordem: 3, status: 'PENDENTE' as any },
  ];

  for (const f of faseNomes) {
    await prisma.faseProjeto.create({
      data: {
        ...f,
        projetoId: projetoSalesforce.id,
        dataInicio: f.ordem === 1 ? new Date(now.getFullYear(), 0, 15) : undefined,
        dataFimPrevista: new Date(now.getFullYear(), f.ordem * 3 - 1, 28),
      },
    });
  }

  // Risco no projeto Salesforce
  await prisma.riscoProjeto.create({
    data: {
      titulo: 'Atraso na migracao de dados legados',
      descricao: 'Dados do sistema antigo podem ter inconsistencias que atrasem a migracao.',
      probabilidade: 'MEDIA',
      impacto: 'ALTO',
      status: 'EM_ANALISE',
      planoMitigacao: 'Realizar auditoria de dados antes da migracao. Preparar scripts de limpeza.',
      projetoId: projetoSalesforce.id,
      responsavelId: adminId,
    },
  });

  // Cotacao no projeto Salesforce
  await prisma.cotacaoProjeto.create({
    data: {
      fornecedor: 'Salesforce Consulting Partner',
      descricao: 'Consultoria de implantacao - 200 horas',
      valor: 60000,
      dataRecebimento: new Date(now.getFullYear(), 0, 10),
      validade: new Date(now.getFullYear(), 2, 10),
      status: 'APROVADA',
      projetoId: projetoSalesforce.id,
    },
  });

  // Apontamento de horas
  await prisma.apontamentoHoras.create({
    data: {
      data: new Date(now.getTime() - 86400000),
      horas: 6,
      descricao: 'Configuracao de campos customizados e workflows de aprovacao',
      projetoId: projetoSalesforce.id,
      usuarioId: adminId,
    },
  });

  console.log('Projetos: 3 (2 completos + 1 sub-projeto)');

  // ── 15. Ativos ────────────────────────────────────────────────────

  const ativosData = [
    {
      tag: 'SRV-001', nome: 'Servidor Principal', tipo: 'SERVIDOR' as any,
      fabricante: 'Dell', modelo: 'PowerEdge R740', processador: 'Intel Xeon E5-2680 v4',
      memoriaGB: 64, discoGB: 2048, sistemaOperacional: 'Windows Server 2022',
      ip: '192.168.1.10', hostname: 'srv-principal',
    },
    {
      tag: 'SRV-002', nome: 'Servidor Backup', tipo: 'SERVIDOR' as any,
      fabricante: 'Dell', modelo: 'PowerEdge R640', processador: 'Intel Xeon E3-1270 v6',
      memoriaGB: 32, discoGB: 1024, sistemaOperacional: 'Windows Server 2022',
      ip: '192.168.1.11', hostname: 'srv-backup',
    },
    {
      tag: 'NB-001', nome: 'Notebook TI 01', tipo: 'NOTEBOOK' as any,
      fabricante: 'Lenovo', modelo: 'ThinkPad T14 Gen 4', processador: 'Intel Core i7-1365U',
      memoriaGB: 16, discoGB: 512, sistemaOperacional: 'Windows 11 Pro',
      hostname: 'nb-ti-01',
    },
    {
      tag: 'NB-002', nome: 'Notebook TI 02', tipo: 'NOTEBOOK' as any,
      fabricante: 'Lenovo', modelo: 'ThinkPad T14 Gen 4', processador: 'Intel Core i7-1365U',
      memoriaGB: 16, discoGB: 512, sistemaOperacional: 'Windows 11 Pro',
      hostname: 'nb-ti-02',
    },
    {
      tag: 'SW-001', nome: 'Switch Core Rack 01', tipo: 'SWITCH' as any,
      fabricante: 'Cisco', modelo: 'Catalyst 2960-X 48p', ip: '192.168.1.1', hostname: 'sw-core-01',
    },
    {
      tag: 'IMP-001', nome: 'Impressora Financeiro', tipo: 'IMPRESSORA' as any,
      fabricante: 'HP', modelo: 'LaserJet Pro M404dn', ip: '192.168.1.50', hostname: 'imp-fin-01',
    },
  ];

  const ativos: any[] = [];
  for (const a of ativosData) {
    const ativo = await prisma.ativo.upsert({
      where: { tag: a.tag },
      update: {},
      create: {
        ...a,
        filialId,
        responsavelId: adminId,
        dataAquisicao: new Date(now.getFullYear() - 1, 6, 1),
      },
    });
    ativos.push(ativo);
  }

  // Softwares instalados nos servidores e notebooks
  const servidores = ativos.filter(a => a.tag.startsWith('SRV'));
  const notebooks = ativos.filter(a => a.tag.startsWith('NB'));

  for (const srv of servidores) {
    await prisma.ativoSoftware.upsert({
      where: { ativoId_softwareId: { ativoId: srv.id, softwareId: sap.id } },
      update: {},
      create: { ativoId: srv.id, softwareId: sap.id, versaoInstalada: '10.0 FP2312' },
    });
    await prisma.ativoSoftware.upsert({
      where: { ativoId_softwareId: { ativoId: srv.id, softwareId: kaspersky.id } },
      update: {},
      create: { ativoId: srv.id, softwareId: kaspersky.id, versaoInstalada: '12.6' },
    });
  }

  for (const nb of notebooks) {
    await prisma.ativoSoftware.upsert({
      where: { ativoId_softwareId: { ativoId: nb.id, softwareId: kaspersky.id } },
      update: {},
      create: { ativoId: nb.id, softwareId: kaspersky.id, versaoInstalada: '12.6' },
    });
    await prisma.ativoSoftware.upsert({
      where: { ativoId_softwareId: { ativoId: nb.id, softwareId: m365.id } },
      update: {},
      create: { ativoId: nb.id, softwareId: m365.id },
    });
  }

  console.log(`Ativos: ${ativos.length} (com softwares instalados)`);

  // ── 16. Artigos Base de Conhecimento ──────────────────────────────

  await prisma.artigoConhecimento.create({
    data: {
      titulo: 'Como resetar senha do SAP Business One',
      conteudo: `# Como resetar senha do SAP\n\n## Procedimento\n\n1. Acesse o SAP Business One como administrador\n2. Va em **Administracao > Definicoes > Geral > Usuarios**\n3. Selecione o usuario desejado\n4. Clique em "Alterar Senha"\n5. Defina a nova senha temporaria\n6. Marque a opcao "Forcar alteracao no proximo login"\n7. Clique em "Atualizar"\n\n## Observacoes\n- A senha deve ter no minimo 8 caracteres\n- Deve conter letras maiusculas, minusculas e numeros\n- O usuario tera 3 tentativas antes de ser bloqueado`,
      resumo: 'Passo a passo para resetar senhas de usuarios no SAP Business One',
      categoria: 'PROCEDIMENTO',
      status: 'PUBLICADO',
      tags: 'sap,senha,reset,usuario',
      publicadoEm: new Date(now.getTime() - 30 * 86400000),
      softwareId: sap.id,
      equipeTiId: equipeSup.id,
      autorId: adminId,
    },
  });

  await prisma.artigoConhecimento.create({
    data: {
      titulo: 'Configuracao VPN FortiClient',
      conteudo: `# Configuracao VPN FortiClient\n\n## Pre-requisitos\n- FortiClient VPN instalado (versao 7.0+)\n- Credenciais de VPN fornecidas pelo TI\n\n## Configuracao\n\n1. Abra o FortiClient\n2. Clique em "VPN" no menu lateral\n3. Clique em "Configurar VPN"\n4. Preencha:\n   - **Nome**: Capul VPN\n   - **Servidor**: vpn.capul.com\n   - **Porta**: 443\n   - **Tipo**: SSL-VPN\n5. Clique em "Salvar"\n\n## Conexao\n1. Selecione "Capul VPN"\n2. Informe usuario e senha\n3. Clique em "Conectar"\n\n## Solucao de problemas\n- Se a conexao falhar, verifique se o firewall nao esta bloqueando a porta 443\n- Tente desativar o proxy temporariamente`,
      resumo: 'Guia de instalacao e configuracao do FortiClient VPN para acesso remoto',
      categoria: 'CONFIGURACAO',
      status: 'PUBLICADO',
      tags: 'vpn,forticlient,remoto,home-office',
      publicadoEm: new Date(now.getTime() - 15 * 86400000),
      equipeTiId: equipeInf.id,
      autorId: adminId,
    },
  });

  await prisma.artigoConhecimento.create({
    data: {
      titulo: 'Politica de Backup - Servidores',
      conteudo: `# Politica de Backup\n\n## Escopo\nTodos os servidores do ambiente de producao.\n\n## Agendamento\n- **Diario**: Backup incremental as 02:00\n- **Semanal**: Backup completo aos domingos as 01:00\n- **Mensal**: Backup completo no 1o dia do mes as 00:00\n\n## Retencao\n- Diario: 7 dias\n- Semanal: 4 semanas\n- Mensal: 12 meses\n\n## Destinos\n- Local: NAS-001 (storage dedicado)\n- Offsite: AWS S3 (criptografado)\n\n## Verificacao\n- Teste de restore mensal obrigatorio\n- Relatorio de backup enviado por email diariamente\n\n**RASCUNHO** - Aguardando aprovacao da diretoria.`,
      resumo: 'Documento da politica de backup dos servidores de producao',
      categoria: 'PROCEDIMENTO',
      status: 'RASCUNHO',
      tags: 'backup,servidores,politica,seguranca',
      equipeTiId: equipeInf.id,
      autorId: adminId,
    },
  });

  console.log('Artigos: 3 (2 publicados + 1 rascunho)');

  // ── 17. Notificacoes ──────────────────────────────────────────────

  await prisma.notificacao.createMany({
    data: [
      {
        tipo: 'CHAMADO_ATRIBUIDO',
        titulo: 'Novo chamado critico atribuido',
        mensagem: 'O chamado "Backup do servidor nao executou ontem" foi aberto com prioridade CRITICA.',
        usuarioId: adminId,
        dadosJson: JSON.stringify({ chamadoId: chamados[7].id }),
      },
      {
        tipo: 'CONTRATO_VENCENDO',
        titulo: 'Contrato vencendo em 30 dias',
        mensagem: 'O contrato "Suporte SAP Business One - Anual" vence em 30 dias. Verifique a renovacao.',
        usuarioId: adminId,
        dadosJson: JSON.stringify({ contratoId: contratoSAP.id }),
      },
      {
        tipo: 'PARADA_INICIADA',
        titulo: 'Parada nao programada em andamento',
        mensagem: 'Instabilidade na rede interna detectada. Equipe de infraestrutura investigando.',
        usuarioId: adminId,
        dadosJson: JSON.stringify({ paradaId: paradaAtiva.id }),
      },
    ],
  });

  console.log('Notificacoes: 3');

  // ── Resumo ────────────────────────────────────────────────────────

  console.log('\n========================================');
  console.log('  Seed Gestao TI concluido com sucesso!');
  console.log('========================================');
  console.log(`  Equipes TI:       3`);
  console.log(`  Membros:          3`);
  console.log(`  Catalogo:         6 servicos`);
  console.log(`  SLA:              12 definicoes`);
  console.log(`  Softwares:        5`);
  console.log(`  Modulos SAP:      4`);
  console.log(`  Licencas:         3`);
  console.log(`  Contratos:        2 (12 parcelas)`);
  console.log(`  Chamados:         8 (com historicos)`);
  console.log(`  Ordens Servico:   2`);
  console.log(`  Paradas:          2`);
  console.log(`  Projetos:         3 (fases, riscos, cotacoes)`);
  console.log(`  Ativos:           6 (com softwares)`);
  console.log(`  Artigos:          3`);
  console.log(`  Notificacoes:     3`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
