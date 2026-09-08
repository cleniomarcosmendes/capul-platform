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
import { Modal } from '../components/Modal';
import { motivoCicloEncerrado } from '../lib/ciclo-encerrado';
import { contagem, flexao } from '../lib/formato';

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
  const { ciclo, recarregarResumo } = useOutletContext<ContextoDoCiclo>();
  const { tem } = useAuth();
  const [dados, setDados] = useState<PainelDoCiclo | null>(null);
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apurando, setApurando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
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
    setConfirmando(false);
    setResultado(null);
    setApurando(true);
    try {
      const r = await apuracao.doCiclo(ciclo.id);
      setResultado(`${contagem(r.avaliacoesApuradas, 'avaliação apurada', 'avaliações apuradas')}.`);
      await carregar();
      // Apurar muda "N apuradas" e pode mudar o "→ Próximo" para ENCERRAR.
      void recarregarResumo();
    } catch (e) {
      setResultado(mensagemDoErro(e, 'Não foi possível apurar.'));
    } finally {
      setApurando(false);
    }
  }

  if (erro) return <Erro mensagem={erro} aoTentarDeNovo={carregar} />;
  if (!dados) return <Carregando linhas={4} />;
  const fechado = motivoCicloEncerrado(ciclo);

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
          aria-label={`${dados.enviadas} de ${contagem(dados.designados, 'avaliação enviada', 'avaliações enviadas')}`}
        >
          <div className="h-full rounded-full bg-capul-600" style={{ width: `${proporcao}%` }} />
        </div>

        {dados.semDesignacao > 0 && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <UserX size={18} className="float-left mr-2 mt-0.5 text-amber-600" aria-hidden />
            {/* ⚠️ "NESTE CICLO" no rótulo, e a origem logo abaixo.
                O cadastro de avaliadores tem o SEU "sem avaliador" (a empresa
                inteira, hoje 108) e este tem o dele (este ciclo, 95). Os dois
                universos NÃO SE CONTÊM: fechar os 95 aqui não derruba 95 lá.
                Só nomear os números faria alguém supor a subtração — então o
                painel mostra a conta, com o que fazer em cada caso. */}
            <p className="text-sm text-amber-900">
              <strong className="font-semibold">
                {contagem(dados.semDesignacao, 'pessoa', 'pessoas')} sem avaliador neste ciclo.
              </strong>{' '}
              Elegíveis do público deste ciclo que ninguém designou: não têm avaliação, não
              aparecem em nenhum status e ficam de fora dele.
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-amber-900/90">
              {dados.semDesignacaoPorOrigem.jaTemNoCadastro > 0 && (
                <li>
                  <strong>{dados.semDesignacaoPorOrigem.jaTemNoCadastro}</strong> já têm avaliador
                  no cadastro — resolvem-se com <em>Designar pelo cadastro</em>, na aba Designação.
                </li>
              )}
              {dados.semDesignacaoPorOrigem.nemNoCadastro > 0 && (
                <li>
                  <strong>{dados.semDesignacaoPorOrigem.nemNoCadastro}</strong> não têm avaliador
                  nem no cadastro — precisam ser resolvidas antes, em <em>Avaliadores</em>.
                </li>
              )}
              <li className="pt-1 text-xs opacity-80">
                Este número é deste ciclo. O de <em>Avaliadores</em> é do cadastro inteiro, e os
                dois universos não se contêm — fechar um não subtrai do outro.
              </li>
            </ul>
          </div>
        )}
        {dados.foraDeTodasAsAplicacoes.total > 0 && (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-900">
              <strong className="font-semibold">
                {contagem(dados.foraDeTodasAsAplicacoes.total, 'pessoa', 'pessoas')} fora de TODAS as aplicações deste
                ciclo.
              </strong>{' '}
              Elegíveis que não entraram em público nenhum — não aparecem sequer como &quot;sem
              avaliador&quot;, porque essa conta é por aplicação. Monte o público que falta, em
              Aplicações.
            </p>
            <p className="mt-1 text-xs text-red-900/80">
              {dados.foraDeTodasAsAplicacoes.pessoas
                .slice(0, 6)
                // ⭐ A DESCRIÇÃO, não o código: esta lista existe para alguém
                // AGIR sobre ela, e "02/21010101" não diz a ninguém de que área
                // é a pessoa. O campo já vinha do backend (§3.1.9).
                .map((p) => `${p.nome} (${p.filial}/${p.centroCustoDescricao ?? p.centroCusto ?? '—'})`)
                .join(' · ')}
              {dados.foraDeTodasAsAplicacoes.pessoas.length > 6 &&
                ` … e mais ${dados.foraDeTodasAsAplicacoes.pessoas.length - 6}`}
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
                  {a.pendentes > 0 && <Etiqueta tom="neutro">{contagem(a.pendentes, 'não iniciada', 'não iniciadas')}</Etiqueta>}
                  {a.emAndamento > 0 && <Etiqueta tom="azul">{a.emAndamento} em andamento</Etiqueta>}
                  {a.enviadas > 0 && <Etiqueta tom="verde">{contagem(a.enviadas, 'enviada', 'enviadas')}</Etiqueta>}
                  {a.canceladas > 0 && <Etiqueta tom="neutro">{contagem(a.canceladas, 'cancelada', 'canceladas')}</Etiqueta>}
                  {a.semDesignacao > 0 && (
                    <Etiqueta tom="ambar">{a.semDesignacao} sem avaliador nesta aplicação</Etiqueta>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-500">
          {/* ⚠️ Era "do mais atrasado ao menos". "Atrasado" atribui culpa, e esta
              é a lista lida imediatamente antes de alguém ser cobrado: quem não
              respondeu pode ter mil motivos. É uma ORDENAÇÃO por quantidade,
              não um veredito sobre a pessoa (§3.1.24). */}
          Fila por avaliador — de quem tem mais a fazer para quem tem menos
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
              : `Nenhuma pendência ${flexao(conferencia.avaliacoesApuradas, 'na', 'nas')} ${contagem(conferencia.avaliacoesApuradas, 'avaliação enviada', 'avaliações enviadas')}.`}
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
            {contagem(conferencia.semNotaDeAvaliacao, 'avaliação está ENVIADA', 'avaliações estão ENVIADAS')} sem nota — inconsistência de
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
            // ⚠️ Desabilitado COM O MOTIVO, nunca escondido: esconder faria o
            // ciclo encerrado parecer outra tela e apagaria a informação de que
            // a ação existe. Ver `lib/ciclo-encerrado.ts`.
            disabled={apurando || !!fechado}
            title={fechado ?? undefined}
            onClick={() => setConfirmando(true)}
            className="alvo-toque mt-3 inline-flex items-center gap-2 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Calculator size={16} aria-hidden /> {apurando ? 'Apurando…' : 'Apurar o ciclo'}
          </button>
          {fechado && <p className="mt-2 text-sm text-slate-600">{fechado}</p>}
          {resultadoApuracao && <p className="mt-2 text-sm text-slate-700">{resultadoApuracao}</p>}

          {/* ⭐⭐ CONFIRMAÇÃO COM O NÚMERO REAL — não é trava, é aviso.
              "Encerrar" tinha guarda e "Apurar" não tinha nada: um clique verde
              apurava 3 de 894 sem dizer. Apurar cedo é LEGÍTIMO (reapurar
              substitui, e é assim que se confere o cálculo); o que não pode é
              não saber sobre quantas pessoas o resultado sai. */}
          {confirmando && (
            <Modal titulo="Apurar o ciclo" aoFechar={() => setConfirmando(false)}>
              {dados.enviadas === 0 ? (
                <p className="text-sm text-slate-700">
                  <strong>
                    {flexao(dados.designados, 'A única avaliação não foi enviada', `Nenhuma das ${dados.designados} avaliações foi enviada`)}.
                  </strong>{' '}
                  Não há o
                  que apurar — a apuração só alcança avaliação enviada.
                </p>
              ) : (
                <p className="text-sm text-slate-700">
                  <strong className="font-semibold tabular-nums">
                    {dados.enviadas} de {dados.designados}
                  </strong>{' '}
                  avaliações foram enviadas.{' '}
                  {dados.enviadas < dados.designados ? (
                    <>
                      Apurar agora produz resultado <strong>só para essas {dados.enviadas}</strong>.
                    </>
                  ) : (
                    <>Todas entraram — o resultado sai completo.</>
                  )}
                </p>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Reapurar depois substitui o resultado, sem reabrir avaliação nenhuma — apurar cedo
                para conferir o cálculo é legítimo.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={dados.enviadas === 0}
                  onClick={apurar}
                  className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Apurar {contagem(dados.enviadas, 'avaliação', 'avaliações')}
                </button>
              </div>
            </Modal>
          )}
        </section>
      )}
    </div>
  );
}
