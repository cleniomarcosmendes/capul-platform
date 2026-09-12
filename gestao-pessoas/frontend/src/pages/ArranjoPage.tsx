/**
 * ⭐⭐ MONTAR O ARRANJO DE UM RASCUNHO — Etapa 3, e a tela de maior risco do módulo.
 *
 * É aqui que o **peso passa a ser escrito pela mão do RH**. Até 12/09 todos os
 * pesos vinham do seed, transcritos do RD8010; a partir daqui alguém digita um
 * número que decide quanto cada coisa vale na nota de mil pessoas.
 *
 * ⭐⭐ **AS DUAS SOMAS FICAM NO TOPO, SEMPRE.** `Soma declarada` é o que foi
 * digitado; `soma distribuída` é o que a nota vai usar. São calculadas por
 * caminhos diferentes no backend e mostradas lado a lado — é a conta da
 * §3.1.86, a que pegou os três defeitos de arredondamento que nenhum teste
 * pegou. Quando divergem, a tela **para de oferecer publicar** e diz o número.
 *
 * ⚠️ **Nada aqui é gravado automaticamente.** O arranjo vai inteiro num `PUT`,
 * no botão Salvar: com gravação por item existe um instante em que a
 * classificação tem peso e ainda não tem questão, e é justamente esse estado
 * que faz as duas somas divergirem.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Info,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import {
  acervo as apiAcervo,
  arranjo as apiArranjo,
  ehFaltaDePermissao,
  mensagemDoErro,
} from '../services/api';
import type {
  AcervoCompleto,
  ArranjoDeEdicao,
  PreviaDaPublicacao,
  QuestaoDoAcervo,
} from '../services/api';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { Modal } from '../components/Modal';
import { contagem } from '../lib/formato';

const num = (v: number) => Number(v.toFixed(2)).toString().replace('.', ',');

/** O que está sendo editado na tela, antes de ir para o banco. */
interface Rascunho {
  grupos: { classificacaoId: string; peso: string }[];
  questoes: string[];
}

export default function ArranjoPage() {
  const { versaoId = '' } = useParams();
  const navegar = useNavigate();
  const [dados, setDados] = useState<ArranjoDeEdicao | null>(null);
  const [acervo, setAcervo] = useState<AcervoCompleto | null>(null);
  const [local, setLocal] = useState<Rascunho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<PreviaDaPublicacao | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  const carregar = useCallback(() => {
    Promise.all([apiArranjo.ler(versaoId), apiAcervo.listar()])
      .then(([a, ac]) => {
        setDados(a);
        setAcervo(ac);
        setLocal({
          grupos: a.grupos.map((g) => ({ classificacaoId: g.classificacaoId, peso: String(g.peso) })),
          questoes: a.questoes.map((q) => q.perguntaId),
        });
      })
      .catch((e) => {
        if (ehFaltaDePermissao(e)) setSemPermissao(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar o arranjo.'));
      });
  }, [versaoId]);

  useEffect(carregar, [carregar]);

  const porId = useMemo(
    () => new Map((acervo?.questoes ?? []).map((q) => [q.id, q])),
    [acervo],
  );

  /**
   * ⚠️ A soma LOCAL, enquanto se digita — só a declarada. A distribuída vem do
   * backend e só se atualiza ao salvar, de propósito: reimplementar a
   * repartição aqui seria a terceira cópia da regra que já custou 59,97.
   */
  const somaLocal = useMemo(
    () => (local?.grupos ?? []).reduce((s, g) => s + (Number(g.peso.replace(',', '.')) || 0), 0),
    [local],
  );

  const sujo = useMemo(() => {
    if (!dados || !local) return false;
    const gruposIguais =
      dados.grupos.length === local.grupos.length &&
      dados.grupos.every(
        (g, i) =>
          g.classificacaoId === local.grupos[i].classificacaoId &&
          Math.abs(g.peso - (Number(local.grupos[i].peso.replace(',', '.')) || 0)) < 1e-9,
      );
    const questoesIguais =
      dados.questoes.length === local.questoes.length &&
      dados.questoes.every((q, i) => q.perguntaId === local.questoes[i]);
    return !(gruposIguais && questoesIguais);
  }, [dados, local]);

  async function salvar() {
    if (!local) return;
    setErro(null);
    setSalvando(true);
    try {
      const a = await apiArranjo.gravar(versaoId, {
        grupos: local.grupos.map((g) => ({
          classificacaoId: g.classificacaoId,
          peso: Number(g.peso.replace(',', '.')) || 0,
        })),
        questoes: local.questoes.map((perguntaId) => ({ perguntaId })),
      });
      setDados(a);
      setLocal({
        grupos: a.grupos.map((g) => ({ classificacaoId: g.classificacaoId, peso: String(g.peso) })),
        questoes: a.questoes.map((q) => q.perguntaId),
      });
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível salvar o arranjo.'));
    } finally {
      setSalvando(false);
    }
  }

  if (semPermissao) {
    return (
      <div className="px-4 pt-5">
        <Vazio
          titulo="Sem permissão para montar o instrumento"
          detalhe="Montar o arranjo é do RH_ADMIN ou do RH_MODELO."
        />
      </div>
    );
  }
  if (erro && !dados) return <Erro mensagem={erro} />;
  if (!dados || !local || !acervo) return <Carregando />;

  if (dados.publicado) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Voltar aoVoltar={() => navegar('/questionarios')} />
        <Vazio
          titulo={`${dados.modeloNome} v${dados.versao} está publicada`}
          detalhe="Versão publicada é imutável — dela saem notas. Duplique-a em Questionários para abrir um rascunho e mexer lá."
        />
      </div>
    );
  }

  const divergem = Math.abs(dados.somaDeclarada - dados.somaDerivada) > 0.0001;
  const classificacoesForaDoArranjo = acervo.classificacoes.filter(
    (c) => !local.grupos.some((g) => g.classificacaoId === c.id),
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-5">
      <Voltar aoVoltar={() => navegar('/questionarios')} />

      <header className="mt-2">
        <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-800">
          {dados.modeloNome} <span className="text-slate-400">v{dados.versao}</span>
          <Etiqueta tom="ambar">rascunho</Etiqueta>
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          O peso mora na <strong>classificação</strong>; cada questão herda o peso da dela,
          repartido entre as questões daquela classificação neste perfil.
        </p>
      </header>

      {/* ⭐⭐ AS DUAS SOMAS. O termo que as concilia está escrito: uma é o que
          foi digitado, a outra é o que a nota usa. Iguais, é conferência. */}
      <div
        className={`mt-4 rounded-2xl border p-3 ${
          divergem ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
          <span>
            Soma <strong className="text-slate-500">declarada</strong>{' '}
            <strong className="tabular-nums text-slate-800">{num(dados.somaDeclarada)}</strong>
          </span>
          <span>
            Soma <strong className="text-slate-500">distribuída</strong>{' '}
            <strong className="tabular-nums text-slate-800">{num(dados.somaDerivada)}</strong>
          </span>
          <span>
            Pontuação máxima{' '}
            <strong className="tabular-nums text-slate-800">{num(dados.pontuacaoMaxima)}</strong>
          </span>
          {sujo && (
            <span className="text-amber-700">
              (não salvo — digitado agora: {num(somaLocal)})
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {divergem ? (
            <span className="font-semibold text-red-800">
              As duas somas não batem. A nota sairia sobre um denominador diferente do que a tela
              mostra — não publique; avise a T.I.
            </span>
          ) : (
            'A declarada é o que foi digitado; a distribuída é o que a nota vai usar. Iguais, confere.'
          )}
        </p>
      </div>

      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro} />
        </div>
      )}

      {/* ── CLASSIFICAÇÕES ─────────────────────────────────────────────────── */}
      <section className="mt-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Classificações e pesos
        </h3>
        <ul className="mt-2 space-y-2">
          {local.grupos.map((g, i) => {
            const info = dados.grupos.find((x) => x.classificacaoId === g.classificacaoId);
            const nome =
              info?.titulo ?? acervo.classificacoes.find((c) => c.id === g.classificacaoId)?.nome ?? '—';
            const quantas = local.questoes.filter(
              (id) => porId.get(id)?.classificacaoId === g.classificacaoId,
            ).length;
            return (
              <li
                key={g.classificacaoId}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <span className="min-w-40 flex-1 text-sm font-medium text-slate-800">{nome}</span>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  peso
                  <input
                    value={g.peso}
                    inputMode="decimal"
                    onChange={(e) =>
                      setLocal({
                        ...local,
                        grupos: local.grupos.map((x, j) =>
                          j === i ? { ...x, peso: e.target.value } : x,
                        ),
                      })
                    }
                    className="alvo-toque w-24 rounded-lg border border-slate-300 px-2 text-right tabular-nums text-slate-800"
                  />
                </label>
                {/* ⚠️ O número que denuncia o furo mais caro: classificação com
                    peso e ZERO questões. O peso dela some da conta. */}
                <span
                  className={`text-sm tabular-nums ${quantas === 0 ? 'font-semibold text-red-700' : 'text-slate-500'}`}
                >
                  {contagem(quantas, 'questão', 'questões')}
                </span>
                <button
                  type="button"
                  title="Tirar do arranjo"
                  onClick={() =>
                    setLocal({ ...local, grupos: local.grupos.filter((_, j) => j !== i) })
                  }
                  className="alvo-toque rounded-lg border border-red-200 px-2 text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        {classificacoesForaDoArranjo.length > 0 && (
          <label className="mt-2 block max-w-md">
            <span className="text-sm text-slate-600">Acrescentar classificação</span>
            <select
              value=""
              onChange={(e) => {
                if (!e.target.value) return;
                setLocal({
                  ...local,
                  grupos: [...local.grupos, { classificacaoId: e.target.value, peso: '0' }],
                });
              }}
              className="alvo-toque mt-1 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
            >
              <option value="">Escolha…</option>
              {classificacoesForaDoArranjo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>

      {/* ── QUESTÕES ───────────────────────────────────────────────────────── */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Questões, na ordem do questionário
          </h3>
          <button
            type="button"
            onClick={() => setEscolhendo(true)}
            className="alvo-toque inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Plus size={15} aria-hidden /> Acrescentar do acervo
          </button>
        </div>
        <ol className="mt-2 space-y-1.5">
          {local.questoes.map((id, i) => {
            const q = porId.get(id);
            const gravada = dados.questoes.find((x) => x.perguntaId === id);
            const temPeso = local.grupos.some((g) => g.classificacaoId === q?.classificacaoId);
            return (
              <li
                key={id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-slate-400">
                  {i + 1}
                </span>
                <span className="min-w-40 flex-1 text-sm text-slate-800">
                  {q?.enunciado ?? '(questão removida do acervo)'}{' '}
                  <span className="text-slate-400">· {q?.classificacaoNome}</span>
                </span>
                {/* ⚠️ "sem peso" nunca vira "peso 0": a questão conta, e ninguém
                    sabe quanto ainda. */}
                {!temPeso ? (
                  <span className="text-sm font-semibold text-red-700">sem peso</span>
                ) : gravada?.peso != null && !sujo ? (
                  <span className="text-sm tabular-nums text-slate-600">peso {num(gravada.peso)}</span>
                ) : (
                  <span className="text-sm text-slate-400">peso ao salvar</span>
                )}
                <div className="flex shrink-0 gap-1">
                  <Mover
                    aoClicar={() => mover(i, -1)}
                    desabilitado={i === 0}
                    titulo="Subir"
                    icone={<ArrowUp size={14} aria-hidden />}
                  />
                  <Mover
                    aoClicar={() => mover(i, 1)}
                    desabilitado={i === local.questoes.length - 1}
                    titulo="Descer"
                    icone={<ArrowDown size={14} aria-hidden />}
                  />
                  <button
                    type="button"
                    title="Tirar do arranjo"
                    onClick={() =>
                      setLocal({ ...local, questoes: local.questoes.filter((_, j) => j !== i) })
                    }
                    className="alvo-toque rounded-lg border border-red-200 px-2 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
          {local.questoes.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Nenhuma questão ainda.
            </li>
          )}
        </ol>
      </section>

      {/* ⭐⭐ COMPARABILIDADE — AVISO, e a diferença para o bloco de baixo é o
          desenho inteiro da Etapa 7. Problema IMPEDE publicar; aviso não toca no
          botão. Os perfis existem para serem diferentes — foi a melhoria que o
          módulo veio fazer. O que o sistema deve é mostrar o número ANTES de
          publicar, não depois, quando a nota já saiu. */}
      {!sujo && dados.avisosDeComparabilidade.length > 0 && (
        <section className="mt-6 rounded-2xl border border-sky-300 bg-sky-50 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-sky-900">
            <Info size={15} aria-hidden />
            Comparação com os outros perfis
            {/* ⭐⭐ O NÚMERO QUE IMPORTA É O DAS NOVAS. Duplicar sem tocar em
                nada já produz avisos — o instrumento herdado do RD8010 pesa
                diferente entre perfis. Contar tudo junto faria o cabeçalho
                dizer o mesmo sempre, e aviso que aparece sempre deixa de ser
                lido. */}
            {(() => {
              const novas = dados.avisosDeComparabilidade.filter((a) => a.novo).length;
              const herdadas = dados.avisosDeComparabilidade.length - novas;
              return (
                <span className="font-normal">
                  {novas > 0 && (
                    <strong className="text-sky-900">
                      {' '}
                      — {contagem(novas, 'diferença nova', 'diferenças novas')}
                    </strong>
                  )}
                  {herdadas > 0 && (
                    <span className="text-sky-700">
                      {novas > 0 ? ' e ' : ' — '}
                      {herdadas} que já vinha{herdadas === 1 ? '' : 'm'} da versão publicada
                    </span>
                  )}
                </span>
              );
            })()}
          </h3>
          <p className="mt-1 text-xs text-sky-800">
            Não impede publicar. A decisão é do RH — perfis diferentes são o motivo de existirem.
          </p>
          {/* As novas primeiro: é onde a atenção tem de cair. */}
          <ul className="mt-2 space-y-2">
            {[...dados.avisosDeComparabilidade]
              .sort((a, b) => Number(b.novo) - Number(a.novo))
              .map((a) => (
              <li key={a.classificacaoId} className="text-sm text-sky-900">
                <strong>{a.titulo}</strong>
                {a.novo ? (
                  <span className="ml-1.5 rounded bg-sky-200 px-1.5 py-0.5 text-xs font-semibold">
                    novo
                  </span>
                ) : (
                  <span className="ml-1.5 text-xs text-sky-700">já vinha da publicada</span>
                )}
                {/* ⚠️ A TABELA, não só a frase: o RH decide comparando números,
                    e o número de cada perfil é o que ele veio ver. */}
                <table className="mt-1 w-full text-left text-xs">
                  <thead className="text-sky-700">
                    <tr>
                      <th className="font-medium">Perfil</th>
                      <th className="font-medium">Peso</th>
                      <th className="font-medium">Questões</th>
                      <th className="font-medium">Por questão</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <tr className="font-semibold">
                      <td>este ({dados.modeloNome})</td>
                      <td>{num(a.aqui.peso)}</td>
                      <td>{a.aqui.questoes}</td>
                      <td>{num(a.aqui.porQuestao)}</td>
                    </tr>
                    {a.outros.map((o) => (
                      <tr key={`${o.modeloNome}-${o.versao}`}>
                        <td>
                          {o.modeloNome} <span className="text-sky-600">v{o.versao}</span>
                        </td>
                        <td>{o.peso === null ? '—' : num(o.peso)}</td>
                        <td>{o.questoes}</td>
                        <td>{o.porQuestao === null ? '—' : num(o.porQuestao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── O QUE FALTA PARA PUBLICAR ──────────────────────────────────────── */}
      {!sujo && dados.problemasParaPublicar.length > 0 && (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <AlertTriangle size={15} aria-hidden />
            {contagem(dados.problemasParaPublicar.length, 'coisa', 'coisas')} antes de publicar
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {dados.problemasParaPublicar.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {!sujo && dados.problemasParaPublicar.length === 0 && (
        <p className="mt-6 flex items-center gap-1.5 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          <Check size={15} aria-hidden /> Nada falta — esta versão pode ser publicada.
        </p>
      )}

      {/* ── BARRA DE AÇÃO ──────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2">
          {sujo && (
            <span className="mr-auto text-sm text-amber-700">
              Alterações não salvas — a distribuição do peso só é recalculada ao salvar.
            </span>
          )}
          <button
            type="button"
            disabled={salvando || !sujo}
            onClick={() => void salvar()}
            className="alvo-toque inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            <Save size={15} aria-hidden /> Salvar arranjo
          </button>
          <button
            type="button"
            /* ⚠️ Publicar com alteração pendente publicaria o que está no banco,
               não o que está na tela — a §3.1.33 na sua forma mais cara. */
            title={
              sujo
                ? 'Salve o arranjo antes: publicar gravaria o que está no banco, não o que está na tela.'
                : divergem
                  ? 'As duas somas não batem.'
                  : 'Publicar esta versão'
            }
            disabled={salvando || sujo || divergem || dados.problemasParaPublicar.length > 0}
            onClick={() =>
              void apiArranjo
                .previaPublicar(versaoId)
                .then(setPrevia)
                .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível consultar a prévia.')))
            }
            className="alvo-toque inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-40"
          >
            <Send size={15} aria-hidden /> Publicar
          </button>
        </div>
      </div>

      {escolhendo && (
        <EscolherQuestoes
          acervo={acervo}
          jaNoArranjo={new Set(local.questoes)}
          aoFechar={() => setEscolhendo(false)}
          aoEscolher={(ids) => {
            setLocal({ ...local, questoes: [...local.questoes, ...ids] });
            setEscolhendo(false);
          }}
        />
      )}

      {previa && (
        <DialogoDePublicar
          previa={previa}
          aoFechar={() => setPrevia(null)}
          aoPublicar={async () => {
            setSalvando(true);
            try {
              await apiArranjo.publicar(versaoId);
              setPrevia(null);
              carregar();
            } catch (e) {
              setErro(mensagemDoErro(e, 'Não foi possível publicar.'));
              setPrevia(null);
            } finally {
              setSalvando(false);
            }
          }}
        />
      )}
    </div>
  );

  function mover(i: number, d: -1 | 1) {
    if (!local) return;
    const alvo = i + d;
    if (alvo < 0 || alvo >= local.questoes.length) return;
    const q = [...local.questoes];
    [q[i], q[alvo]] = [q[alvo], q[i]];
    setLocal({ ...local, questoes: q });
  }
}

function Voltar({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoVoltar}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
    >
      <ArrowLeft size={15} aria-hidden /> Questionários
    </button>
  );
}

function Mover({
  aoClicar,
  desabilitado,
  titulo,
  icone,
}: {
  aoClicar: () => void;
  desabilitado: boolean;
  titulo: string;
  icone: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={aoClicar}
      disabled={desabilitado}
      className="alvo-toque rounded-lg border border-slate-300 px-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
    >
      {icone}
    </button>
  );
}

/** Escolher questões do acervo. Mostra a classificação, que é o que decide o peso. */
function EscolherQuestoes({
  acervo,
  jaNoArranjo,
  aoFechar,
  aoEscolher,
}: {
  acervo: AcervoCompleto;
  jaNoArranjo: Set<string>;
  aoFechar: () => void;
  aoEscolher: (ids: string[]) => void;
}) {
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const disponiveis = acervo.questoes.filter((q: QuestaoDoAcervo) => !jaNoArranjo.has(q.id));

  return (
    <Modal titulo="Acrescentar questões do acervo" aoFechar={aoFechar} largura="ampla">
      {/* ⚠️ Questão inativa aparece MARCADA, não escondida: esconder faria a
          pessoa procurar uma questão que existe. Publicar com ela é que é
          recusado, e a recusa diz por quê. */}
      <ul className="max-h-[50dvh] space-y-1 overflow-y-auto">
        {disponiveis.map((q) => (
          <li key={q.id}>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg p-1.5 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={marcadas.has(q.id)}
                onChange={(e) => {
                  const s = new Set(marcadas);
                  if (e.target.checked) s.add(q.id);
                  else s.delete(q.id);
                  setMarcadas(s);
                }}
                className="mt-1"
              />
              <span className="text-sm text-slate-800">
                {q.enunciado}{' '}
                <span className="text-slate-400">· {q.classificacaoNome}</span>
                {!q.ativa && <span className="ml-1 text-amber-700">(inativa)</span>}
              </span>
            </label>
          </li>
        ))}
        {disponiveis.length === 0 && (
          <li className="p-3 text-center text-sm text-slate-500">
            Todas as questões do acervo já estão neste perfil.
          </li>
        )}
      </ul>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={marcadas.size === 0}
          onClick={() => aoEscolher([...marcadas])}
          className="alvo-toque rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Acrescentar {marcadas.size > 0 && `(${marcadas.size})`}
        </button>
      </div>
    </Modal>
  );
}

function DialogoDePublicar({
  previa,
  aoFechar,
  aoPublicar,
}: {
  previa: PreviaDaPublicacao;
  aoFechar: () => void;
  aoPublicar: () => void;
}) {
  const mudouAEscala =
    previa.somaDaPublicadaAtual !== null &&
    Math.abs(previa.somaDaPublicadaAtual - previa.somaDeclarada) > 0.0001;
  return (
    <Modal titulo={`Publicar ${previa.modeloNome} v${previa.versao}?`} aoFechar={aoFechar}>
      <p className="text-sm text-slate-700">{previa.frase}</p>

      {/* ⚠️ Comparar com a versão publicada atual é FATO, não aviso — o aviso de
          comparabilidade entre perfis é outra frente. Aqui só se diz que a
          escala do próprio perfil mudou, porque isso muda o significado de
          "60" para quem lê os dois questionários lado a lado. */}
      {mudouAEscala && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-900">
          A soma dos pesos era <strong>{num(previa.somaDaPublicadaAtual as number)}</strong> na
          versão publicada e passa a ser <strong>{num(previa.somaDeclarada)}</strong>. A nota é
          normalizada, então a escala não muda a nota — mas os dois questionários deixam de ser
          lidos na mesma régua.
        </p>
      )}

      {/* ⭐ Os mesmos avisos, no último momento em que ainda mudam algo — e o
          botão continua habilitado. Aviso que bloqueia é problema mal
          classificado. */}
      {previa.avisosDeComparabilidade.length > 0 && (
        <div className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-sm text-sky-900">
          {/* ⭐ No último momento em que ainda muda algo, só as NOVAS: as
              herdadas o RH já conhece, e repeti-las aqui afogaria a que ele
              acabou de criar. */}
          {(() => {
            const novas = previa.avisosDeComparabilidade.filter((a) => a.novo);
            const herdadas = previa.avisosDeComparabilidade.length - novas.length;
            return (
              <>
                <p className="font-semibold">
                  {novas.length > 0
                    ? `${contagem(novas.length, 'diferença nova', 'diferenças novas')} em relação aos outros perfis — não impede publicar:`
                    : 'Nenhuma diferença nova em relação aos outros perfis.'}
                </p>
                {novas.length > 0 && (
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {novas.map((a) => (
                      <li key={a.classificacaoId}>{a.frase}</li>
                    ))}
                  </ul>
                )}
                {herdadas > 0 && (
                  <p className="mt-1 text-xs text-sky-700">
                    Outras {herdadas} diferenças já vinham da versão publicada deste perfil.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {previa.problemas.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 rounded-lg bg-red-50 py-2 pl-7 pr-3 text-sm text-red-800">
          {previa.problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={previa.problemas.length > 0}
          onClick={aoPublicar}
          className="alvo-toque rounded-xl bg-emerald-700 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          Publicar
        </button>
      </div>
    </Modal>
  );
}
