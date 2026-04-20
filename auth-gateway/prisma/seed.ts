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
      codigo: 'GESTAO_TI',
      nome: 'Gestao de T.I.',
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
  const modGestaoTi = modulos['GESTAO_TI'];
  const modFiscal = modulos['FISCAL'];
  console.log('Modulos: CONFIGURADOR, INVENTARIO, GESTAO_TI, FISCAL');

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
    { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total a gestao de TI', moduloId: modGestaoTi.id },
    { codigo: 'GESTOR_TI', nome: 'Gestor de TI', descricao: 'Gestao completa do departamento', moduloId: modGestaoTi.id },
    { codigo: 'SUPORTE_TI', nome: 'Suporte de TI', descricao: 'Equipe de TI: atender chamados, projetos, contratos, OS, paradas e base de conhecimento', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_FINAL', nome: 'Usuario Final', descricao: 'Abrir chamados publicos e consultar status dos proprios chamados', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_CHAVE', nome: 'Usuario-Chave', descricao: 'Usuarios-chave de projetos (acesso limitado a pendencias)', moduloId: modGestaoTi.id },
    { codigo: 'TERCEIRIZADO', nome: 'Terceirizado', descricao: 'Analista externo com acesso restrito a projetos e pendencias vinculados', moduloId: modGestaoTi.id },
    // Fiscal
    { codigo: 'GESTOR_FISCAL', nome: 'Gestor Fiscal', descricao: 'Consulta cadastral, NF-e/CT-e, divergencias e agendamentos', moduloId: modFiscal.id },
    { codigo: 'ADMIN_TI', nome: 'Admin TI', descricao: 'Acesso total ao fiscal: certificados, limites, alternancia PROD/HOM e pausar jobs', moduloId: modFiscal.id },
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
            data: [
              { moduloId: modConfigurador.id, roleModuloId: roleAdminConfig.id },
              { moduloId: modInventario.id, roleModuloId: roleAdminInv.id },
              { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id },
              { moduloId: modFiscal.id, roleModuloId: roleAdminTiFiscal.id },
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
        await prisma.permissaoModulo.create({
          data: { usuarioId: admin.id, ...p },
        });
        console.log(`Permissao adicionada ao admin: modulo ${p.moduloId}`);
      }
    }
    console.log(`Admin existente: ${admin.username}`);
  }

  // 7. Integracao PROTHEUS (upsert por codigo unico)
  const endpointsPrd = [
    { ambiente: 'PRODUCAO' as const, operacao: 'HIERARQUIA', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/INVENTARIO/hierarquiaMercadologica', metodo: 'GET' as const, timeoutMs: 30000 },
    { ambiente: 'PRODUCAO' as const, operacao: 'PRODUTOS', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/INVENTARIO/produtos', metodo: 'POST' as const, timeoutMs: 900000 },
    { ambiente: 'PRODUCAO' as const, operacao: 'DIGITACAO', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/INVENTARIO/digitacao', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'PRODUCAO' as const, operacao: 'TRANSFERENCIA', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/INVENTARIO/transferencia', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'PRODUCAO' as const, operacao: 'HISTORICO', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/INVENTARIO/historico', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'PRODUCAO' as const, operacao: 'INFOCLIENTES', url: 'https://apiportal.capul.com.br:443/rest/api/INFOCLIENTES/getLimite', metodo: 'GET' as const, timeoutMs: 60000 },
  ];

  const endpointsHlg = [
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'HIERARQUIA', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/INVENTARIO/hierarquiaMercadologica', metodo: 'GET' as const, timeoutMs: 30000 },
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'PRODUTOS', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/INVENTARIO/produtos', metodo: 'POST' as const, timeoutMs: 900000 },
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'DIGITACAO', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/INVENTARIO/digitacao', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'TRANSFERENCIA', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/INVENTARIO/transferencia', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'HISTORICO', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/INVENTARIO/historico', metodo: 'POST' as const, timeoutMs: 60000 },
    { ambiente: 'HOMOLOGACAO' as const, operacao: 'INFOCLIENTES', url: 'https://192.168.7.63:8115/rest/api/INFOCLIENTES/getLimite', metodo: 'GET' as const, timeoutMs: 60000 },
  ];

  let integracao = await prisma.integracaoApi.findUnique({
    where: { codigo: 'PROTHEUS' },
  });
  if (!integracao) {
    integracao = await prisma.integracaoApi.create({
      data: {
        codigo: 'PROTHEUS',
        nome: 'Protheus ERP',
        descricao: 'Integracao com ERP Protheus (Totvs) — hierarquia, produtos, digitacao, transferencia, historico, colaboradores',
        ambiente: 'HOMOLOGACAO',
        tipoAuth: 'BASIC',
        authConfig: 'QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=',
        endpoints: {
          createMany: {
            data: [...endpointsPrd, ...endpointsHlg],
          },
        },
      },
    });
    console.log(`Integracao PROTHEUS criada: ${integracao.nome} (12 endpoints: 6 PRD + 6 HLG)`);
  } else {
    console.log(`Integracao PROTHEUS existente: ${integracao.nome}`);
  }

  console.log('\nSeed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
