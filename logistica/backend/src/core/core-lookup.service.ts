import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Leitura READ-ONLY do schema `core` (filiais/departamentos/usuarios) via
 * $queryRaw — a logística não declara esses modelos no seu Prisma (schema
 * próprio). Serve para: (1) validar FKs do core na criação (evita ID órfão);
 * (2) resolver nomes para enriquecer as respostas (evita o front depender de
 * chamadas separadas ao core). Nunca escreve no core.
 */
@Injectable()
export class CoreLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async validarFilial(id: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."filiais" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException('Filial não encontrada no cadastro.');
  }

  async validarDepartamento(id: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."departamentos" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException('Departamento não encontrado no cadastro.');
  }

  async validarUsuario(id: string, rotulo = 'Usuário'): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(
      Prisma.sql`SELECT count(*)::int AS n FROM "core"."usuarios" WHERE id = ${id}`,
    );
    if (!r[0]?.n) throw new BadRequestException(`${rotulo} não encontrado no cadastro.`);
  }

  /** id → nome de filial (nome_fantasia › razão social › código). */
  async nomesFiliais(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(COALESCE(NULLIF(TRIM(nome_fantasia), ''), NULLIF(TRIM(razao_social), ''), codigo)) AS label
      FROM "core"."filiais" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /** id → nome de departamento. */
  async nomesDepartamentos(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS label FROM "core"."departamentos" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /** Todos os departamentos (id + nome) — para filtros/dropdowns. */
  async listarDepartamentos(): Promise<{ id: string; nome: string }[]> {
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS nome FROM "core"."departamentos" ORDER BY TRIM(nome)`);
  }

  /** Departamentos de UMA filial. `core.departamentos` é por filial (unique
   *  filial+nome): o mesmo nome existe em várias — "Agroveterinaria" aparece 16
   *  vezes no catálogo. Listagem global em tela de filial vira ruído indistinguível
   *  (e deixa escolher o departamento de outra filial). */
  async departamentosDaFilial(filialId: string): Promise<{ id: string; nome: string }[]> {
    if (!filialId) return [];
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS nome FROM "core"."departamentos" WHERE filial_id = ${filialId} ORDER BY TRIM(nome)`);
  }

  /** O departamento pertence a esta filial? Guarda de integridade para gravações
   *  escopadas por filial. */
  async departamentoEhDaFilial(departamentoId: string, filialId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM "core"."departamentos" WHERE id = ${departamentoId} AND filial_id = ${filialId} LIMIT 1`);
    return rows.length > 0;
  }

  /**
   * chapa normalizada → papel do usuário no módulo LOGISTICA.
   *
   * O cadastro do RDV (`logistica.supervisor`) guarda matrícula e nome, não o papel:
   * quem é coordenador e quem é supervisor de área está na permissão do módulo, no
   * Configurador. Sem isto a tela chamava todo representante de "Supervisor" —
   * inclusive o coordenador.
   *
   * O casamento é pela CHAPA normalizada (E+5 dígitos), a mesma regra que o resto do
   * módulo usa para comparar matrícula: `E01047`, `01047` e `1047` são a mesma pessoa.
   */
  async papeisLogisticaPorChapa(chapas: string[]): Promise<Map<string, string>> {
    const u = [...new Set(chapas.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ chapa: string; role: string }[]>(Prisma.sql`
      SELECT 'E' || LPAD(RIGHT(REGEXP_REPLACE(us.matricula, '\\D', '', 'g'), 5), 5, '0') AS chapa,
             rm.codigo AS role
      FROM "core"."usuarios" us
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = us.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id
      WHERE us.matricula IS NOT NULL
        AND 'E' || LPAD(RIGHT(REGEXP_REPLACE(us.matricula, '\\D', '', 'g'), 5), 5, '0') IN (${Prisma.join(u)})
      -- Duas contas podem colapsar na MESMA chapa (acontece no DEV: um login de teste
      -- e a pessoa real). Ordenar por relevância no RDV e ficar com a primeira torna o
      -- rótulo determinístico, em vez de depender da ordem que o banco devolveu.
      ORDER BY CASE rm.codigo
                 WHEN 'COORDENADOR' THEN 1
                 WHEN 'SUPERVISOR_FROTA' THEN 2
                 WHEN 'SUPERVISOR' THEN 3
                 ELSE 9 END`);
    const mapa = new Map<string, string>();
    for (const r of rows) if (!mapa.has(r.chapa)) mapa.set(r.chapa, r.role);
    return mapa;
  }

  /** id → nome de usuário (colaborador). */
  async nomesUsuarios(ids: string[]): Promise<Map<string, string>> {
    const u = [...new Set(ids.filter(Boolean))];
    if (!u.length) return new Map();
    const rows = await this.prisma.$queryRaw<{ id: string; label: string }[]>(Prisma.sql`
      SELECT id, TRIM(nome) AS label FROM "core"."usuarios" WHERE id IN (${Prisma.join(u)})`);
    return new Map(rows.map((r) => [r.id, r.label]));
  }

  /**
   * Matrícula + nome do colaborador a partir do id do usuário (login). Usado no
   * caminho INDIVIDUAL da frota: o próprio usuário logado é o condutor, sem pedir
   * senha de novo. Retorna null se o usuário não tiver matrícula cadastrada.
   */
  async colaboradorDoUsuario(userId: string): Promise<{ matricula: string; nome: string } | null> {
    if (!userId) return null;
    const rows = await this.prisma.$queryRaw<{ matricula: string | null; nome: string }[]>(Prisma.sql`
      SELECT matricula, TRIM(nome) AS nome FROM "core"."usuarios" WHERE id = ${userId} LIMIT 1`);
    const r = rows[0];
    if (!r || !r.matricula || !r.matricula.trim()) return null;
    return { matricula: r.matricula.trim(), nome: r.nome };
  }

  /**
   * A filial ATUAL do usuário, lida do BANCO — não do token.
   *
   * ⭐ 04/09/2026 — o access token vale **60 minutos** e carrega `filialId`
   * congelado no momento da emissão. Trocar a filial do usuário no Configurador
   * NÃO invalida o token: até renovar, as guardas de escopo comparam contra a
   * filial ANTIGA e devolvem 403.
   *
   * O sintoma é 403 intermitente — "não consegui, tentei mais tarde e consegui" —
   * que parece defeito aleatório e some antes de ser investigado. Relatado pelo
   * Clenio: trocou o admin para a filial 02, tomou "Entrega de outra filial" ao
   * cancelar, e uma hora depois a mesma ação funcionou.
   *
   * Devolve `null` se o usuário não tiver filial principal — aí quem chama
   * mantém o valor do token, em vez de inventar resposta onde não há dado.
   */
  async filialAtualDoUsuario(userId: string): Promise<string | null> {
    if (!userId) return null;
    const rows = await this.prisma.$queryRaw<{ filial_principal_id: string | null }[]>(Prisma.sql`
      SELECT filial_principal_id FROM "core"."usuarios" WHERE id = ${userId} LIMIT 1`);
    return rows[0]?.filial_principal_id ?? null;
  }

  /**
   * MOTORISTAS elegíveis à rota de entrega: usuários ATIVOS, da FILIAL informada
   * (filial principal), com permissão ATIVA no módulo LOGISTICA **e papel
   * ENTREGADOR** (o papel do motorista). Antes listava qualquer papel de
   * Logística (gestor/coordenador/supervisor apareciam como "motorista"); agora
   * é só quem dirige. Requisito: os motoristas precisam estar cadastrados com o
   * papel ENTREGADOR no Configurador — senão não aparecem aqui.
   */
  async motoristasLogistica(filialId: string): Promise<{ id: string; nome: string }[]> {
    if (!filialId) return [];
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT DISTINCT u.id, TRIM(u.nome) AS nome
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id AND rm.codigo = 'ENTREGADOR'
      WHERE u.status = 'ATIVO' AND u.filial_principal_id = ${filialId}
      ORDER BY nome`);
  }

  /** Garante que o motorista É um ENTREGADOR ATIVO da filial (mesma regra do seletor
   *  `motoristasLogistica`). Fecha a brecha de um rascunho antigo cujo motorista
   *  perdeu o papel ENTREGADOR — a validação de existência (`validarUsuario`) não
   *  pegava isso. Usado ao definir o motorista e no DESPACHO. */
  async assertEntregador(motoristaId: string, filialId: string): Promise<void> {
    const r = await this.prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      SELECT count(*)::int AS n
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id AND rm.codigo = 'ENTREGADOR'
      WHERE u.id = ${motoristaId} AND u.status = 'ATIVO' AND u.filial_principal_id = ${filialId}`);
    if (!r[0]?.n) throw new BadRequestException('Motorista inválido: precisa ter o papel Entregador ativo nesta filial.');
  }

  /**
   * Departamento do colaborador pela MATRÍCULA (chapa normalizada E+5 dígitos).
   *
   * É o passo 1 da resolução do departamento aprovador: a viagem grava a matrícula do
   * condutor (validada no Protheus), e é ela — não o login — que diz de quem é a
   * despesa. O login PADRÃO é do POSTO (caixa/portaria): derivar dele mandaria a
   * despesa de um colaborador da Agroveterinária para o supervisor da portaria, que é
   * o mesmo defeito de derivar do veículo, só deslocado.
   *
   * null quando o colaborador não é usuário da plataforma — aí quem chama cai no
   * departamento do login, que a tela mostra e deixa corrigir.
   */
  async deptoDoColaboradorPorMatricula(matricula: string | null | undefined): Promise<string | null> {
    const m = (matricula ?? '').replace(/\D/g, '').slice(-5).padStart(5, '0');
    if (!m || m === '00000') return null;
    // A chapa normaliza pelos 5 ÚLTIMOS dígitos, então DUAS contas podem colidir
    // (`E01047` e `001047` viram a mesma `01047` — acontece no DEV, e em produção
    // qualquer matrícula com mais de 5 dígitos pode colidir). Se as candidatas
    // discordam do departamento, NÃO adivinhamos: devolver "não sei" faz a resolução
    // cair no departamento do login, que a tela marca como "confira" — em vez de
    // atribuir, calado, a autoridade sobre a despesa de alguém ao chefe de OUTRA
    // pessoa. Mesma colisão que `papeisLogisticaPorChapa` já tratava.
    const rows = await this.prisma.$queryRaw<{ departamento_id: string }[]>(Prisma.sql`
      SELECT DISTINCT departamento_id FROM "core"."usuarios"
      WHERE matricula IS NOT NULL
        AND LPAD(RIGHT(REGEXP_REPLACE(matricula, '\\D', '', 'g'), 5), 5, '0') = ${m}
        AND status = 'ATIVO'
        AND departamento_id IS NOT NULL`);
    return rows.length === 1 ? rows[0].departamento_id : null;
  }

  /**
   * Quem APROVA as despesas de um departamento: usuários ATIVOS com SUPERVISOR_FROTA
   * na permissão de Logística DAQUELE departamento.
   *
   * Lista vazia = departamento sem aprovador — a despesa ficaria PENDENTE para sempre,
   * sem erro e sem aviso. Por isso a saída avisa no ato (é o tratamento acordado para
   * o 1º dos "três silêncios" da derivação).
   */
  async aprovadoresDoDepartamento(departamentoId: string | null | undefined): Promise<{ id: string; nome: string }[]> {
    if (!departamentoId) return [];
    return this.prisma.$queryRaw<{ id: string; nome: string }[]>(Prisma.sql`
      SELECT DISTINCT u.id, TRIM(u.nome) AS nome
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id AND rm.codigo = 'SUPERVISOR_FROTA'
      WHERE u.status = 'ATIVO' AND pm.departamento_id = ${departamentoId}
      ORDER BY nome`);
  }

  /**
   * Usuários ELEGÍVEIS a Supervisor Responsável do veículo — alimenta o seletor do
   * cadastro. Mesmos papéis que `assertSupervisorDeVeiculo` aceita, para o campo não
   * oferecer quem o backend vai recusar (o formulário listava a filial INTEIRA, e foi
   * assim que um GESTOR_ENTREGA acabou no campo).
   *
   * SUPERVISOR_FROTA entra pela filial do veículo; GESTOR_FROTA/ADMIN entram sempre
   * (administram a frota da empresa toda).
   */
  async supervisoresDeVeiculo(filialId: string): Promise<{ id: string; nome: string; papel: string }[]> {
    if (!filialId) return [];
    return this.prisma.$queryRaw<{ id: string; nome: string; papel: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (u.id) u.id, TRIM(u.nome) AS nome, rm.codigo AS papel
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id
      WHERE u.status = 'ATIVO'
        AND (
          (rm.codigo = 'SUPERVISOR_FROTA' AND u.filial_principal_id = ${filialId})
          OR rm.codigo IN ('GESTOR_FROTA', 'ADMIN')
        )
      -- DISTINCT ON: multi-role pode trazer a mesma pessoa por 2 departamentos.
      ORDER BY u.id, CASE rm.codigo WHEN 'SUPERVISOR_FROTA' THEN 1 WHEN 'GESTOR_FROTA' THEN 2 ELSE 3 END`);
  }

  /**
   * Garante que o SUPERVISOR RESPONSÁVEL do veículo tem papel para exercer a função.
   *
   * Ser `veiculo.supervisorId` É a concessão: quem está nesse campo gere o veículo
   * (manutenção, ajuste de viagem, despesa). Mas o cadastro só validava que o usuário
   * EXISTE (`validarUsuario`) — então aceitava alguém sem papel nenhum de frota e não
   * avisava. O usuário pôs um GESTOR_ENTREGA no campo, não conseguiu acompanhar nada,
   * e a saída foi criar um segundo usuário. Mesma lição do `assertEntregador`.
   *
   * Papéis aceitos: SUPERVISOR_FROTA (Supervisor de Departamento — o caso normal),
   * GESTOR_FROTA e ADMIN. Multi-role: basta ter UM deles em QUALQUER departamento.
   * Filial: SUPERVISOR_FROTA é papel de filial (tem de ser a do veículo); GESTOR_FROTA
   * e ADMIN administram a frota da empresa toda, então valem em qualquer filial.
   */
  async assertSupervisorDeVeiculo(usuarioId: string, filialId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<{ role: string; mesmaFilial: boolean }[]>(Prisma.sql`
      SELECT rm.codigo AS role, (u.filial_principal_id = ${filialId}) AS "mesmaFilial"
      FROM "core"."usuarios" u
      JOIN "core"."permissoes_modulo" pm ON pm.usuario_id = u.id AND pm.status = 'ATIVO'
      JOIN "core"."modulos_sistema" m ON m.id = pm.modulo_id AND m.codigo = 'LOGISTICA'
      JOIN "core"."roles_modulo" rm ON rm.id = pm.role_modulo_id
      WHERE u.id = ${usuarioId} AND u.status = 'ATIVO'
        AND rm.codigo IN ('SUPERVISOR_FROTA', 'GESTOR_FROTA', 'ADMIN')`);
    const ok = rows.some((r) => r.role === 'GESTOR_FROTA' || r.role === 'ADMIN' || r.mesmaFilial);
    if (ok) return;
    // Mensagem separa os dois motivos — "não tem papel" e "tem, mas noutra filial"
    // pedem providências diferentes de quem cadastra.
    throw new BadRequestException(
      rows.length
        ? 'Supervisor inválido: tem o papel de Supervisor de Departamento, mas em outra filial. Escolha alguém da filial do veículo (ou um Gestor de Frota).'
        : 'Supervisor inválido: precisa ter o papel Supervisor de Departamento (ou Gestor de Frota) ativo na Logística. Ajuste em Configurador → Usuários → Permissões.',
    );
  }
}
