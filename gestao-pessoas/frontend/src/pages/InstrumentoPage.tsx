/**
 * ⭐⭐ O QUESTIONÁRIO, PARA LER — a tela que responde a pergunta que trava o resto.
 *
 * As 44 perguntas dos 4 modelos vieram transcritas do **RD8010 `000004` + SQP010
 * + RDB010** pelo `prisma/seed.ts`. **Ninguém do RH escolheu enunciado, peso ou
 * alternativa**, e até 11/09/2026 não havia como ler o texto delas: o catálogo
 * devolve `perguntas: 11`, uma contagem. A gestora não tinha como responder
 * *"este questionário é o que você quer usar no piloto?"* — e essa resposta muda
 * a ordem de todo o trabalho que vem depois.
 *
 * ⚠️ **O CONTEÚDO continua sendo leitura pura** — enunciado, peso e alternativa
 * não se editam aqui, e o editor do arranjo é a Etapa 3. O que entrou em 12/09
 * (Etapa 2) foi só o CICLO DE VIDA DA VERSÃO: duplicar uma versão publicada
 * para um rascunho, e descartar o rascunho.
 *
 * ⚠️ O aviso da tela foi reescrito DUAS vezes no mesmo dia, e a segunda é a
 * lição: ele dizia *"editar o rascunho ainda não — passa pela T.I."* horas
 * depois de a tela de montar o arranjo entrar no ar. **Texto que nega
 * capacidade existente faz alguém deixar de usar o que já funciona** — é a
 * §3.1.33 pelo avesso, e custa mais que prometer o que não existe, porque
 * ninguém reclama de uma função que acredita não existir.
 *
 * ⚠️ O nome no menu é **"Questionários"**, não "Editar questionários": ele
 * descreve o objeto, não uma capacidade que não existe.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, Copy, FileText, Info, Pencil, Printer, Sigma, Trash2 } from 'lucide-react';
import { catalogo, ehFaltaDePermissao, mensagemDoErro, versoes as apiVersoes } from '../services/api';
import type { Efeito, InstrumentoCompleto, ModeloDoCatalogo, VersaoDoModelo } from '../services/api';
import { Modal } from '../components/Modal';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { contagem, data, flexao } from '../lib/formato';

/** Número com até 2 casas e vírgula, sem zeros à toa: 5.33 -> "5,33", 6 -> "6". */
function num(v: number): string {
  return Number(v.toFixed(2)).toString().replace('.', ',');
}
function pct(v: number): string {
  return `${num(v)}%`;
}

export default function InstrumentoPage() {
  const [modelos, setModelos] = useState<ModeloDoCatalogo[] | null>(null);
  const [versaoId, setVersaoId] = useState<string>('');
  const [inst, setInst] = useState<InstrumentoCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  /**
   * ⚠️ Quem pode VERSIONAR — descoberto perguntando ao backend, não
   * reimplementando a tabela de papéis. O bloco de versões some para quem não
   * pode, e o AVISO acima precisa saber disso: senão ensina um caminho que a
   * pessoa não tem.
   */
  const [podeVersionar, setPodeVersionar] = useState(false);

  useEffect(() => {
    void carregarModelos();
  }, []);

  useEffect(() => {
    void catalogo.modelos().then((lista) => {
      const algum = lista[0]?.versoes[0]?.id;
      if (!algum) return;
      apiVersoes
        .previaDeDuplicar(algum)
        .then(() => setPodeVersionar(true))
        .catch(() => setPodeVersionar(false));
    });
  }, []);

  useEffect(() => {
    if (!versaoId) return;
    setInst(null);
    void carregarInstrumento(versaoId);
  }, [versaoId]);

  /**
   * @param manter versão que deve continuar selecionada. Sem ela, a tela abre
   *   no primeiro modelo de PRODUÇÃO — o que é certo na primeira carga e
   *   ERRADO em toda recarga depois de um ato, porque joga a pessoa para outro
   *   perfil sem ela ter pedido.
   */
  async function carregarModelos(manter?: string) {
    setErro(null);
    try {
      const lista = await catalogo.modelos();
      setModelos(lista);
      if (manter) return;
      // Abre já no primeiro modelo de PRODUÇÃO — o [DEMO] não é o que o RH veio ver.
      const primeira = lista.find((m) => m.finalidade === 'PRODUCAO')?.versoes[0] ?? lista[0]?.versoes[0];
      if (primeira) setVersaoId(primeira.id);
    } catch (e) {
      setSemPermissao(ehFaltaDePermissao(e));
      setErro(mensagemDoErro(e, 'Não foi possível carregar os questionários.'));
    }
  }

  async function carregarInstrumento(id: string) {
    setErro(null);
    try {
      setInst(await catalogo.instrumento(id));
    } catch (e) {
      setSemPermissao(ehFaltaDePermissao(e));
      setErro(mensagemDoErro(e, 'Não foi possível carregar o questionário.'));
    }
  }

  if (erro) {
    return (
      <div className="px-4 pt-5">
        <Erro
          mensagem={erro}
          aoTentarDeNovo={semPermissao ? undefined : () => void carregarModelos()}
          dica={semPermissao ? 'Ver o questionário é de quem trabalha no instrumento ou no ciclo — peça acesso à gestora de RH.' : undefined}
        />
      </div>
    );
  }
  if (!modelos) return <div className="px-4 pt-5"><Carregando /></div>;
  if (modelos.length === 0) {
    return (
      <div className="px-4 pt-5">
        <Vazio
          titulo="Nenhum questionário no catálogo"
          detalhe="Os modelos são criados pelo seed do módulo. Se a lista está vazia, o seed não rodou neste ambiente."
        />
      </div>
    );
  }

  const versoes = modelos.flatMap((m) =>
    m.versoes.map((v) => ({ ...v, modeloNome: m.nome, finalidade: m.finalidade })),
  );

  return (
    <div className="px-4 pb-24 pt-5">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Questionários</h2>
          <p className="text-sm text-slate-500">
            As perguntas, os pesos e as alternativas de cada modelo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="alvo-toque inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 print:hidden"
        >
          <Printer size={15} aria-hidden /> Imprimir
        </button>
      </div>

      {/* ⭐ O AVISO VEM ANTES DO CONTEÚDO, e diz por onde a mudança passa.
          "Somente leitura" sozinho deixa a pessoa procurando o botão; dizer que
          a alteração passa pela T.I. hoje responde a pergunta seguinte, que ela
          faria de qualquer jeito. */}
      {/* ⚠️ Reescrito em 12/09: dizia "não há por onde editá-lo no sistema", e
          passou a ser meia verdade no dia em que o duplicar nasceu. O aviso
          agora separa o que JÁ dá (abrir um rascunho) do que ainda não dá
          (mexer no conteúdo dele) — porque é a segunda metade que a pessoa vai
          procurar assim que clicar em Duplicar. */}
      <div className="mt-3 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 print:hidden">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
        <p className="text-sm text-amber-900">
          {/* ⚠️ O texto ensinava a usar Duplicar, Montar e Publicar — botões que
              o RH_CICLO NÃO VÊ: o bloco de versões some inteiro para quem não
              pode versionar. Ele lia a instrução, procurava os botões e não
              achava, e a conclusão razoável é que a tela está quebrada. Texto
              que ensina um caminho tem de saber se a pessoa tem o caminho. */}
          <strong className="font-semibold">Versão publicada não se edita</strong> — dela saem
          notas.{' '}
          {podeVersionar ? (
            <>
              O caminho é: <strong>Duplicar</strong> (abaixo) cria um rascunho,{' '}
              <strong>Montar</strong> abre o editor dele — classificações, pesos e quais questões
              entram —, e <strong>Publicar</strong> o torna o instrumento vigente. Enunciado e
              alternativas de cada questão se editam no <strong>Acervo</strong>.
            </>
          ) : (
            <>
              Para você esta tela é de <strong>leitura</strong>: mudar o questionário é de quem
              monta o instrumento (RH_ADMIN ou RH_MODELO). O que você escolhe ao montar uma
              aplicação é <strong>qual versão publicada</strong> usar.
            </>
          )}
        </p>
      </div>

      <label className="mt-4 block max-w-xl">
        <span className="text-sm font-medium text-slate-700">Modelo</span>
        <select
          value={versaoId}
          onChange={(e) => setVersaoId(e.target.value)}
          className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
        >
          {versoes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.modeloNome} · v{v.versao} · {contagem(v.perguntas, 'pergunta', 'perguntas')}
              {v.finalidade === 'DEMONSTRACAO' ? ' (DEMONSTRAÇÃO)' : ''}
            </option>
          ))}
        </select>
      </label>

      {inst && (
        <VersoesDoModelo
          modeloId={inst.modeloId}
          versaoId={inst.versaoId}
          /**
           * ⚠️ A versão nova é selecionada ANTES de recarregar a lista de
           * modelos. Na ordem inversa (que era a de 12/09), `carregarModelos`
           * repunha a "primeira de PRODUÇÃO" e a tela pulava para o
           * Administrativo — um perfil protegido, com Montar e Descartar à mão
           * de quem tinha acabado de duplicar OUTRO. E como o `<select>` só
           * recebe a versão nova depois do recarregamento, ela não aparecia
           * até dar F5.
           */
          aoMudar={async (id) => {
            if (id) setVersaoId(id);
            await carregarModelos(id);
          }}
        />
      )}

      {!inst && <div className="mt-4"><Carregando linhas={6} /></div>}
      {inst && <Instrumento inst={inst} />}
    </div>
  );
}

function Instrumento({ inst }: { inst: InstrumentoCompleto }) {
  /**
   * ⭐⭐ AS DUAS PONTUAÇÕES MÁXIMAS. A gravada saiu da publicação; a calculada
   * sai agora, sobre as perguntas que estão no banco. Iguais, é conferência.
   * Diferentes, alguém mexeu por fora e a nota de todo mundo está saindo sobre
   * um denominador que não é o do instrumento — e isso não pode ficar mudo.
   */
  const divergem =
    inst.pontuacaoMaximaGravada !== null &&
    Math.abs(inst.pontuacaoMaximaGravada - inst.pontuacaoMaximaCalculada) > 0.0001;

  return (
    <section className="mt-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <FileText size={16} className="text-slate-400" aria-hidden />
          <h3 className="font-semibold text-slate-800">
            {inst.modeloNome} · v{inst.versao}
          </h3>
          {inst.finalidade === 'DEMONSTRACAO' && (
            <Etiqueta tom="ambar">DEMONSTRAÇÃO — não abre ciclo válido</Etiqueta>
          )}
          {!inst.ativo && <Etiqueta tom="neutro">inativo</Etiqueta>}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          {/* ⚠️ "Classificações", não "Grupos". Eram o MESMO número com dois
              nomes na mesma tela — e "Classificações" é também o nome do
              cadastro no menu, então é ele que vale: o termo da tela é o termo
              do cadastro, senão a pessoa procura "grupos" e não acha. */}
          <Dado rotulo="Classificações" valor={String(inst.totalGrupos)} />
          <Dado rotulo="Perguntas" valor={String(inst.totalPerguntas)} />
          <Dado rotulo="Alternativas" valor={String(inst.totalAlternativas)} />
          <Dado rotulo="Publicado em" valor={data(inst.publicadoEm)} />
          <Dado rotulo="Soma dos pesos" valor={num(inst.somaDosPesos)} />
          <Dado
            rotulo="Pontuação máxima"
            valor={num(inst.pontuacaoMaximaCalculada)}
            /* O termo que concilia os dois números — regra 15. */
            nota={
              inst.pontuacaoMaximaGravada === null
                ? 'ainda não publicada'
                : divergem
                  ? `gravada na publicação: ${num(inst.pontuacaoMaximaGravada)}`
                  : 'confere com a gravada na publicação'
            }
          />
          <Dado
            rotulo="Em uso"
            valor={
              inst.aplicacoesQueUsam === 0
                ? 'nenhuma aplicação'
                : contagem(inst.aplicacoesQueUsam, 'aplicação', 'aplicações')
            }
          />
        </dl>

        {divergem && (
          <p className="mt-3 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <strong className="font-semibold">As duas pontuações máximas não batem.</strong> A
              publicação gravou {num(inst.pontuacaoMaximaGravada!)} e as perguntas que estão no
              banco somam {num(inst.pontuacaoMaximaCalculada)}. Toda nota deste modelo sai dividida
              pela gravada — avise a T.I. antes de usar este questionário.
            </span>
          </p>
        )}
      </header>

      <ol className="mt-3 space-y-3">
        {inst.grupos.map((g) => (
          <li key={g.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="font-semibold text-slate-800">{g.titulo}</h4>
              {/* ⭐ Depois do acervo (11/09) o peso É do grupo — declarado no
                  arranjo do perfil. O rótulo mudou junto: dizer "soma das
                  perguntas" mandaria quem quer alterar o número procurar na
                  pergunta, que é justamente onde ele não está mais. */}
              <span className="text-sm text-slate-500">
                <Sigma size={13} className="mr-1 inline text-slate-400" aria-hidden />
                peso da classificação: <strong className="tabular-nums">{num(g.pesoTotal)}</strong> ·{' '}
                {pct(g.percentual)} do questionário
              </span>
            </div>

            <ol className="mt-3 space-y-3">
              {g.perguntas.map((p, i) => (
                <li key={p.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-slate-800">
                      <span className="mr-1.5 text-slate-400 tabular-nums">{i + 1}.</span>
                      {p.enunciado}
                    </p>
                    {/* "peso derivado": o número não se edita aqui nem existe no
                        banco — vem do peso do grupo repartido entre as questões
                        dele NESTE perfil. */}
                    <span className="text-xs text-slate-500">
                      peso derivado <strong className="tabular-nums">{num(p.peso)}</strong> ·{' '}
                      {pct(p.percentualDoPeso)} · vale até{' '}
                      <strong className="tabular-nums">{num(p.pontuacaoMaxima)}</strong>
                      {p.codigoOrigem && <span className="ml-1.5 text-slate-400">RD8010 {p.codigoOrigem}</span>}
                    </span>
                  </div>

                  <ul className="mt-2 space-y-1">
                    {p.alternativas.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-baseline gap-2 text-sm text-slate-700"
                      >
                        <span
                          className={`w-12 shrink-0 rounded-md px-1.5 py-0.5 text-center text-xs tabular-nums ${
                            a.maiorValor
                              ? 'bg-capul-50 font-semibold text-capul-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {num(a.valor)}
                        </span>
                        <span>{a.descricao}</span>
                      </li>
                    ))}
                  </ul>
                  {p.alternativas.length === 0 && (
                    <p className="mt-2 text-sm text-amber-800">
                      ⚠️ Sem alternativa nenhuma — esta pergunta não pode ser respondida.
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {g.perguntas.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">Grupo sem perguntas.</p>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs text-slate-500">
        {contagem(inst.totalPerguntas, 'pergunta', 'perguntas')} em{' '}
        {contagem(inst.totalGrupos, 'classificação', 'classificações')} ·{' '}
        {flexao(inst.totalAlternativas, 'a alternativa vale', 'as alternativas valem')} 0,3 · 0,6 ·
        0,9 · 1,2, como no RD8010. A nota do questionário é a soma de{' '}
        <em>peso × valor ÷ maior valor</em> dividida pela soma dos pesos.
      </p>
    </section>
  );
}

function Dado({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{rotulo}</dt>
      <dd className="font-medium tabular-nums text-slate-800">{valor}</dd>
      {nota && <dd className="text-xs text-slate-500">{nota}</dd>}
    </div>
  );
}

/**
 * ⭐⭐ AS VERSÕES DO PERFIL — o ciclo de vida, que a Etapa 2 abriu.
 *
 * ⚠️ Um rascunho por perfil, e a recusa vem do backend com a frase pronta
 * (`previa-duplicar`), não de uma regra escrita aqui. A prévia é a MESMA função
 * que o ato consulta: se a tela tivesse a própria cópia, ela prometeria o que o
 * ato recusa — foi o defeito do §3.1.33.
 */
function VersoesDoModelo({
  modeloId,
  versaoId,
  aoMudar,
}: {
  modeloId: string;
  versaoId: string;
  aoMudar: (novaVersaoId?: string) => void | Promise<void>;
}) {
  const [lista, setLista] = useState<VersaoDoModelo[] | null>(null);
  const [previa, setPrevia] = useState<Efeito | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [confirmando, setConfirmando] = useState<VersaoDoModelo | null>(null);
  const [duplicando, setDuplicando] = useState<VersaoDoModelo | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    setLista(null);
    setSemPermissao(false);
    apiVersoes
      .doModelo(modeloId)
      .then(setLista)
      .catch((e) => {
        // ⚠️ Sem permissão o bloco INTEIRO some — RH_CICLO lê o instrumento,
        // mas não versiona. Erro vermelho aqui seria ruído numa tela que ele
        // tem todo o direito de ver.
        if (ehFaltaDePermissao(e)) setSemPermissao(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar as versões.'));
      });
  }, [modeloId]);

  async function abrirDuplicar(v: VersaoDoModelo) {
    setErro(null);
    try {
      setPrevia(await apiVersoes.previaDeDuplicar(v.id));
      setDuplicando(v);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível consultar o efeito.'));
    }
  }

  async function agir(f: () => Promise<unknown>, novaVersao?: (r: unknown) => string | undefined) {
    setErro(null);
    setOcupado(true);
    try {
      const r = await f();
      const lista2 = await apiVersoes.doModelo(modeloId);
      setLista(lista2);
      await aoMudar(novaVersao?.(r));
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível concluir.'));
    } finally {
      setOcupado(false);
      setConfirmando(null);
      setDuplicando(null);
    }
  }

  if (semPermissao) return null;
  if (!lista) return null;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Versões deste perfil
      </h3>
      {erro && (
        <div className="mt-2">
          <Erro mensagem={erro} />
        </div>
      )}
      <ul className="mt-2 divide-y divide-slate-100">
        {lista.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0 text-sm">
              <span className={v.id === versaoId ? 'font-semibold text-slate-800' : 'text-slate-700'}>
                v{v.versao}
              </span>{' '}
              {/* ⚠️ "publicada" não basta quando há duas — e há, por desenho:
                  a Aplicação aponta para uma versão ESPECÍFICA, então
                  despublicar a anterior deixaria os ciclos que a usam sem
                  instrumento. A varredura viu v1 e v2 publicadas no mesmo dia,
                  sem hora e sem marca, e não tinha como saber qual valia. */}
              {!v.publicadoEm ? (
                <Etiqueta tom="ambar">rascunho</Etiqueta>
              ) : v.vigente ? (
                <Etiqueta tom="verde">vigente · publicada em {data(v.publicadoEm)}</Etiqueta>
              ) : (
                <Etiqueta tom="neutro">
                  anterior · publicada em {data(v.publicadoEm)}
                </Etiqueta>
              )}
              {/* ⭐ Os três números que conciliam com o que a tela abaixo mostra:
                  classificações, questões e a soma dos pesos (60 no herdado). */}
              <span className="ml-1 text-slate-500">
                · {contagem(v.totalGrupos, 'classificação', 'classificações')} ·{' '}
                {contagem(v.totalQuestoes, 'questão', 'questões')} · soma {num(v.somaDosPesos)}
                {/* ⭐ A versão anterior não é lixo: ela continua sendo a régua
                    dos ciclos que a usam, e é por isso que não se apaga. */}
                {v.aplicacoesQueUsam > 0 &&
                  ` · ainda em uso por ${contagem(v.aplicacoesQueUsam, 'aplicação', 'aplicações')}`}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* ⭐ Capacidade com CAMINHO na tela: a rota /arranjo existe desde
                  a Etapa 3, e sem este botão não haveria como chegar nela. */}
              {!v.publicadoEm && (
                <a
                  href={`/gestao-pessoas/arranjo/${v.id}`}
                  className="alvo-toque inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 text-sm font-medium text-white"
                >
                  <Pencil size={15} aria-hidden /> Montar
                </a>
              )}
              {v.publicadoEm && (
                <button
                  type="button"
                  onClick={() => void abrirDuplicar(v)}
                  disabled={ocupado}
                  className="alvo-toque inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                >
                  <Copy size={15} aria-hidden /> Duplicar
                </button>
              )}
              <button
                type="button"
                /* ⭐ Desabilitado COM o motivo, nunca escondido: o `title` é a
                   frase que a API devolveria. */
                title={v.efeitoDeDescartar.frase}
                onClick={() => setConfirmando(v)}
                disabled={ocupado || v.efeitoDeDescartar.acao === 'RECUSAR'}
                className="alvo-toque inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-30"
              >
                <Trash2 size={15} aria-hidden /> Descartar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {duplicando && previa && (
        <Modal titulo={`Duplicar a v${duplicando.versao}?`} aoFechar={() => setDuplicando(null)}>
          <p className="text-sm text-slate-700">{previa.frase}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDuplicando(null)}
              className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || previa.acao === 'RECUSAR'}
              onClick={() =>
                void agir(
                  () => apiVersoes.duplicar(duplicando.id),
                  (r) => (r as { id: string }).id,
                )
              }
              className="alvo-toque rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Criar rascunho
            </button>
          </div>
        </Modal>
      )}

      {confirmando && (
        <Modal
          titulo={`Descartar o rascunho v${confirmando.versao}?`}
          aoFechar={() => setConfirmando(null)}
        >
          <p className="text-sm text-slate-700">{confirmando.efeitoDeDescartar.frase}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(null)}
              className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void agir(() => apiVersoes.descartar(confirmando.id))}
              className="alvo-toque rounded-xl bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Descartar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
