/**
 * CADASTRO DE CRITÉRIOS E FAIXAS — o primeiro caminho de ESCRITA do catálogo.
 *
 * Até aqui `rh.criterio` e `rh.criterio_faixa` só nasciam pelo seed: não havia
 * um `create`/`update` em lugar nenhum do `src/`. O efeito prático era que
 * "cadastre a faixa e reapure", que o motor manda quando um valor não cai em
 * faixa nenhuma, **não tinha para onde mandar** — a saída era T.I. no banco.
 *
 * ⭐⭐ O QUE ESTA TELA DESTRAVA, e é o motivo dela vir antes do editor: o
 * critério `INFORMADO`. Ele não precisa de código nenhum — o valor vem de
 * planilha ou digitação (`rh.criterio_valor_informado`). Com o cadastro de pé,
 * o RH compõe a nota com qualquer coisa que caiba numa planilha sem esperar
 * deploy. `CALCULADO` continua exigindo T.I., porque resolver é código.
 *
 * ⚠️ As regras NÃO moram aqui. `assertCriterioSalvavel` (criterio.validator) e
 * `assertFaixasValidas` (faixa.validator) já existiam ou foram escritas ao lado,
 * com spec própria — este service é a casca: HTTP, persistência e auditoria.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { codigosRegistrados } from '../calculo/resolvers/registry.js';
import { assertCriterioSalvavel, CriterioInvalidoError } from './criterio.validator.js';
import {
  assertFaixasValidas,
  validarFaixasDoCriterio,
  FaixasInvalidasError,
  type FaixaValidavel,
} from './faixa.validator.js';
import type { CriterioDto, FaixasDto } from './criterio.dto.js';

/** Um resolver disponível para o `<select>` da tela. */
export interface ResolverDisponivel {
  codigo: string;
  emUsoPor: string[];
}

@Injectable()
export class CriterioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * ⭐ A LISTA DE RESOLVERS QUE A TELA OFERECE.
   *
   * `codigoCalculo` é `<select>`, nunca campo de texto — e a fonte é
   * `codigosRegistrados()`, a mesma que a validação consulta. Digitar à mão um
   * caractere a mais faria o critério devolver vazio **em silêncio** para o
   * ciclo inteiro: o grupo viraria `semDado`, sairia da renormalização e a nota
   * final de todo mundo mudaria sem um erro sequer.
   *
   * Vem com `emUsoPor` porque o resolver é 1:N — a tela precisa dizer que
   * `TEMPO_EMPRESA` já tem critério, senão o RH cria um segundo sem perceber.
   */
  async resolvers(): Promise<ResolverDisponivel[]> {
    const criterios = await this.prisma.criterio.findMany({
      where: { origem: 'CALCULADO' },
      select: { codigo: true, nome: true, codigoCalculo: true },
    });
    return codigosRegistrados().map((codigo) => ({
      codigo,
      emUsoPor: criterios.filter((c) => c.codigoCalculo === codigo).map((c) => c.nome),
    }));
  }

  async listar() {
    const criterios = await this.prisma.criterio.findMany({
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      include: {
        faixas: { orderBy: { ordem: 'asc' } },
        _count: { select: { aplicacoes: true, valores: true } },
      },
    });

    return criterios.map((c) => ({
      id: c.id,
      codigo: c.codigo,
      nome: c.nome,
      descricao: c.descricao,
      origem: c.origem,
      tipoValor: c.tipoValor,
      codigoCalculo: c.codigoCalculo,
      unidade: c.unidade,
      ativo: c.ativo,
      /** Em quantas aplicações este critério pesa. É o que impede desativar às cegas. */
      aplicacoesQueUsam: c._count.aplicacoes,
      /** Quantos valores importados/digitados existem (só faz sentido em INFORMADO). */
      valoresInformados: c._count.valores,
      faixas: c.faixas.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        limiteInferior: f.limiteInferior === null ? null : Number(f.limiteInferior),
        limiteSuperior: f.limiteSuperior === null ? null : Number(f.limiteSuperior),
        inclusivoInf: f.inclusivoInf,
        inclusivoSup: f.inclusivoSup,
        valorDominio: f.valorDominio,
        pontuacao: Number(f.pontuacao),
        rotulo: f.rotulo,
        ordem: f.ordem,
      })),
    }));
  }

  async criar(dto: CriterioDto, usuarioId: string) {
    const codigo = dto.codigo.trim().toUpperCase();
    this.assertSalvavel({ ...dto, codigo });

    if (await this.prisma.criterio.findUnique({ where: { codigo } })) {
      throw new ConflictException(
        `Já existe um critério com o código "${codigo}". O código identifica o critério e não se repete.`,
      );
    }

    const criado = await this.prisma.criterio.create({
      data: {
        codigo,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        origem: dto.origem,
        tipoValor: dto.tipoValor,
        codigoCalculo: dto.origem === 'CALCULADO' ? (dto.codigoCalculo ?? null) : null,
        unidade: dto.unidade?.trim() || null,
        ativo: dto.ativo ?? true,
      },
    });

    await this.auditoria.registrar({
      entidade: 'Criterio',
      entidadeId: criado.id,
      acao: 'CRIAR_CRITERIO',
      usuarioId,
      valorNovo: criado,
    });
    return criado;
  }

  async atualizar(id: string, dto: CriterioDto, usuarioId: string) {
    const antes = await this.prisma.criterio.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Critério não encontrado.');

    // ⚠️ O CÓDIGO não muda depois de criado. Ele é a solda com o seed e com
    // qualquer script que já tenha referenciado o critério; renomear em lugar
    // quebraria essas pontas em silêncio. A tela mostra o campo travado.
    this.assertSalvavel({ ...dto, codigo: antes.codigo });

    // ⚠️ Trocar o TIPO com faixas cadastradas deixaria faixas do tipo errado
    // para trás — e `localizarFaixa` simplesmente não casaria nenhuma, virando
    // `semDado` para todo mundo. Recusa dizendo o que fazer.
    if (dto.tipoValor !== antes.tipoValor) {
      const quantas = await this.prisma.criterioFaixa.count({ where: { criterioId: id } });
      if (quantas > 0) {
        // O número em posição de rótulo, no fim: nenhuma palavra da frase
        // concorda com ele (`texto-sem-flexao.invariante`).
        throw new BadRequestException(
          `Não dá para mudar o tipo de ${antes.tipoValor} para ${dto.tipoValor}: há faixa ` +
            'cadastrada do tipo antigo, que deixaria de casar com qualquer valor. Apague as ' +
            `faixas primeiro. Faixas cadastradas: ${quantas}.`,
        );
      }
    }

    const depois = await this.prisma.criterio.update({
      where: { id },
      data: {
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        origem: dto.origem,
        tipoValor: dto.tipoValor,
        codigoCalculo: dto.origem === 'CALCULADO' ? (dto.codigoCalculo ?? null) : null,
        unidade: dto.unidade?.trim() || null,
        ativo: dto.ativo ?? antes.ativo,
      },
    });

    await this.auditoria.registrar({
      entidade: 'Criterio',
      entidadeId: id,
      acao: 'EDITAR_CRITERIO',
      usuarioId,
      valorAnterior: antes,
      valorNovo: depois,
    });
    return depois;
  }

  /**
   * As faixas são gravadas EM LOTE, substituindo o conjunto inteiro.
   *
   * ⭐ Por que em lote e não uma a uma: a validade é uma propriedade do
   * CONJUNTO — buraco e sobreposição só existem entre faixas. Salvar uma por
   * vez obrigaria a passar por estados inválidos para chegar num válido
   * (mover a fronteira de duas faixas exige mexer nas duas), e aí ou a
   * validação atrapalha o trabalho legítimo, ou não valida nada.
   */
  /**
   * ⭐⭐ CONFERIR sem gravar — é o que permite a tela mostrar a recusa ANTES do
   * clique **sem uma segunda implementação da regra**.
   *
   * A alternativa seria portar `validarFaixasDoCriterio` para o frontend. Cem
   * linhas de regra em dois lugares envelhecem diferente, e o jeito que isso
   * aparece é o pior possível: a tela libera o que a API recusa (o usuário
   * apanha do servidor) ou a tela recusa o que a API aceita (ninguém descobre
   * que a capacidade existe). Aqui a tela chama **a mesma função**.
   *
   * ⚠️ Sem efeito colateral, de propósito: não grava, não audita, não trava.
   */
  async conferirFaixas(
    criterioId: string,
    dto: FaixasDto,
  ): Promise<{ problemas: string[]; avisos: string[] }> {
    const criterio = await this.prisma.criterio.findUnique({
      where: { id: criterioId },
      select: { tipoValor: true, nome: true, ativo: true, _count: { select: { aplicacoes: true } } },
    });
    if (!criterio) throw new NotFoundException('Critério não encontrado.');
    return {
      problemas: validarFaixasDoCriterio(criterio.tipoValor, this.paraValidacao(criterio.tipoValor, dto)),
      /**
       * ⚠️ AVISO ≠ PROBLEMA. Problema impede salvar; aviso diz o que vai
       * acontecer. Ficar sem faixa é uma escolha legítima (é assim que se
       * desmonta um critério), mas num critério EM USO é destrutivo e silencioso
       * — e a conferência respondia `{problemas: []}`, isto é, **afirmava que
       * estava tudo certo**. Afirmação errada é pior que silêncio.
       */
      avisos: this.avisosDasFaixas(dto, criterio.ativo, criterio._count.aplicacoes),
    };
  }

  private avisosDasFaixas(dto: FaixasDto, ativo: boolean, aplicacoes: number): string[] {
    if (dto.faixas.length > 0 || aplicacoes === 0 || !ativo) return [];
    return [
      'Sem nenhuma faixa este critério para de pontuar todo mundo: ele sai da nota pela ' +
        'renormalização, em silêncio, sem aparecer como erro em lugar nenhum. ' +
        `Aplicações que o usam: ${aplicacoes}.`,
    ];
  }

  async salvarFaixas(criterioId: string, dto: FaixasDto, usuarioId: string) {
    const criterio = await this.prisma.criterio.findUnique({
      where: { id: criterioId },
      include: { faixas: { orderBy: { ordem: 'asc' } }, _count: { select: { aplicacoes: true } } },
    });
    if (!criterio) throw new NotFoundException('Critério não encontrado.');

    // ⭐ A API RECUSA PARA A TELA PODER PERGUNTAR — com o dado, não só com um
    // "tem certeza?". Sem isto, apagar as 13 faixas de ESCOLARIDADE (5
    // aplicações, 1.037 pessoas com o dado no cadastro) passava sem uma palavra,
    // e a conferência ainda respondia "sem problema".
    if (
      dto.faixas.length === 0 &&
      criterio.faixas.length > 0 &&
      criterio.ativo &&
      criterio._count.aplicacoes > 0 &&
      !dto.confirmarSemFaixas
    ) {
      throw new BadRequestException(
        `Ficar sem nenhuma faixa faz "${criterio.nome}" parar de pontuar todo mundo — ele sai da ` +
          'nota pela renormalização, em silêncio. Confirme se é isso mesmo. ' +
          `Faixas que seriam apagadas: ${criterio.faixas.length}. ` +
          `Aplicações que usam o critério: ${criterio._count.aplicacoes}.`,
      );
    }

    const faixas = this.paraValidacao(criterio.tipoValor, dto);

    try {
      assertFaixasValidas(criterio.tipoValor, faixas);
    } catch (e) {
      if (e instanceof FaixasInvalidasError) throw new BadRequestException(e.problemas);
      throw e;
    }

    // ⚠️ Apagar e recriar dentro de UMA transação. As faixas não são
    // referenciadas por FK a partir do resultado (`resultado_criterio.faixa_id`
    // é coluna solta, de propósito — a memória de cálculo guarda o rótulo do
    // que valeu na hora), então recriar não órfã resultado nenhum.
    await this.prisma.$transaction(async (tx) => {
      await tx.criterioFaixa.deleteMany({ where: { criterioId } });
      if (faixas.length) {
        await tx.criterioFaixa.createMany({
          data: faixas.map((f) => ({ ...f, criterioId })),
        });
      }
    });

    await this.auditoria.registrar({
      entidade: 'CriterioFaixa',
      entidadeId: criterioId,
      acao: 'SALVAR_FAIXAS',
      usuarioId,
      valorAnterior: criterio.faixas,
      valorNovo: faixas,
    });

    return this.listar().then((l) => l.find((c) => c.id === criterioId));
  }

  /**
   * A MESMA normalização para conferir e para gravar. Se as duas divergissem, a
   * tela conferiria uma coisa e o servidor gravaria outra — que é o defeito da
   * prévia que "grava o que não mostrou" (§3.1 do ESTADO, 07/09).
   *
   * A `ordem` vem do ÍNDICE, não do campo: a ordem é a da lista na tela, e
   * aceitar um número digitado abriria a porta para duas faixas com a mesma.
   */
  private paraValidacao(tipoValor: 'NUMERICO' | 'DOMINIO', dto: FaixasDto): FaixaValidavel[] {
    return dto.faixas.map((f, i) => ({
      tipo: tipoValor === 'DOMINIO' ? ('DOMINIO' as const) : ('NUMERICA' as const),
      limiteInferior: f.limiteInferior ?? null,
      limiteSuperior: f.limiteSuperior ?? null,
      inclusivoInf: f.inclusivoInf ?? false,
      inclusivoSup: f.inclusivoSup ?? true,
      valorDominio: f.valorDominio?.trim() || null,
      pontuacao: f.pontuacao,
      rotulo: f.rotulo?.trim() || null,
      ordem: i,
    }));
  }

  private assertSalvavel(dto: CriterioDto & { codigo: string }) {
    try {
      assertCriterioSalvavel({
        codigo: dto.codigo,
        nome: dto.nome,
        origem: dto.origem,
        // ⚠️ O `codigoCalculo` vai CRU para a validação, não zerado por origem.
        // A primeira versão mandava `origem === 'CALCULADO' ? … : null`, e com
        // isso INFORMADO + código preenchido — que a regra escrita manda
        // RECUSAR — passava batido: o service limpava antes de o validador ver.
        // Sanitizar em silêncio o que a regra recusa é pior que não validar:
        // some com o sintoma e deixa quem trocou a origem achando que o cálculo
        // continua valendo.
        codigoCalculo: dto.codigoCalculo,
        ativo: dto.ativo ?? true,
      });
    } catch (e) {
      if (e instanceof CriterioInvalidoError) throw new BadRequestException(e.problemas);
      throw e;
    }
  }
}
