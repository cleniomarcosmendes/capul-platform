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
 * ⚠️ **É LEITURA PURA, e a tela diz isso em voz alta.** O editor de questionário
 * é outro trabalho, de semanas. Tela que parece editável e não é seria a dívida
 * do §3.1.33 outra vez — *texto que promete capacidade é dívida* —, então aqui
 * não há botão de salvar, nem campo, nem menu de ação: há um aviso dizendo por
 * onde a mudança passa hoje.
 *
 * ⚠️ O nome no menu é **"Questionários"**, não "Editar questionários": ele
 * descreve o objeto, não uma capacidade que não existe.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, FileText, Info, Printer, Sigma } from 'lucide-react';
import { catalogo, ehFaltaDePermissao, mensagemDoErro } from '../services/api';
import type { InstrumentoCompleto, ModeloDoCatalogo } from '../services/api';
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

  useEffect(() => {
    void carregarModelos();
  }, []);

  useEffect(() => {
    if (!versaoId) return;
    setInst(null);
    void carregarInstrumento(versaoId);
  }, [versaoId]);

  async function carregarModelos() {
    setErro(null);
    try {
      const lista = await catalogo.modelos();
      setModelos(lista);
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
      <div className="mt-3 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 print:hidden">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden />
        <p className="text-sm text-amber-900">
          <strong className="font-semibold">Esta tela é só de leitura.</strong> O questionário veio
          transcrito do Protheus (RD8010) e ainda não há por onde editá-lo no sistema — mudar
          enunciado, peso ou alternativa passa pela T.I. hoje. Confira e diga o que precisa mudar.
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
          <Dado rotulo="Grupos" valor={String(inst.totalGrupos)} />
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
                peso do grupo: <strong className="tabular-nums">{num(g.pesoTotal)}</strong> ·{' '}
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
        {contagem(inst.totalGrupos, 'grupo', 'grupos')} ·{' '}
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
