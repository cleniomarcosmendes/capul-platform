/**
 * ⭐⭐ AVISOS DE COMPARABILIDADE — Etapa 7, e é AVISO, nunca bloqueio.
 *
 * ── O PROBLEMA ──────────────────────────────────────────────────────────────
 *
 * Os perfis existem justamente para **serem diferentes** — foi a melhoria que
 * o módulo veio fazer (o modelo antigo aplicava as mesmas 15 perguntas a ~1.000
 * pessoas). Então "o Administrativo tem 11 questões e a Loja tem 14" não é
 * defeito: é o ponto.
 *
 * O que **não** é óbvio, e é onde as notas se afastam sem ninguém decidir, é a
 * mesma classificação pesando o mesmo e tendo **contagens diferentes de
 * questões** entre perfis. Aí o peso por questão muda:
 *
 *     Relacionamento, peso 16, em 3 questões → 5,34 cada
 *     Relacionamento, peso 16, em 2 questões → 8,00 cada
 *
 * Uma questão vale 50% a mais num perfil que no outro, e os dois questionários
 * continuam somando 60. **Ninguém vê olhando.**
 *
 * ── POR QUE AVISO, E NÃO BLOQUEIO ───────────────────────────────────────────
 *
 * ⚠️ **A decisão é do RH.** Pode ser deliberado que a Loja cubra Atendimento
 * com 3 questões e o Administrativo com 1 — é exatamente para isso que os
 * perfis existem. Bloquear obrigaria a igualar tudo, o que desfaz a melhoria; e
 * validação com teoria errada faz o usuário mentir no dado
 * ([[feedback_trava_confirmar_o_que_decide]]).
 *
 * O que o sistema deve é **mostrar o número antes de publicar** — não depois,
 * quando a nota já saiu. Ver `previa-publicar` e a tela de montagem.
 *
 * ── O QUE ESTE ARQUIVO NÃO FAZ ──────────────────────────────────────────────
 *
 * Não compara SOMAS entre perfis (60 × 50). A nota é **normalizada**
 * (`notaAvaliacao = Σ(valor × peso) / Σ(maior × peso) × 100`), então a escala
 * absoluta não muda nota nenhuma — só a leitura lado a lado dos dois
 * questionários. Esse aviso mora no diálogo de publicar, e é sobre a MESMA
 * família (v1 × v2 do mesmo perfil), onde ele significa algo.
 */

export interface PerfilComparavel {
  versaoId: string;
  modeloNome: string;
  versao: number;
  publicado: boolean;
  /** Peso declarado por classificação neste perfil. */
  grupos: readonly { classificacaoId: string; titulo: string; peso: number }[];
  /** Classificação de cada questão do arranjo. */
  questoes: readonly { perguntaId: string; classificacaoId: string }[];
}

export interface LinhaDaComparacao {
  modeloNome: string;
  versao: number;
  publicado: boolean;
  /** `null` quando o perfil não usa esta classificação. */
  peso: number | null;
  questoes: number;
  /** `peso ÷ questões` — o que uma questão vale ali. `null` se não usa. */
  porQuestao: number | null;
}

export interface AvisoDeComparabilidade {
  classificacaoId: string;
  titulo: string;
  /** O que ESTE perfil tem. */
  aqui: { peso: number; questoes: number; porQuestao: number };
  /** O mesmo, nos outros perfis publicados que usam a classificação. */
  outros: LinhaDaComparacao[];
  /**
   * ⭐⭐ ESTA EDIÇÃO criou a diferença, ou ela já existia?
   *
   * `false` = o peso por questão desta classificação é o MESMO da versão
   * publicada deste perfil. A diferença entre perfis é real e continua sendo
   * mostrada — mas ela é herdada, não obra de quem está mexendo agora.
   *
   * ⚠️ Sem esta distinção o aviso nasce inútil: duplicar o Administrativo sem
   * tocar em nada já produzia **4 avisos**, porque o instrumento herdado do
   * RD8010 de fato pesa diferente entre perfis. Aviso que aparece sempre deixa
   * de ser lido — e aí ele não protege o dia em que a diferença é nova.
   */
  novo: boolean;
  /**
   * A frase pronta. ⚠️ Ela **descreve**, não recomenda: quem decide se a
   * diferença é intencional é o RH.
   */
  frase: string;
}

const arred = (v: number) => Math.round(v * 100) / 100;
const numero = (v: number) => arred(v).toString().replace('.', ',');
const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

/**
 * ⚠️ O gatilho é o PESO POR QUESTÃO, não a contagem.
 *
 * Contagem diferente com peso proporcional (16 em 3 aqui, 32 em 6 lá) dá o
 * mesmo 5,33 por questão — a régua é a mesma e não há o que avisar. Avisar por
 * contagem encheria a tela de linhas em que nada muda, e aviso que aparece
 * sempre deixa de ser lido.
 */
const DIFERENCA_MINIMA = 0.01;

export function avisosDeComparabilidade(
  perfil: PerfilComparavel,
  outrosPerfis: readonly PerfilComparavel[],
  /**
   * A versão publicada DESTE mesmo perfil, quando existe. Serve só para dizer
   * se a diferença é nova — nunca para comparar perfis entre si.
   */
  publicadaDestePerfil?: PerfilComparavel | null,
): AvisoDeComparabilidade[] {
  const contar = (p: PerfilComparavel, classificacaoId: string) =>
    p.questoes.filter((q) => q.classificacaoId === classificacaoId).length;

  const avisos: AvisoDeComparabilidade[] = [];

  for (const g of perfil.grupos) {
    const questoesAqui = contar(perfil, g.classificacaoId);
    if (questoesAqui === 0) continue; // já é problema próprio, não comparabilidade
    const aqui = { peso: g.peso, questoes: questoesAqui, porQuestao: arred(g.peso / questoesAqui) };

    const outros: LinhaDaComparacao[] = [];
    for (const o of outrosPerfis) {
      const grupo = o.grupos.find((x) => x.classificacaoId === g.classificacaoId);
      const questoes = contar(o, g.classificacaoId);
      if (!grupo || questoes === 0) continue;
      outros.push({
        modeloNome: o.modeloNome,
        versao: o.versao,
        publicado: o.publicado,
        peso: grupo.peso,
        questoes,
        porQuestao: arred(grupo.peso / questoes),
      });
    }

    const divergentes = outros.filter(
      (o) => Math.abs((o.porQuestao as number) - aqui.porQuestao) >= DIFERENCA_MINIMA,
    );
    if (divergentes.length === 0) continue;

    const detalhe = divergentes
      .map(
        (o) =>
          `${o.modeloNome} v${o.versao}: ${plural(o.questoes, 'questão', 'questões')}, ` +
          `${numero(o.porQuestao as number)} cada`,
      )
      .join(' · ');

    /**
     * O mesmo cálculo, na versão publicada deste perfil. Igual = herdado.
     * Sem versão publicada (perfil novo), tudo é novo — não há herança.
     */
    let novo = true;
    if (publicadaDestePerfil) {
      const antes = publicadaDestePerfil.grupos.find(
        (x) => x.classificacaoId === g.classificacaoId,
      );
      const nAntes = contar(publicadaDestePerfil, g.classificacaoId);
      if (antes && nAntes > 0) {
        novo = Math.abs(arred(antes.peso / nAntes) - aqui.porQuestao) >= DIFERENCA_MINIMA;
      }
    }

    avisos.push({
      classificacaoId: g.classificacaoId,
      titulo: g.titulo,
      aqui,
      outros,
      novo,
      frase:
        `"${g.titulo}" vale ${numero(aqui.porQuestao)} por questão aqui ` +
        `(peso ${numero(aqui.peso)} em ${plural(aqui.questoes, 'questão', 'questões')}). ` +
        `Nos outros perfis — ${detalhe}. ` +
        'Uma resposta na mesma classificação pesa diferente conforme o perfil da pessoa. ' +
        (novo
          ? '⚠️ Esta diferença é NOVA — a versão publicada deste perfil não pesava assim. '
          : 'A versão publicada deste perfil já pesava assim. ') +
        'Pode ser intencional; se não for, ajuste o peso ou o número de questões.',
    });
  }

  return avisos;
}
