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
  console.log('Modulos: CONFIGURADOR, INVENTARIO, GESTAO_TI');

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
    { codigo: 'TECNICO', nome: 'Tecnico', descricao: 'Atender chamados (publicos e privados) e registrar atividades', moduloId: modGestaoTi.id },
    { codigo: 'DESENVOLVEDOR', nome: 'Desenvolvedor', descricao: 'Chamados internos e projetos dev', moduloId: modGestaoTi.id },
    { codigo: 'GERENTE_PROJETO', nome: 'Gerente de Projeto', descricao: 'Projetos, custos e aprovacoes', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_FINAL', nome: 'Usuario Final', descricao: 'Abrir chamados publicos e consultar status dos proprios chamados', moduloId: modGestaoTi.id },
    { codigo: 'FINANCEIRO', nome: 'Financeiro', descricao: 'Contratos, rateio e custos', moduloId: modGestaoTi.id },
    { codigo: 'USUARIO_CHAVE', nome: 'Usuario-Chave', descricao: 'Usuarios-chave de projetos (acesso limitado a pendencias)', moduloId: modGestaoTi.id },
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
  console.log('Roles: 3 Configurador + 3 Inventario + 7 Gestao TI = 13 total');

  // 5. Departamentos (find or create)
  const deptosData = [
    { nome: 'Tecnologia da Informacao', descricao: 'Departamento de TI' },
    { nome: 'Administrativo', descricao: 'Departamento Administrativo' },
    { nome: 'Operacoes', descricao: 'Departamento de Operacoes' },
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

  // 6. Admin master (find or create)
  let admin = await prisma.usuario.findFirst({
    where: { username: 'admin' },
  });
  if (!admin) {
    admin = await prisma.usuario.create({
      data: {
        username: 'admin',
        email: 'admin@capul.com',
        nome: 'Administrador',
        senha: await bcrypt.hash('admin123', 10),
        filialPrincipalId: filial.id,
        departamentoId: deptoTI.id,
        primeiroAcesso: false,
        filiais: {
          create: { filialId: filial.id, isDefault: true },
        },
        permissoes: {
          createMany: {
            data: [
              { moduloId: modConfigurador.id, roleModuloId: roleAdminConfig.id },
              { moduloId: modInventario.id, roleModuloId: roleAdminInv.id },
              { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id },
            ],
          },
        },
      },
    });
    console.log(`Admin criado: ${admin.username} (senha: admin123)`);
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

  console.log('\nSeed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
