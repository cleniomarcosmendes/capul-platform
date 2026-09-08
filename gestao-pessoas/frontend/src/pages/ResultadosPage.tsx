import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronRight, Info, Search, Sigma, User } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { contagem, dataHora, nota } from '../lib/formato';
import { Etiqueta } from '../components/Etiqueta';
import {
  mensagemDoErro,
  resultados as apiResultados,
  type LinhaDeResultado,
  type MemoriaDeCalculo,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';

/**
 * RESULTADOS — a nota final e a conta que chegou nela.
 *
 * ⭐ A APLICAÇÃO aparece ao lado da nota (decisão do RH). A régua de conceitos é
 * do ciclo, mas o instrumento é da aplicação: sem dizer qual questionário a
 * pessoa respondeu, comparar "Supera" de um aprendiz com "Supera" de um
 * supervisor sugere uma equivalência que não existe.
 *
 * ⭐ A MEMÓRIA DE CÁLCULO é o produto de verdade desta tela. Nota sem a conta é
 * um número que ninguém consegue defender numa conversa com o avaliado.
 */
export default function ResultadosPage() {
  const { ciclo } = useOutletContext<ContextoDoCiclo>();
  const [linhas, setLinhas] = useState<LinhaDeResultado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [aplicacao, setAplicacao] = useState('TODAS');
  const [aberta, setAberta] = useState<LinhaDeResultado | null>(null);

  useEffect(() => {
    setLinhas(null);
    setErro(null);
    apiResultados
      .doCiclo(ciclo.id)
      .then(setLinhas)
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível carregar os resultados.')));
  }, [ciclo.id]);

  const aplicacoesDisponiveis = useMemo(
    () => [...new Set((linhas ?? []).map((l) => l.aplicacao))].sort(),
    [linhas],
  );

  const visiveis = (linhas ?? [])
    .filter((l) => aplicacao === 'TODAS' || l.aplicacao === aplicacao)
    .filter((l) => {
      const t = filtro.trim().toLowerCase();
      return !t || l.nome.toLowerCase().includes(t) || l.matricula.includes(t);
    });

  if (erro) return <Erro mensagem={erro} />;
  if (!linhas) return <Carregando linhas={5} />;
  if (linhas.length === 0) {
    return (
      <Vazio
        titulo="Nenhum resultado apurado"
        detalhe="O resultado nasce da apuração, que combina a nota do questionário com os critérios cadastrais. Rode a apuração no Painel."
      />
    );
  }

  const media = visiveis.reduce((s, l) => s + l.notaFinal, 0) / (visiveis.length || 1);
  /** A base do ciclo — quantas avaliações existem, apuradas ou não. */
  const totalDoCiclo = ciclo._count?.avaliacoes ?? linhas.length;
  const parcial = totalDoCiclo > linhas.length;
  const filtrando = visiveis.length !== linhas.length;
  /** A apuração mais recente entre os resultados que estão na tela. */
  const ultimaApuracao = linhas.reduce<string | null>(
    (maior, l) => (!maior || l.calculadoEm > maior ? l.calculadoEm : maior),
    null,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Nome ou matrícula"
            aria-label="Filtrar resultados"
            className="alvo-toque w-full rounded-xl border border-slate-300 pl-9 pr-3 text-slate-800"
          />
        </div>
        {aplicacoesDisponiveis.length > 1 && (
          <label>
            <span className="sr-only">Aplicação</span>
            <select
              value={aplicacao}
              onChange={(e) => setAplicacao(e.target.value)}
              className="alvo-toque rounded-xl border border-slate-300 px-3 text-slate-800"
            >
              <option value="TODAS">Todas as aplicações</option>
              {aplicacoesDisponiveis.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* ⭐⭐ A BASE FICA À VISTA, SEMPRE — não só na hora de apurar.
          "3 resultado(s) · média 62,59" é um número com cara de oficial: a
          média é de 3 pessoas em 894, e nada dizia. Quem abre a tela uma semana
          depois não tem como saber que a apuração foi parcial. E a DATA entra
          pelo mesmo motivo: o resultado é gravado e pode ser reapurado, então
          "quando isto foi apurado" é parte da leitura — sem ela ninguém sabe se
          o número já inclui as avaliações que entraram depois. */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
          <Sigma size={15} aria-hidden />
          <span>
            <strong className="font-semibold tabular-nums text-slate-800">{linhas.length}</strong>{' '}
            de{' '}
            <strong className="font-semibold tabular-nums text-slate-800">{totalDoCiclo}</strong>{' '}
            avaliações do ciclo apuradas
          </span>
          <span aria-hidden>·</span>
          <span>
            média{' '}
            <strong className="font-semibold tabular-nums text-slate-800">{nota(media)}</strong>{' '}
            {filtrando ? (
              <>
                sobre <strong className="tabular-nums">{visiveis.length}</strong> em exibição
              </>
            ) : (
              <>
                sobre essas <strong className="tabular-nums">{linhas.length}</strong>
              </>
            )}
          </span>
        </p>
        {parcial && (
          <p className="mt-1 text-xs text-amber-700">
            Apuração parcial: {contagem(totalDoCiclo - linhas.length, 'avaliação', 'avaliações')} do ciclo ainda não
            entraram nesta conta. Reapurar depois substitui o resultado.
          </p>
        )}
        {ultimaApuracao && (
          <p className="mt-1 text-xs text-slate-500">
            Última apuração em <strong className="font-medium">{dataHora(ultimaApuracao)}</strong>.
          </p>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {visiveis.map((l) => (
          <li key={l.id}>
            {/* ⭐⭐ A LINHA TEM DE PARECER CLICÁVEL (08/09).
                A memória de cálculo é a peça que responde "por que 58,60?" — é o
                que o RH leva para o feedback e para a contestação — e estava
                atrás de um clique que ninguém adivinha: cursor `default`, sem
                seta, e o hover só trocando a cor da borda. Os cartões da fila
                do avaliador, mesma família visual, sempre tiveram chevron.
                ⚠️ Não é enfeite: capacidade sem sinal na tela é capacidade que
                não existe para quem usa — é a mesma classe da rota sem botão. */}
            <button
              type="button"
              onClick={() => setAberta(l)}
              aria-label={`Ver a memória de cálculo de ${l.nome}`}
              className="alvo-toque flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-capul-300 hover:bg-capul-50/40"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium text-slate-800">
                  {l.nome}
                  {l.restrita && <Etiqueta tom="azul">você</Etiqueta>}
                </p>
                <p className="truncate text-sm text-slate-500">
                  {l.matricula} · {l.cargo ?? 'sem cargo'} · {l.aplicacao}
                </p>
                {l.houveRenormalizacao && (
                  <p className="mt-1 text-xs text-amber-700">
                    houve renormalização — algum critério ficou sem dado
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold tabular-nums text-slate-800">{nota(l.notaFinal)}</p>
                {l.conceito && <p className="text-xs text-slate-500">{l.conceito}</p>}
                <p className="mt-0.5 text-[11px] text-capul-700">memória de cálculo</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-slate-300" aria-hidden />
            </button>
          </li>
        ))}
        {visiveis.length === 0 && (
          <li>
            <Vazio titulo="Nada aqui" detalhe="Nenhum resultado corresponde ao filtro." />
          </li>
        )}
      </ul>

      {aberta && <DialogoMemoria resultadoId={aberta.id} aoFechar={() => setAberta(null)} />}
    </div>
  );
}

/**
 * ⭐ RÓTULO primeiro, código depois — e nunca o código sozinho.
 *
 * "45" é o código de grau de instrução do Protheus e "0.5914" é ano em decimal:
 * quem lê a memória de cálculo precisa de "Superior completo" e "0,59 ano". O
 * valor bruto continua ali entre parênteses, porque é ele que se confere contra
 * o cadastro quando alguém contesta.
 */
function valorDoCriterio(c: MemoriaDeCalculo['criterios'][number]): string {
  if (c.semDado) return '—';
  const bruto =
    c.valorTexto ??
    (c.valorBruto === null
      ? null
      : `${nota(c.valorBruto)}${c.unidade ? ` ${c.unidade}` : ''}`);
  if (c.faixaRotulo && bruto) return `${c.faixaRotulo} (${bruto})`;
  return c.faixaRotulo ?? bruto ?? '—';
}

function DialogoMemoria({ resultadoId, aoFechar }: { resultadoId: string; aoFechar: () => void }) {
  const [memoria, setMemoria] = useState<MemoriaDeCalculo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    apiResultados
      .memoria(resultadoId)
      .then(setMemoria)
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível carregar a memória de cálculo.')));
  }, [resultadoId]);

  const pesoTotal = memoria
    ? memoria.pesoAvaliacao + memoria.criterios.filter((c) => !c.semDado).reduce((s, c) => s + c.peso, 0)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal
        aria-label="Memória de cálculo"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        {erro && <Erro mensagem={erro} />}
        {!erro && !memoria && <Carregando linhas={4} />}

        {memoria && (
          <>
            <div className="flex items-start gap-3">
              <User size={20} className="mt-1 shrink-0 text-slate-400" aria-hidden />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800">{memoria.avaliado.nome}</h3>
                <p className="text-sm text-slate-500">
                  {memoria.avaliado.matricula} · {memoria.avaliado.cargo ?? 'sem cargo'} · CC{' '}
                  {memoria.avaliado.centroCusto ?? '—'}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {memoria.aplicacao} · avaliado por {memoria.avaliador.nome}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-semibold tabular-nums text-slate-800">
                  {nota(memoria.notaFinal)}
                </p>
                {memoria.conceito && <p className="text-sm text-slate-500">{memoria.conceito}</p>}
                {/* ⭐ AS DUAS DATAS, JUNTAS — e é a comparação que serve, não
                    cada uma. "Apurado em" sozinho não diz se a apuração é
                    posterior à resposta, que é exatamente a pergunta quando
                    alguém contesta a nota depois de uma reapuração.
                    ⚠️ `enviadaEm` já vinha do backend e a tela descartava: mais
                    um caso da meia rede do §3.1.9. */}
                {memoria.enviadaEm && (
                  <p className="mt-1 text-xs text-slate-400">
                    Enviada em {dataHora(memoria.enviadaEm)}
                  </p>
                )}
                {memoria.calculadoEm && (
                  <p className="text-xs text-slate-400">
                    Apurado em {dataHora(memoria.calculadoEm)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Composição da nota
              </h4>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-1 font-medium">Item</th>
                    <th className="pb-1 text-right font-medium">Valor</th>
                    <th className="pb-1 text-right font-medium">Pontos</th>
                    <th className="pb-1 text-right font-medium">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 font-medium text-slate-800">Questionário</td>
                    <td className="py-1.5 text-right text-slate-500">—</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-800">
                      {nota(memoria.notaAvaliacao)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-600">
                      {memoria.pesoAvaliacao}
                    </td>
                  </tr>
                  {memoria.criterios.map((c) => (
                    <tr key={c.criterioId} className={c.semDado ? 'text-slate-400' : ''}>
                      <td className="py-1.5 font-medium">{c.nome}</td>
                      <td className="py-1.5 text-right">{valorDoCriterio(c)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {c.semDado ? 'sem dado' : (c.pontuacao ?? '—')}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{c.peso}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="pt-2 font-semibold text-slate-800">Nota final</td>
                    <td />
                    <td className="pt-2 text-right font-semibold tabular-nums text-slate-800">
                      {nota(memoria.notaFinal)}
                    </td>
                    <td className="pt-2 text-right tabular-nums text-slate-600">{pesoTotal}</td>
                  </tr>
                </tfoot>
              </table>

              {memoria.houveRenormalizacao && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Um ou mais critérios ficaram sem dado. O peso deles foi redistribuído entre os demais —
                  a pessoa não é penalizada por uma falta de cadastro, mas a composição não é a mesma dos
                  colegas.
                </p>
              )}
            </div>

            {memoria.porGrupo.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Questionário, por grupo
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {memoria.porGrupo.map((g) => (
                    <li key={g.grupoId} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{g.titulo}</span>
                      <span className="w-24 shrink-0">
                        <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <span
                            className="block h-full rounded-full bg-capul-400"
                            style={{ width: `${Math.max(0, Math.min(100, g.nota))}%` }}
                          />
                        </span>
                      </span>
                      <span className="w-14 shrink-0 text-right text-sm tabular-nums text-slate-800">
                        {nota(g.nota)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Calculada agora, sobre as respostas gravadas — não é um número congelado. Grupo é
                  organização visual: o peso está em cada pergunta.
                </p>
              </div>
            )}

            {memoria.observacaoAvaliador && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Observação do avaliador
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {memoria.observacaoAvaliador}
                </p>
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={aoFechar}
          className="alvo-toque mt-6 w-full rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
