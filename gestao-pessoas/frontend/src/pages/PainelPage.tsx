import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Calculator, UserX } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import {
  apuracao,
  mensagemDoErro,
  painel as apiPainel,
  type Conferencia,
  type PainelDoCiclo,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';

/**
 * PAINEL — o que falta para o ciclo fechar.
 *
 * Não tem média nem gráfico de nota (isso é Resultados). Responde três coisas,
 * nesta ordem: quanto falta, QUEM está segurando, e o que precisa de cadastro.
 *
 * ⭐ "Sem avaliador" vem primeiro entre as pendências porque é a única que some
 * sozinha: quem é elegível e não foi designado não gera avaliação, não aparece
 * em nenhum status e sai do ciclo sem erro nenhum.
 *
 * ⭐ As pendências cadastrais são a MESMA conta da apuração, rodada sem gravar.
 * Uma segunda implementação encontraria pendências que a apuração real talvez
 * não tenha — e o RH resolveria um problema que não existe.
 */
export default function PainelPage() {
  const { ciclo } = useOutletContext<ContextoDoCiclo>();
  const { tem } = useAuth();
  const [dados, setDados] = useState<PainelDoCiclo | null>(null);
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apurando, setApurando] = useState(false);
  const [resultadoApuracao, setResultado] = useState<string | null>(null);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo.id]);

  async function carregar() {
    setErro(null);
    try {
      const [p, c] = await Promise.all([apiPainel.doCiclo(ciclo.id), apiPainel.pendencias(ciclo.id)]);
      setDados(p);
      setConferencia(c);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível carregar o painel.'));
    }
  }

  async function apurar() {
    setResultado(null);
    setApurando(true);
    try {
      const r = await apuracao.doCiclo(ciclo.id);
      setResultado(`${r.avaliacoesApuradas} avaliação(ões) apurada(s).`);
      await carregar();
    } catch (e) {
      setResultado(mensagemDoErro(e, 'Não foi possível apurar.'));
    } finally {
      setApurando(false);
    }
  }

  if (erro) return <Erro mensagem={erro} aoTentarDeNovo={carregar} />;
  if (!dados) return <Carregando linhas={4} />;

  /**
   * ⚠️ Conta ENVIADAS, na mesma direção da fila do avaliador e da própria barra.
   * O painel dizia "Faltam 892 de 894" com a barra enchendo no sentido oposto e
   * o `aria-label` dizendo "2 de 894 enviadas" — o leitor de tela recebia a
   * contagem num sentido e o olho no outro, na mesma linha. Mesmo módulo, mesma
   * métrica: um sentido só.
   *
   * E `<1%` em vez de `0%`: 2 de 894 é 0,22%, e um "0%" ao lado de "1 enviada(s)"
   * em duas aplicações diz que nada começou, o que é falso.
   */
  const proporcao = dados.designados > 0 ? (dados.enviadas / dados.designados) * 100 : 0;
  const pct = proporcao > 0 && proporcao < 1 ? '<1%' : `${Math.round(proporcao)}%`;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-lg font-semibold text-slate-800">
            {dados.designados === 0
              ? 'Nenhuma avaliação designada'
              : dados.aFazer === 0
                ? 'Todas enviadas'
                : `${dados.enviadas} de ${dados.designados} enviadas`}
          </p>
          <span className="text-sm tabular-nums text-slate-500">{pct}</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={dados.enviadas}
          aria-valuemin={0}
          aria-valuemax={dados.designados}
          aria-label={`${dados.enviadas} de ${dados.designados} avaliações enviadas`}
        >
          <div className="h-full rounded-full bg-capul-600" style={{ width: `${proporcao}%` }} />
        </div>

        {dados.semDesignacao > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <UserX size={18} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
            <p className="text-sm text-amber-900">
              <strong className="font-semibold">
                {dados.semDesignacao} pessoa(s) elegíveis sem avaliador.
              </strong>{' '}
              Elas não têm avaliação, não aparecem em nenhum status e ficarão de fora do ciclo — resolva
              na aba Designação.
            </p>
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-500">Por aplicação</h3>
        {dados.aplicacoes.length === 0 ? (
          <Vazio titulo="Nenhuma aplicação montada" />
        ) : (
          <ul className="space-y-2">
            {dados.aplicacoes.map((a) => (
              <li key={a.aplicacaoId} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex-1 font-medium text-slate-800">{a.nome}</p>
                  <span className="text-sm tabular-nums text-slate-500">
                    {a.enviadas}/{a.designados}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.pendentes > 0 && <Etiqueta tom="neutro">{a.pendentes} não iniciada(s)</Etiqueta>}
                  {a.emAndamento > 0 && <Etiqueta tom="azul">{a.emAndamento} em andamento</Etiqueta>}
                  {a.enviadas > 0 && <Etiqueta tom="verde">{a.enviadas} enviada(s)</Etiqueta>}
                  {a.canceladas > 0 && <Etiqueta tom="neutro">{a.canceladas} cancelada(s)</Etiqueta>}
                  {a.semDesignacao > 0 && (
                    <Etiqueta tom="ambar">{a.semDesignacao} sem avaliador</Etiqueta>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-500">
          Fila por avaliador — do mais atrasado ao menos
        </h3>
        {dados.avaliadores.length === 0 ? (
          <Vazio titulo="Ninguém designado ainda" />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {dados.avaliadores.map((a) => (
              <li key={a.avaliadorId} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-800">{a.nome}</p>
                  <p className="text-sm text-slate-500">{a.matricula}</p>
                </div>
                <div className="w-28 shrink-0">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-capul-400"
                      style={{ width: `${a.total > 0 ? (a.enviadas / a.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span
                  className={`w-24 shrink-0 text-right text-sm tabular-nums ${
                    a.aFazer > 0 ? 'font-semibold text-amber-800' : 'text-slate-500'
                  }`}
                >
                  {a.aFazer > 0 ? `${a.aFazer} a fazer` : 'concluído'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-500">Pendências cadastrais</h3>
        {!conferencia ? (
          <Carregando linhas={1} />
        ) : conferencia.alertas.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">
            {conferencia.avaliacoesApuradas === 0
              ? 'Nada a conferir ainda — a checagem roda sobre as avaliações já enviadas.'
              : `Nenhuma pendência nas ${conferencia.avaliacoesApuradas} avaliação(ões) enviada(s).`}
          </p>
        ) : (
          <ul className="space-y-2">
            {conferencia.alertas.map((a) => (
              <li
                key={`${a.criterioCodigo}-${a.motivo}`}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  a.escopo === 'CONFIGURACAO'
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <AlertTriangle
                  size={18}
                  className={`mt-0.5 shrink-0 ${
                    a.escopo === 'CONFIGURACAO' ? 'text-amber-600' : 'text-slate-400'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">{a.resumo}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.escopo === 'CONFIGURACAO'
                      ? 'Resolve-se uma vez, no critério, e vale para todo mundo.'
                      : 'É dado de pessoa — resolve-se caso a caso.'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {conferencia && conferencia.semNotaDeAvaliacao > 0 && (
          <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {conferencia.semNotaDeAvaliacao} avaliação(ões) estão ENVIADAS sem nota — inconsistência de
            estado, já que a nota é calculada no envio. Vale reabrir e reenviar essas.
          </p>
        )}
      </section>

      {tem(ROLES.RH_ADMIN) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-800">Apurar</h3>
          <p className="mt-1 text-sm text-slate-500">
            Combina a nota do questionário com os critérios cadastrais, pelos pesos da aplicação, e grava
            o resultado. Roda sobre o ciclo inteiro — nunca por pessoa — e pode ser repetida: reapurar
            substitui o resultado anterior, sem reabrir avaliação nenhuma.
          </p>
          <button
            type="button"
            disabled={apurando}
            onClick={apurar}
            className="alvo-toque mt-3 inline-flex items-center gap-2 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Calculator size={16} aria-hidden /> {apurando ? 'Apurando…' : 'Apurar o ciclo'}
          </button>
          {resultadoApuracao && <p className="mt-2 text-sm text-slate-700">{resultadoApuracao}</p>}
        </section>
      )}
    </div>
  );
}
