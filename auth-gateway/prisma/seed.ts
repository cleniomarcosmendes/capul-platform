import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // 1. Empresa (upsert para idempotencia)
  const empresa = await prisma.empresa.upsert({
    where: { cnpjMatriz: '00.000.000/0001-00' },
    update: {},
    create: {
      razaoSocial: 'Grupo Capul Ltda',
      nomeFantasia: 'Grupo Capul',
      cnpjMatriz: '00.000.000/0001-00',
    },
  });
  console.log(`Empresa: ${empresa.nomeFantasia}`);

  // 2. Filial padrao (upsert por empresaId + codigo)
  let filial = await prisma.filial.findFirst({
    where: { empresaId: empresa.id, codigo: '01' },
  });
  if (!filial) {
    filial = await prisma.filial.create({
      data: {
        codigo: '01',
        nomeFantasia: 'Matriz - Unai',
        razaoSocial: 'Capul Agroveterinaria Ltda',
        empresaId: empresa.id,
      },
    });
    console.log(`Filial criada: ${filial.nomeFantasia}`);
  } else {
    console.log(`Filial existente: ${filial.nomeFantasia}`);
  }

  // 3. Modulos do sistema (upsert por codigo unico)
  const modulosData = [
    {
      codigo: 'CONFIGURADOR',
      nome: 'Configurador',
      descricao: 'Configuracao da plataforma: empresa, filiais, usuarios, departamentos',
      icone: 'settings',
      cor: '#059669',
      urlFrontend: '/configurador/',
      urlBackend: '/api/v1/core',
      ordem: 0,
    },
    {
      codigo: 'INVENTARIO',
      nome: 'Inventario de Estoque',
      descricao: 'Sistema de inventario e contagem de estoque',
      icone: 'package',
      cor: '#3B82F6',
      urlFrontend: '/inventario/',
      urlBackend: '/api/v1/inventory',
      ordem: 1,
    },
    {
      codigo: 'WORKSPACE',
      nome: 'Workspace',
      descricao: 'Sistema de gestao do departamento de TI',
      icone: 'monitor',
      cor: '#8B5CF6',
      urlFrontend: '/gestao-ti/',
      urlBackend: '/api/v1/gestao-ti',
      ordem: 2,
    },
    {
      codigo: 'FISCAL',
      nome: 'Fiscal',
      descricao: 'Consulta NF-e/CT-e, cadastro de contribuintes e cruzamento de dados com SEFAZ',
      icone: 'file-text',
      cor: '#F59E0B',
      urlFrontend: '/fiscal/',
      urlBackend: '/api/v1/fiscal',
      ordem: 3,
    },
  ];

  const modulos: Record<string, { id: string }> = {};
  for (const m of modulosData) {
    const mod = await prisma.moduloSistema.upsert({
      where: { codigo: m.codigo },
      update: {},
      create: m,
    });
    modulos[m.codigo] = mod;
  }
  const modConfigurador = modulos['CONFIGURADOR'];
  const modInventario = modulos['INVENTARIO'];
  const modGestaoTi = modulos['WORKSPACE'];
  const modFiscal = modulos['FISCAL'];
  console.log('Modulos: CONFIGURADOR, INVENTARIO, WORKSPACE, FISCAL');

  // 4. Roles (upsert por modulo_id + codigo)
  const rolesData = [
    // Configurador
    { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total ao configurador', moduloId: modConfigurador.id },
    { codigo: 'GESTOR', nome: 'Gestor', descricao: 'Gerenciar usuarios e departamentos', moduloId: modConfigurador.id },
    { codigo: 'VISUALIZADOR', nome: 'Visualizador', descricao: 'Consultar configuracoes (somente leitura)', moduloId: modConfigurador.id },
    // Inventario
    { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total ao inventario', moduloId: modInventario.id },
    { codigo: 'SUPERVISOR', nome: 'Supervisor', descricao: 'Criar e gerenciar inventarios da filial', moduloId: modInventario.id },
    { codigo: 'OPERATOR', nome: 'Operador', descricao: 'Contar itens do inventario', moduloId: modInventario.id },
    // Gestao TI
    { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total ao Workspace', moduloId: modGestaoTi.id },
    { codigo: 'GESTOR', nome: 'Gestor', descricao: 'Gestao completa do departamento (Workspace)', moduloId: modGestaoTi.id },
    { codigo: 'SUPORTE', nome: 'Suporte', descricao: 'Equipe que atende chamados, projetos, contratos, OS, paradas e base de conhecimento (Workspace)', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_FINAL', nome: 'Usuario Final', descricao: 'Abrir chamados publicos e consultar status dos proprios chamados', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_CHAVE', nome: 'Usuario-Chave', descricao: 'Usuarios-chave de projetos (acesso limitado a pendencias)', moduloId: modGestaoTi.id },
    { codigo: 'TERCEIRIZADO', nome: 'Terceirizado', descricao: 'Analista externo com acesso restrito a projetos e pendencias vinculados', moduloId: modGestaoTi.id },
    // Fiscal — hierarquia em 4 niveis (ver fiscal/backend/src/common/constants/roles.constant.ts)
    { codigo: 'OPERADOR_ENTRADA', nome: 'Operador de Entrada', descricao: 'Consulta NF-e/CT-e + cadastro pontual + historico proprio', moduloId: modFiscal.id },
    { codigo: 'ANALISTA_CADASTRO', nome: 'Analista de Cadastro', descricao: 'Operador + relatorios + divergencias + sincronizacao manual', moduloId: modFiscal.id },
    { codigo: 'GESTOR_FISCAL', nome: 'Gestor Fiscal', descricao: 'Analista + multi-filial + alterna PROD/HOM + recebe alertas', moduloId: modFiscal.id },
    { codigo: 'ADMIN_TI', nome: 'Admin TI', descricao: 'Gestor + certificados + limpeza + pausar/retomar jobs', moduloId: modFiscal.id },
  ];

  const roles: Record<string, { id: string }> = {};
  for (const r of rolesData) {
    const role = await prisma.roleModulo.upsert({
      where: { moduloId_codigo: { moduloId: r.moduloId, codigo: r.codigo } },
      update: {},
      create: r,
    });
    roles[`${r.moduloId}:${r.codigo}`] = role;
  }
  const roleAdminConfig = roles[`${modConfigurador.id}:ADMIN`];
  const roleAdminInv = roles[`${modInventario.id}:ADMIN`];
  const roleAdminTi = roles[`${modGestaoTi.id}:ADMIN`];
  const roleAdminTiFiscal = roles[`${modFiscal.id}:ADMIN_TI`];
  console.log('Roles: 3 Configurador + 3 Inventario + 6 Gestao TI + 2 Fiscal = 14 total');

  // 5. Tipos de Departamento (find or create)
  const tiposDeptData = [
    { nome: 'Administrativo', descricao: 'Setores administrativos', ordem: 1 },
    { nome: 'Operacional', descricao: 'Setores operacionais', ordem: 2 },
    { nome: 'Tecnologia', descricao: 'Setores de tecnologia', ordem: 3 },
  ];
  const tiposDepto: Record<string, { id: string }> = {};
  for (const t of tiposDeptData) {
    let tipo = await prisma.tipoDepartamento.findFirst({ where: { nome: t.nome } });
    if (!tipo) {
      tipo = await prisma.tipoDepartamento.create({ data: t });
    }
    tiposDepto[t.nome] = tipo;
  }
  console.log('Tipos Departamento: Administrativo, Operacional, Tecnologia');

  // 5b. Departamentos (find or create)
  const deptosData = [
    { nome: 'Tecnologia da Informacao', descricao: 'Departamento de TI', tipoDepartamentoId: tiposDepto['Tecnologia'].id },
    { nome: 'Administrativo', descricao: 'Departamento Administrativo', tipoDepartamentoId: tiposDepto['Administrativo'].id },
    { nome: 'Operacoes', descricao: 'Departamento de Operacoes', tipoDepartamentoId: tiposDepto['Operacional'].id },
  ];

  const deptos: Record<string, { id: string }> = {};
  for (const d of deptosData) {
    let depto = await prisma.departamento.findFirst({
      where: { nome: d.nome, filialId: filial.id },
    });
    if (!depto) {
      depto = await prisma.departamento.create({
        data: { ...d, filialId: filial.id },
      });
    }
    deptos[d.nome] = depto;
  }
  const deptoTI = deptos['Tecnologia da Informacao'];
  console.log('Departamentos: TI, Administrativo, Operacoes');

  // 5b. Centros de Custo
  const ccData = [
    { codigo: '1001', nome: 'TI - Infraestrutura', descricao: 'Custos de infraestrutura de TI' },
    { codigo: '1002', nome: 'TI - Sistemas', descricao: 'Custos de sistemas e softwares' },
    { codigo: '1003', nome: 'TI - Projetos', descricao: 'Custos de projetos de TI' },
    { codigo: '2001', nome: 'Administrativo', descricao: 'Custos administrativos gerais' },
    { codigo: '3001', nome: 'Operacoes', descricao: 'Custos operacionais' },
  ];

  for (const cc of ccData) {
    const existing = await prisma.centroCusto.findFirst({
      where: { codigo: cc.codigo, filialId: filial.id },
    });
    if (!existing) {
      await prisma.centroCusto.create({
        data: { ...cc, filialId: filial.id },
      });
    }
  }
  console.log('Centros de Custo: 5 (TI-Infra, TI-Sistemas, TI-Projetos, Administrativo, Operacoes)');

  // 6. Admin master (find or create)
  let admin = await prisma.usuario.findFirst({
    where: { username: 'admin' },
  });
  if (!admin) {
    // Primeira senha do admin. Pode ser sobrescrita via INITIAL_ADMIN_PASSWORD
    // no .env — util para producao onde nao queremos padrao conhecido.
    const senhaInicial = process.env.INITIAL_ADMIN_PASSWORD ?? 'admin123';
    admin = await prisma.usuario.create({
      data: {
        username: 'admin',
        email: 'admin@capul.com',
        nome: 'Administrador',
        senha: await bcrypt.hash(senhaInicial, 10),
        filialPrincipalId: filial.id,
        departamentoId: deptoTI.id,
        primeiroAcesso: true, // forca troca no primeiro login
        filiais: {
          create: { filialId: filial.id, isDefault: true },
        },
        permissoes: {
          createMany: {
            // Onda 1 Sub-fase 1.2 — departamentoId NOT NULL em permissoes_modulo.
            // Admin inicial recebe todas as permissões no depto T.I.
            data: [
              { moduloId: modConfigurador.id, roleModuloId: roleAdminConfig.id, departamentoId: deptoTI.id },
              { moduloId: modInventario.id, roleModuloId: roleAdminInv.id, departamentoId: deptoTI.id },
              { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id, departamentoId: deptoTI.id },
              { moduloId: modFiscal.id, roleModuloId: roleAdminTiFiscal.id, departamentoId: deptoTI.id },
            ],
          },
        },
      },
    });
    // NUNCA logar a senha em texto — destinos de log (Grafana/Loki/ELK)
    // capturariam credencial em texto. Informar apenas a origem da senha.
    const fonteSenha = process.env.INITIAL_ADMIN_PASSWORD
      ? 'INITIAL_ADMIN_PASSWORD (env)'
      : 'valor padrao (TROCAR no primeiro login)';
    console.log(`Admin "${admin.username}" criado. Senha: ${fonteSenha}`);
  } else {
    // Garantir que admin tem permissao em todos os modulos
    const permissoesExistentes = await prisma.permissaoModulo.findMany({
      where: { usuarioId: admin.id },
    });
    const modulosComPermissao = new Set(permissoesExistentes.map((p) => p.moduloId));

    const permissoesDesejadas = [
      { moduloId: modConfigurador.id, roleModuloId: roleAdminConfig.id },
      { moduloId: modInventario.id, roleModuloId: roleAdminInv.id },
      { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id },
      { moduloId: modFiscal.id, roleModuloId: roleAdminTiFiscal.id },
    ];

    for (const p of permissoesDesejadas) {
      if (!modulosComPermissao.has(p.moduloId)) {
        // Onda 1 Sub-fase 1.2 — departamentoId NOT NULL.
        await prisma.permissaoModulo.create({
          data: { usuarioId: admin.id, ...p, departamentoId: deptoTI.id },
        });
        console.log(`Permissao adicionada ao admin: modulo ${p.moduloId}`);
      }
    }
    console.log(`Admin existente: ${admin.username}`);
  }

  // 6b. Usuario de SISTEMA do SAC (find or create). Autor dos comentarios que
  // entram por e-mail (Fase 3c) — HistoricoChamado.usuarioId e NOT NULL e nao
  // ha como atribuir a um usuario real (o cliente nao tem login). status
  // INATIVO + senha aleatoria: nunca loga, so existe para a referencia (FK).
  const sistemaSac = await prisma.usuario.findFirst({ where: { username: 'sistema_sac' } });
  if (!sistemaSac) {
    const senhaAleatoria = await bcrypt.hash(`sac-${Math.random().toString(36).slice(2)}-${Date.now()}`, 10);
    await prisma.usuario.create({
      data: {
        username: 'sistema_sac',
        email: 'sac-sistema@capul.com.br',
        nome: 'SAC (e-mail)',
        senha: senhaAleatoria,
        status: 'INATIVO', // nunca loga
        primeiroAcesso: false,
        filialPrincipalId: filial.id,
        departamentoId: deptoTI.id,
      },
    });
    console.log('Usuario de sistema do SAC criado: sistema_sac (INATIVO)');
  } else {
    console.log('Usuario de sistema do SAC existente: sistema_sac');
  }

  // 7. Integracao PROTHEUS (upsert por codigo unico)
  //
  // Cada endpoint tem um `modulo` que identifica o consumidor
  // (FISCAL / GESTAO_TI / INVENTARIO). O resolver de cada modulo filtra
  // endpoints pelo seu modulo — troca em um nao afeta os outros.
  const BASE_PRD = 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES';
  const BASE_HLG = 'https://192.168.7.63:8115/rest/api/INFOCLIENTES';

  const endpointsInventarioPrd = [
    { modulo: 'INVENTARIO' as const, ambiente: 'PRODUCAO' as const, operacao: 'HIERARQUIA', url: `${BASE_PRD}/INVENTARIO/hierarquiaMercadologica`, metodo: 'GET' as const, timeoutMs: 30000 },
    { modulo: 'INVENTARIO' as const, ambiente: 'PRODUCAO' as const, operacao: 'PRODUTOS', url: `${BASE_PRD}/INVENTARIO/produtos`, metodo: 'POST' as const, timeoutMs: 900000 },
    { modulo: 'INVENTARIO' as const, ambiente: 'PRODUCAO' as const, operacao: 'DIGITACAO', url: `${BASE_PRD}/INVENTARIO/digitacao`, metodo: 'POST' as const, timeoutMs: 60000 },
    { modulo: 'INVENTARIO' as const, ambiente: 'PRODUCAO' as const, operacao: 'TRANSFERENCIA', url: `${BASE_PRD}/INVENTARIO/transferencia`, metodo: 'POST' as const, timeoutMs: 60000 },
    { modulo: 'INVENTARIO' as const, ambiente: 'PRODUCAO' as const, operacao: 'HISTORICO', url: `${BASE_PRD}/INVENTARIO/historico`, metodo: 'POST' as const, timeoutMs: 60000 },
  ];

  const endpointsInventarioHlg = endpointsInventarioPrd.map((ep) => ({
    ...ep,
    ambiente: 'HOMOLOGACAO' as const,
    url: ep.url.replace(BASE_PRD, BASE_HLG),
  }));

  const endpointsGestaoTiPrd = [
    { modulo: 'GESTAO_TI' as const, ambiente: 'PRODUCAO' as const, operacao: 'INFOCLIENTES', url: `${BASE_PRD}/getLimite`, metodo: 'GET' as const, timeoutMs: 60000 },
    // 04/06/2026 — FUNCIONÁRIO por matrícula (portal RH): GET ?MATRICULA= →
    // { matricula, nome, cc }. Operação separada do getLimite (esse é CLIENTES).
    // Consumido por protheus.service.buscarColaborador (autofill do vínculo de licença).
    { modulo: 'GESTAO_TI' as const, ambiente: 'PRODUCAO' as const, operacao: 'infoFuncionario', url: `${BASE_PRD}/infoPortal`, metodo: 'GET' as const, timeoutMs: 60000 },
    // 10/06/2026 — AUTENTICAÇÃO matrícula+senha do portal RH: POST ?MATRICULA=&SENHA=
    // → { matricula, autenticacao: "Credenciais válidas!|inválidas!" }. Usado na
    // abertura de Chamado por usuário PADRAO (prova de identidade). A matrícula é a
    // CHAPA numérica (ex.: 002873) — o backend normaliza a E-prefixada antes de enviar.
    { modulo: 'GESTAO_TI' as const, ambiente: 'PRODUCAO' as const, operacao: 'loginPortal', url: `${BASE_PRD}/loginPortal`, metodo: 'POST' as const, timeoutMs: 15000 },
    // 21/06/2026 — SAC: autofill nome/telefone do cliente no chamado (SA1). Reusa o
    // endpoint DEDICADO da Logística (clienteEndereco). E-mail é sempre manual.
    { modulo: 'GESTAO_TI' as const, ambiente: 'PRODUCAO' as const, operacao: 'clienteSac', url: `${BASE_PRD}/LOGISTICA/clienteEndereco`, metodo: 'GET' as const, timeoutMs: 10000 },
  ];

  const endpointsGestaoTiHlg = endpointsGestaoTiPrd.map((ep) => ({
    ...ep,
    ambiente: 'HOMOLOGACAO' as const,
    url: ep.url.replace(BASE_PRD, BASE_HLG),
  }));

  const endpointsFiscalPrd = [
    { modulo: 'FISCAL' as const, ambiente: 'PRODUCAO' as const, operacao: 'xmlNfe', url: `${BASE_PRD}/FISCAL/xmlNfe`, metodo: 'GET' as const, timeoutMs: 60000 },
    { modulo: 'FISCAL' as const, ambiente: 'PRODUCAO' as const, operacao: 'grvXML', url: `${BASE_PRD}/FISCAL/grvXML`, metodo: 'POST' as const, timeoutMs: 60000 },
    { modulo: 'FISCAL' as const, ambiente: 'PRODUCAO' as const, operacao: 'eventosNfe', url: `${BASE_PRD}/FISCAL/eventosNfe`, metodo: 'GET' as const, timeoutMs: 60000 },
    { modulo: 'FISCAL' as const, ambiente: 'PRODUCAO' as const, operacao: 'cadastroFiscal', url: `${BASE_PRD}/FISCAL/cadastroFiscal`, metodo: 'GET' as const, timeoutMs: 60000 },
    // 12/06/2026 — filial de DESTINO de nota de saída (SPED050): GET ?CHAVENFEE=
    // → { chave, cnpjDestino, codFilial, ... }. Consulta SEFAZ direcionada pra
    // transferência entre filiais (emitente não baixa o próprio XML — 641).
    { modulo: 'FISCAL' as const, ambiente: 'PRODUCAO' as const, operacao: 'xmlFilDestino', url: `${BASE_PRD}/FISCAL/xmlFilDestino`, metodo: 'GET' as const, timeoutMs: 15000 },
  ];

  const endpointsFiscalHlg = endpointsFiscalPrd.map((ep) => ({
    ...ep,
    ambiente: 'HOMOLOGACAO' as const,
    url: ep.url.replace(BASE_PRD, BASE_HLG),
  }));

  // LOGISTICA — cliente (SA1) p/ autofill de endereço na entrega. Endpoint
  // DEDICADO entregue pelo Protheus (06/2026): busca por MATRICULA/TELEFONE/NOME,
  // devolve endereço + contatos de clientes ATIVOS da SA1. Só leitura, sem SEFAZ.
  const endpointsLogisticaPrd = [
    { modulo: 'LOGISTICA' as const, ambiente: 'PRODUCAO' as const, operacao: 'clienteEndereco', url: `${BASE_PRD}/LOGISTICA/clienteEndereco`, metodo: 'GET' as const, timeoutMs: 10000 },
  ];

  const endpointsLogisticaHlg = endpointsLogisticaPrd.map((ep) => ({
    ...ep,
    ambiente: 'HOMOLOGACAO' as const,
    url: ep.url.replace(BASE_PRD, BASE_HLG),
  }));

  const todosEndpoints = [
    ...endpointsInventarioPrd, ...endpointsInventarioHlg,
    ...endpointsGestaoTiPrd, ...endpointsGestaoTiHlg,
    ...endpointsFiscalPrd, ...endpointsFiscalHlg,
    ...endpointsLogisticaPrd, ...endpointsLogisticaHlg,
  ];

  let integracao = await prisma.integracaoApi.findUnique({
    where: { codigo: 'PROTHEUS' },
  });
  if (!integracao) {
    integracao = await prisma.integracaoApi.create({
      data: {
        codigo: 'PROTHEUS',
        nome: 'Protheus ERP',
        descricao: 'Integracao com ERP Protheus (Totvs) — consumido por Inventario (hierarquia/produtos/digitacao), Gestao TI (colaboradores) e Fiscal (xmlNfe/grvXML/eventosNfe/cadastroFiscal)',
        tipoAuth: 'BASIC',
        authConfig: 'QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=',
        endpoints: {
          createMany: {
            data: todosEndpoints,
          },
        },
      },
    });
    console.log(`Integracao PROTHEUS criada: ${integracao.nome} (${todosEndpoints.length} endpoints, x 2 ambientes)`);
  } else {
    // PROTHEUS já existia: reconcilia endpoints FALTANTES (idempotente). Sem isto,
    // endpoints novos (ex.: clienteEndereco/clienteSac) nunca entram em ambiente
    // que já tinha a integração (HOM/PROD) — só apareciam na criação inicial.
    // update:{} preserva ajustes feitos no Configurador (url/ativo). Cria só o que
    // falta; ativo só no PRODUCAO p/ respeitar o índice "um ativo por (modulo,operacao)".
    let criados = 0;
    for (const ep of todosEndpoints) {
      const existe = await prisma.integracaoApiEndpoint.findUnique({
        where: { integracaoId_modulo_ambiente_operacao: {
          integracaoId: integracao.id, modulo: ep.modulo, ambiente: ep.ambiente, operacao: ep.operacao } },
        select: { id: true },
      });
      if (!existe) {
        await prisma.integracaoApiEndpoint.create({
          data: { ...ep, ativo: ep.ambiente === 'PRODUCAO', integracaoId: integracao.id },
        });
        criados++;
      }
    }
    console.log(`Integracao PROTHEUS existente: ${integracao.nome} — ${criados} endpoint(s) faltante(s) criado(s).`);
  }

  console.log('\nSeed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
