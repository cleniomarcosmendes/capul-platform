import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronRight, Download, Info, Search, Sigma, User } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { contagem, dataHora, nota } from '../lib/formato';
import { Etiqueta } from '../components/Etiqueta';
import {
  mensagemDoErro,
  resultados,
  resultados as apiResultados,
  type LinhaDeResultado,
  type MemoriaDeCalculo,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';
import { fracao } from '../lib/composicao-da-nota';

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

  /**
   * ⭐⭐ A MÉDIA EXCLUI A PRÓPRIA LINHA — e é obrigatório que exclua.
   *
   * Esconder a nota e manter a linha dentro da média não esconde nada: com N
   * linhas visíveis e N−1 notas na tela, a própria sai de
   * `média × N − Σ(outras)`. Uma subtração. A omissão só vale se a média for
   * dos OUTROS — e o rótulo tem de dizer sobre quantos ela é, senão o número
   * fica sem termo que o concilie com a contagem ao lado.
   *
   * ⚠️ As CONTAGENS continuam sobre tudo (quantas apuradas, quantas em
   * exibição): elas não permitem deduzir nota nenhuma.
   */
  const comNota = visiveis.filter((l): l is typeof l & { notaFinal: number } => l.notaFinal !== null);
  const media = comNota.reduce((s, l) => s + l.notaFinal, 0) / (comNota.length || 1);
  const mediaOmiteAPropria = comNota.length !== visiveis.length;
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
        {/* ⭐⭐ AS DUAS PLANILHAS, e o par é o recurso — não uma o extra da outra.
            A de resultados responde "quem tirou quanto"; a de canceladas
            responde "por que fulano não está na lista", que é a pergunta que
            aparece NA REUNIÃO e que a primeira planilha não tem como responder:
            quem foi cancelado não tem resultado, então não tem linha lá. Sem o
            segundo arquivo, a ausência da pessoa é lida como esquecimento. */}
        <ExportarPlanilhas
          cicloId={ciclo.id}
          canceladas={ciclo.canceladas ?? 0}
          restritas={linhas.filter((l) => l.restrita).length}
          apuradas={linhas.length}
        />

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
            {/* ⚠️ O denominador da média é `comNota`, não `visiveis`: a própria
                linha sai da conta. Dizer sobre QUANTAS ela é não é detalhe —
                sem isso ficariam dois números verdadeiros lado a lado (a média
                e a contagem) sem o termo que os concilia. */}
            {mediaOmiteAPropria ? (
              <>
                sobre <strong className="tabular-nums">{comNota.length}</strong>, sem a sua
              </>
            ) : filtrando ? (
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
            {/* ⭐⭐ A PRÓPRIA LINHA NÃO É BOTÃO — 11/09.
                Sem nota, sem conceito e sem caminho para a memória de cálculo,
                em qualquer papel. Fica como TEXTO: botão que abre um 403 é pior
                que ausência de botão — convida ao clique e responde com erro,
                que a pessoa lê como defeito do sistema.
                A linha permanece para o total da tela fechar com o do ciclo. */}
            {l.restrita ? (
              <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-slate-800">
                    {l.nome}
                    <Etiqueta tom="azul">você</Etiqueta>
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {l.matricula} · {l.cargo ?? 'sem cargo'} · {l.aplicacao}
                  </p>
                </div>
                {/* Mesmo tom que o módulo já usa com o avaliador ("a nota é
                    calculada pelo sistema e não fica visível para você"). */}
                <p className="max-w-[16rem] shrink-0 text-right text-xs text-slate-500">
                  A sua própria avaliação não fica visível para você. A devolutiva vem pelo seu
                  superior.
                </p>
              </div>
            ) : (
            <>
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
                <p className="text-lg font-semibold tabular-nums text-slate-800">
                  {l.notaFinal === null ? '—' : nota(l.notaFinal)}
                </p>
                {l.conceito && <p className="text-xs text-slate-500">{l.conceito}</p>}
                <p className="mt-0.5 text-[11px] text-capul-700">memória de cálculo</p>
              </div>
              <ChevronRight size={20} className="shrink-0 text-slate-300" aria-hidden />
            </button>
            </>
            )}
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
  /**
   * ⭐ O bruto de um critério de DOMÍNIO é um CÓDIGO DE CADASTRO, e sozinho
   * entre parênteses ele lia como nota: "Superior completo (35)" numa linha que
   * tem, três colunas adiante, a pontuação real — 75. Dois números verdadeiros
   * na mesma linha precisam do termo que os concilia, e aqui o termo é dizer o
   * que o 35 é. Num critério NUMÉRICO isso não acontece: o bruto vem com
   * unidade ("5,4 anos"), que já o distingue.
   */
  const bruto =
    c.valorTexto === null || c.valorTexto === undefined
      ? c.valorBruto === null
        ? null
        : `${nota(c.valorBruto)}${c.unidade ? ` ${c.unidade}` : ''}`
      : c.tipoValor === 'DOMINIO'
        ? `código ${c.valorTexto}`
        : c.valorTexto;
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
                    {/* ⭐ "Peso" sozinho lia como "de 100": com 0 critérios a
                        memória dizia "Peso 60" e quem conferia procurava 40
                        pontos que não existem. O peso BRUTO fica (é o que está
                        cadastrado e é o insumo da conta) e ganha ao lado a
                        fração que ele representa — o termo que faltava. */}
                    <th className="pb-1 text-right font-medium">Peso · da nota</th>
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
                      {memoria.pesoAvaliacao}{' '}
                      <span className="text-slate-400">· {fracao(memoria.pesoAvaliacao, pesoTotal)}</span>
                    </td>
                  </tr>
                  {memoria.criterios.map((c) => (
                    <tr key={c.criterioId} className={c.semDado ? 'text-slate-400' : ''}>
                      <td className="py-1.5 font-medium">{c.nome}</td>
                      <td className="py-1.5 text-right">{valorDoCriterio(c)}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {c.semDado ? 'sem dado' : (c.pontuacao ?? '—')}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {c.peso}{' '}
                        <span className="text-slate-400">
                          {/* Critério sem dado não entra na conta — o motor
                              redistribui o peso dele. Mostrar uma fração para
                              ele faria a soma das frações passar de 100%. */}
                          · {c.semDado ? '—' : fracao(c.peso, pesoTotal)}
                        </span>
                      </td>
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
                    <td className="pt-2 text-right tabular-nums text-slate-600">
                      {pesoTotal} <span className="text-slate-400">· 100%</span>
                    </td>
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

            {memoria.porGrupo.length > 0 && (() => {
              /** A soma dos pesos das classificações — o denominador da média. */
              const somaDosPesos = memoria.porGrupo.reduce((t, g) => t + g.peso, 0);
              return (
              <div className="mt-5">
                {/* ⚠️ "por CLASSIFICAÇÃO", não "por grupo": é o termo do cadastro
                    (§3.1.105, item 2.11) e é o que a pessoa procura no menu. */}
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Questionário, por classificação
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {memoria.porGrupo.map((g) => (
                    <li key={g.grupoId} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        {g.titulo}
                        {/* ⭐⭐ O PESO — o número que DECIDE, e o único que a tela
                            não mostrava. Sem ele estas barras são insumos sem
                            ponderação: quem precisa explicar a nota para o
                            avaliado não consegue refazer a conta. */}
                        <span className="ml-1.5 text-xs tabular-nums text-slate-400">
                          peso {nota(g.peso)}
                          {somaDosPesos > 0 && ` · ${nota((g.peso / somaDosPesos) * 100)}%`}
                        </span>
                      </span>
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
                {/* ⚠️ Este rodapé AFIRMAVA O CONTRÁRIO do que a tela calcula:
                    "grupo é organização visual, o peso está em cada pergunta".
                    Era verdade até 10/09; a unificação do acervo (11/09) inverteu
                    — o peso mora na CLASSIFICAÇÃO e o da questão é derivado dele.
                    A nota do questionário é a média destas barras PONDERADA pelos
                    pesos ao lado, e o texto mandava procurar o peso onde ele não
                    está mais. Ver §3.1.115. */}
                <p className="mt-2 text-xs text-slate-500">
                  Calculada agora, sobre as respostas gravadas — não é um número congelado.{' '}
                  <strong>O peso é da classificação</strong>, e cada questão herda o dela repartido
                  entre as questões daquela classificação neste perfil. A nota do questionário é a
                  média destas linhas ponderada pelos pesos:{' '}
                  <span className="tabular-nums">
                    Σ(nota × peso) ÷ {nota(somaDosPesos)} = {nota(memoria.notaAvaliacao ?? 0)}
                  </span>
                  .
                </p>
              </div>
              );
            })()}

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

/**
 * ⭐ Baixar não é ato irreversível, então não pede confirmação — mas DIZ o que
 * cada arquivo tem antes do clique, porque "exportar" sozinho não distingue os
 * dois. E o botão das canceladas some quando não há nenhuma: ato sem objeto
 * some, e um arquivo de zero linhas na mão da gestora, na reunião, é pior que
 * botão nenhum.
 */
function ExportarPlanilhas({
  cicloId,
  canceladas,
  restritas,
  apuradas,
}: {
  cicloId: string;
  canceladas: number;
  /** Quantas linhas desta tela são da própria pessoa — elas NÃO vão no arquivo. */
  restritas: number;
  apuradas: number;
}) {
  const [baixando, setBaixando] = useState<'resultados' | 'canceladas' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar(quais: 'resultados' | 'canceladas') {
    setBaixando(quais);
    setErro(null);
    try {
      await resultados.baixarCsv(cicloId, quais);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível gerar a planilha.'));
    } finally {
      setBaixando(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => baixar('resultados')}
        disabled={baixando !== null}
        title="Uma linha por pessoa apurada: nota, conceito, avaliador e datas. Sem a memória de cálculo."
        className="alvo-toque inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
      >
        <Download size={15} aria-hidden />
        {baixando === 'resultados' ? 'Gerando…' : 'Resultados (.csv)'}
      </button>

      {canceladas > 0 && (
        <button
          type="button"
          onClick={() => baixar('canceladas')}
          disabled={baixando !== null}
          title="Quem ficou sem nota e por quê — com o motivo escrito no cancelamento."
          className="alvo-toque inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          <Download size={15} aria-hidden />
          {baixando === 'canceladas' ? 'Gerando…' : `Canceladas (${canceladas})`}
        </button>
      )}

      {/* ⭐⭐ O TERMO QUE CONCILIA OS DOIS NÚMEROS. A tela diz "3 apuradas" e o
          arquivo sai com 2 — porque a própria linha não vai. Sem esta frase, a
          diferença aparece na REUNIÃO, onde ninguém tem como explicá-la, e o
          arquivo passa a parecer incompleto. É a mesma regra do card de ciclos
          citando as canceladas. */}
      {restritas > 0 && (
        <p className="w-full text-xs text-slate-500">
          O arquivo sai com {apuradas - restritas} de {apuradas}: a sua própria avaliação aparece
          nesta tela, marcada, mas não vai na planilha.
        </p>
      )}

      {erro && <p className="w-full text-sm text-rose-700">{erro}</p>}
    </div>
  );
}
