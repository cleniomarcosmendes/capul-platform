import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // 1. Empresa
  const empresa = await prisma.empresa.create({
    data: {
      razaoSocial: 'Grupo Capul Ltda',
      nomeFantasia: 'Grupo Capul',
      cnpjMatriz: '00.000.000/0001-00',
    },
  });
  console.log(`Empresa criada: ${empresa.nomeFantasia}`);

  // 2. Filial padrao
  const filial = await prisma.filial.create({
    data: {
      codigo: '01',
      nomeFantasia: 'Matriz - Unai',
      razaoSocial: 'Capul Agroveterinaria Ltda',
      empresaId: empresa.id,
    },
  });
  console.log(`Filial criada: ${filial.nomeFantasia}`);

  // 3. Modulos do sistema
  const modInventario = await prisma.moduloSistema.create({
    data: {
      codigo: 'INVENTARIO',
      nome: 'Inventario de Estoque',
      descricao: 'Sistema de inventario e contagem de estoque',
      icone: 'package',
      cor: '#3B82F6',
      urlFrontend: '/inventario/',
      urlBackend: '/api/v1/inventory',
      ordem: 1,
    },
  });

  const modGestaoTi = await prisma.moduloSistema.create({
    data: {
      codigo: 'GESTAO_TI',
      nome: 'Gestao de T.I.',
      descricao: 'Sistema de gestao do departamento de TI',
      icone: 'monitor',
      cor: '#8B5CF6',
      urlFrontend: '/gestao-ti/',
      urlBackend: '/api/v1/gestao-ti',
      ordem: 2,
    },
  });
  console.log('Modulos criados: INVENTARIO, GESTAO_TI');

  // 4. Roles do Inventario
  const roleAdminInv = await prisma.roleModulo.create({
    data: { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total ao inventario', moduloId: modInventario.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'SUPERVISOR', nome: 'Supervisor', descricao: 'Criar e gerenciar inventarios da filial', moduloId: modInventario.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'OPERATOR', nome: 'Operador', descricao: 'Contar itens do inventario', moduloId: modInventario.id },
  });

  // 5. Roles da Gestao TI
  const roleAdminTi = await prisma.roleModulo.create({
    data: { codigo: 'ADMIN', nome: 'Administrador', descricao: 'Acesso total a gestao de TI', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'GESTOR_TI', nome: 'Gestor de TI', descricao: 'Gestao completa do departamento', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'TECNICO', nome: 'Tecnico', descricao: 'Atender chamados (publicos e privados) e registrar atividades', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'DESENVOLVEDOR', nome: 'Desenvolvedor', descricao: 'Chamados internos e projetos dev', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'GERENTE_PROJETO', nome: 'Gerente de Projeto', descricao: 'Projetos, custos e aprovacoes', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'USUARIO_FINAL', nome: 'Usuario Final', descricao: 'Abrir chamados publicos e consultar status dos proprios chamados', moduloId: modGestaoTi.id },
  });
  await prisma.roleModulo.create({
    data: { codigo: 'FINANCEIRO', nome: 'Financeiro', descricao: 'Contratos, rateio e custos', moduloId: modGestaoTi.id },
  });
  console.log('Roles criadas: 3 Inventario + 7 Gestao TI = 10 total');

  // 6. Admin master
  const admin = await prisma.usuario.create({
    data: {
      username: 'admin',
      email: 'admin@capul.com',
      nome: 'Administrador',
      senha: await bcrypt.hash('admin123', 10),
      filialPrincipalId: filial.id,
      primeiroAcesso: false,
      filiais: {
        create: { filialId: filial.id, isDefault: true },
      },
      permissoes: {
        createMany: {
          data: [
            { moduloId: modInventario.id, roleModuloId: roleAdminInv.id },
            { moduloId: modGestaoTi.id, roleModuloId: roleAdminTi.id },
          ],
        },
      },
    },
  });
  console.log(`Admin criado: ${admin.username} (senha: admin123)`);

  console.log('\nSeed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
