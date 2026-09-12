import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react';
import { Carregando, Erro } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { dataHora, nota as fmtNota } from '../lib/formato';
import {
  ancoraEscolhida,
  composicao,
  conferirComposicao,
  proximoNivel,
  type QuestaoDaMemoria,
} from '../lib/devolutiva';
import { devolutivaDoAvaliador, mensagemDoErro, type DevolutivaDoAvaliador } from '../services/api';

/**
 * ⭐⭐ A DEVOLUTIVA — a tela que o AVALIADOR abre COM A PESSOA DO LADO.
 *
 * ── O QUE DECIDE O LAYOUT ───────────────────────────────────────────────────
 *
 * Isto **não é uma tela de auditoria**. É o roteiro de uma conversa, e a ordem
 * é a ordem em que ele vai falar:
 *
 *   1. **nota e conceito** — é o que o avaliado quer ouvir primeiro, e adiar
 *      isso faz a conversa inteira acontecer com a pessoa esperando o número;
 *   2. **pergunta a pergunta, com a âncora escolhida** — é onde a conversa tem
 *      objeto. "Sua nota em Pontualidade foi 25" não diz o que fazer; *"você
 *      ficou em 'atrasa às vezes' e o próximo nível é 'raramente atrasa'"* diz;
 *   3. **a composição, com os critérios** — vem por último porque é a resposta a
 *      UMA pergunta específica: *"por que a final é 69,90 se o questionário deu
 *      63,19?"*. Pôr isso em cima faria a conversa começar por aritmética.
 *
 * ── ⚠️ NADA AQUI RECALCULA NOTA ─────────────────────────────────────────────
 *
 * Todos os números vêm prontos do backend. A tela **reparte para exibir**
 * (`repartirPesos`, que reparte na precisão em que exibe) e **confere que o
 * exibido fecha** (`conferirComposicao`). As quatro somas já morderam o módulo
 * quatro vezes — 22,22% × 22,21%, coluna somando 99,9%, "vale até 72,01",
 * 59,97 num grupo que declarava 60.
 *
 * ⛔ E **não há "enviar", "exportar" nem "marcar como feita"** — conduzir é a
 * etapa 4. Botão que não faz o que promete é pior que botão ausente.
 */
export default function DevolutivaPage() {
  const { id = '' } = useParams();
  const [dados, setDados] = useState<DevolutivaDoAvaliador | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setDados(null);
    setErro(null);
    devolutivaDoAvaliador
      .obter(id)
      .then(setDados)
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível abrir a devolutiva.')));
  }, [id]);

  if (erro) return <ComVoltar><Erro mensagem={erro} /></ComVoltar>;
  if (!dados) return <ComVoltar><Carregando /></ComVoltar>;

  const comp = composicao(dados);
  const conf = conferirComposicao(dados);

  return (
    <ComVoltar>
      {/* ── 1. O QUE ELE FALA PRIMEIRO ───────────────────────────────────── */}
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">{dados.ciclo.nome}</p>
        <h1 className="mt-0.5 text-xl font-semibold text-slate-800">{dados.avaliado.nome}</h1>
        <p className="text-sm text-slate-500">
          {dados.avaliado.matricula}
          {dados.avaliado.cargo ? ` · ${dados.avaliado.cargo}` : ''}
        </p>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-4xl font-semibold tabular-nums text-slate-800">
            {fmtNota(dados.notaFinal)}
          </span>
          <Etiqueta tom="azul">{dados.conceito ?? 'sem conceito'}</Etiqueta>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Liberada pelo RH em {dataHora(dados.devolutivaLiberadaEm)}.
        </p>
      </header>

      {/* ⚠️ A tela CONFERE a própria conta. Se alguma das quatro somas não
          fechar, ela DIZ — em vez de exibir um número que não se sustenta na
          frente do avaliado, que é o pior lugar para descobrir isso. */}
      {!conf.tudoFecha && (
        <div className="mt-3 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">A conta desta avaliação não está fechando.</p>
            <p className="mt-1">
              Não conduza a devolutiva com estes números — avise o RH.{' '}
              {!conf.finalBate &&
                `A nota final refeita dá ${fmtNota(conf.detalhe.finalRefeita)} e a exibida é ${fmtNota(dados.notaFinal)}. `}
              {!conf.gruposBatem &&
                `A soma dos grupos dá ${fmtNota(conf.detalhe.questionarioPelosGrupos)} e o questionário marcou ${fmtNota(dados.notaAvaliacao)}. `}
              {!conf.pesoDosGruposBate &&
                `Os pesos dos grupos somam ${conf.detalhe.somaDosGrupos} e o questionário vale ${dados.pesoAvaliacao}. `}
              {!conf.percentuaisFecham && 'A coluna de percentuais não soma 100. '}
            </p>
          </div>
        </div>
      )}

      {/* ── 2. PERGUNTA A PERGUNTA — onde a conversa tem objeto ───────────── */}
      <section className="mt-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-500">
          O que você respondeu, pergunta a pergunta
        </h2>
        <ul className="space-y-2">
          {dados.porQuestao.map((q) => (
            <Questao key={q.perguntaId} q={q} />
          ))}
        </ul>
      </section>

      {/* ── 3. A COMPOSIÇÃO — a resposta a "por que a final é diferente?" ── */}
      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-500">
          Por que a nota final é {fmtNota(dados.notaFinal)}
        </h2>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Parte</th>
                <th className="px-3 py-2 text-left font-medium">O que valeu</th>
                <th className="px-3 py-2 text-right font-medium">Nota</th>
                <th className="px-3 py-2 text-right font-medium">Peso</th>
                <th className="px-3 py-2 text-right font-medium">Da final</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="px-3 py-2 font-medium text-slate-700">Questionário</td>
                <td className="px-3 py-2 text-slate-500">
                  {dados.porQuestao.length} perguntas
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNota(dados.notaAvaliacao)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dados.pesoAvaliacao}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  {comp.fatias[0]?.pct.toFixed(1).replace('.', ',')}%
                </td>
              </tr>
              {dados.criterios
                .filter((c) => !c.semDado)
                .map((c, i) => (
                  <tr key={c.nome}>
                    <td className="px-3 py-2 font-medium text-slate-700">{c.nome}</td>
                    {/* ⭐ A FAIXA, não o número cru: "SUPERIOR COMPLETO" explica
                        a pontuação; "55" não explica nada a ninguém. */}
                    <td className="px-3 py-2 text-slate-500">
                      {c.faixaRotulo ?? c.valorTexto ?? (c.valorBruto ?? '—')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.pontuacao === null ? '—' : fmtNota(c.pontuacao)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.peso}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {comp.fatias[i + 1]?.pct.toFixed(1).replace('.', ',')}%
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr className="font-semibold text-slate-800">
                <td className="px-3 py-2" colSpan={2}>
                  Nota final
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNota(dados.notaFinal)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{comp.pesoTotal}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {/* ⭐ 100,0% escrito, não calculado: é o fecho da coluna, e
                      escrever a soma de novo abriria espaço para ela divergir. */}
                  100,0%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ⚠️ Critério sem dado sai da conta e NÃO some da tela: sumir faria o
            avaliador procurar um critério que o cadastro não tinha. */}
        {comp.semDado.length > 0 && (
          <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Fora da conta por falta de dado no cadastro:{' '}
            <strong>{comp.semDado.map((c) => c.nome).join(', ')}</strong>. O peso deles foi
            redistribuído entre as outras partes — por isso a soma é {comp.pesoTotal}.
          </p>
        )}

        {dados.houveRenormalizacao && (
          <p className="mt-2 text-xs text-slate-500">
            Esta nota passou por renormalização: faltou dado em algum critério e o peso dele foi
            redistribuído.
          </p>
        )}
      </section>

      {/* ⚠️ A conta por GRUPO fica por último e recolhida: ela serve para quem
          perguntar "de onde saiu 63,19?", e é a pergunta menos frequente. */}
      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          De onde saiu a nota do questionário ({fmtNota(dados.notaAvaliacao)})
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          {dados.porGrupo.map((g) => (
            <li key={g.grupoId} className="flex justify-between gap-3">
              <span className="truncate text-slate-600">{g.titulo}</span>
              <span className="shrink-0 tabular-nums text-slate-700">
                {fmtNota(g.nota)} <span className="text-slate-400">· peso {g.peso}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          Média ponderada dos grupos = <strong>{fmtNota(dados.notaAvaliacao)}</strong>, sobre peso{' '}
          {conf.detalhe.somaDosGrupos}.
        </p>
      </details>
    </ComVoltar>
  );
}

/**
 * ⭐ A âncora ESCOLHIDA e o PRÓXIMO NÍVEL, sempre visíveis; as outras, atrás de
 * um toque.
 *
 * ⚠️ Mostrar as quatro de cada uma das 14 perguntas dá 56 linhas — a tela vira
 * um documento, e quem está conduzindo perde o fio. As duas que a conversa usa
 * são "onde você ficou" e "o que vem depois"; o resto é consulta.
 */
function Questao({ q }: { q: QuestaoDaMemoria }) {
  const [aberta, setAberta] = useState(false);
  const escolhida = ancoraEscolhida(q.ancoras);
  const proxima = proximoNivel(q.ancoras);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="font-medium text-slate-800">{q.enunciado}</p>
      {escolhida ? (
        <p className="mt-1 text-sm text-slate-700">
          <span className="text-slate-400">Você marcou:</span> {escolhida.descricao}
        </p>
      ) : (
        <p className="mt-1 text-sm text-amber-800">Esta pergunta ficou sem resposta.</p>
      )}
      {proxima ? (
        <p className="mt-1 text-sm text-emerald-800">
          <span className="text-emerald-600/70">Próximo nível:</span> {proxima.descricao}
        </p>
      ) : (
        escolhida && (
          // ⭐ O topo é informação, não espaço em branco — é a única coisa boa
          //    que a tela tem para dizer, e ela precisa ser dita.
          <p className="mt-1 text-sm text-emerald-800">É o nível mais alto desta pergunta.</p>
        )
      )}

      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        className="alvo-toque mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        {aberta ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />}
        {aberta ? 'Esconder a escala' : 'Ver a escala inteira'}
      </button>
      {aberta && (
        <ul className="mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3 text-xs text-slate-600">
          {q.ancoras.map((a) => (
            <li key={a.descricao} className={a.escolhida ? 'font-semibold text-slate-800' : ''}>
              {a.escolhida ? '▶ ' : ''}
              {a.descricao}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ComVoltar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl p-4 pb-16">
      <Link
        to="/"
        className="alvo-toque mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} aria-hidden /> Minhas avaliações
      </Link>
      {children}
    </div>
  );
}
