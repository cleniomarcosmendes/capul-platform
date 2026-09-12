import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronRight, Lock, Plus, Unlock } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { EtiquetaDeCiclo } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { contagem, data, flexao } from '../lib/formato';
import {
  ciclos,
  ehFaltaDePermissao,
  mensagemDoErro,
  painel,
  type CicloDaLista,
  type NovoCiclo,
  type PreviaDaAbertura,
} from '../services/api';
import { Modal } from '../components/Modal';
import { MOTIVO_MINIMO_EM_MASSA } from '../lib/motivo';

/**
 * CICLOS — a lista de ciclos e a criação de um novo.
 *
 * ⭐ ABRIR é o ponto sem volta do módulo: a partir dele começam a nascer notas.
 * Por isso a tela não esconde a recusa do backend atrás de "erro ao abrir": a
 * validação de abertura devolve a LISTA de problemas (conceitos com buraco,
 * critério sem resolver, modelo de demonstração) e cada um deles vira uma linha
 * aqui. Recusa que não diz o que fazer só transfere o trabalho de descobrir.
 */
export default function CiclosPage() {
  const { tem } = useAuth();
  const [lista, setLista] = useState<CicloDaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setErro(null);
    try {
      setLista(await ciclos.listar());
    } catch (e) {
      setSemPermissao(ehFaltaDePermissao(e));
      setErro(mensagemDoErro(e, 'Não foi possível carregar os ciclos.'));
    }
  }

  return (
    <div className="px-4 pb-24 pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Ciclos de avaliação</h2>
          <p className="text-sm text-slate-500">Período, data-base e régua de conceitos.</p>
        </div>
        {/* ⚠️ Desabilitado quando a LISTA foi recusada. Ter o papel não basta:
            toda rota do módulo exige matrícula que resolva num colaborador
            ATIVO (§3.1.93), e sem ele o `POST /ciclos` devolve 403 — conferido,
            nada é gravado. O botão habilitado ao lado do banner de recusa
            abria o diálogo inteiro e pré-preenchido, e o trabalho só se perdia
            no Salvar. O motivo fica no `title`, nunca escondendo o botão. */}
        {tem(ROLES.RH_ADMIN, ROLES.RH_CICLO) && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            disabled={!!erro}
            title={
              erro
                ? 'Indisponível enquanto o acesso ao módulo estiver recusado — ver a mensagem abaixo.'
                : 'Criar um ciclo de avaliação'
            }
            className="alvo-toque inline-flex shrink-0 items-center gap-2 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-capul-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={16} aria-hidden /> Novo ciclo
          </button>
        )}
      </div>

      {erro && (
        <Erro
          mensagem={erro}
          aoTentarDeNovo={semPermissao ? undefined : carregar}
          dica={semPermissao ? 'Este quadro é do RH — peça acesso à gestora.' : undefined}
        />
      )}

      {!erro && !lista && <Carregando />}

      {lista?.length === 0 && (
        <Vazio
          titulo="Nenhum ciclo criado"
          detalhe="O ciclo é o contêiner: define o período avaliado, a data-base que congela todo cálculo temporal e a régua de conceitos."
        />
      )}

      {lista && lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <CartaoDeCiclo ciclo={c} aoMudar={carregar} />
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <DialogoNovoCiclo
          aoFechar={() => setCriando(false)}
          aoCriar={async (dados) => {
            await ciclos.criar(dados);
            setCriando(false);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function CartaoDeCiclo({ ciclo, aoMudar }: { ciclo: CicloDaLista; aoMudar: () => Promise<void> }) {
  const { tem } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [problemas, setProblemas] = useState<string[] | null>(null);
  const [confirmandoAbrir, setConfirmandoAbrir] = useState(false);
  const [previaAbertura, setPreviaAbertura] = useState<PreviaDaAbertura | null>(null);
  const [reabrindo, setReabrindo] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [encerrandoComPendencia, setEncerrandoComPendencia] = useState(false);
  const [motivoPendencia, setMotivoPendencia] = useState('');

  async function reabrir() {
    setProblemas(null);
    setOcupado(true);
    try {
      await ciclos.reabrir(ciclo.id, motivoReabertura.trim());
      setReabrindo(false);
      setMotivoReabertura('');
      await aoMudar();
    } catch (e) {
      setProblemas([mensagemDoErro(e)]);
    } finally {
      setOcupado(false);
    }
  }

  /**
   * ⭐⭐ VALIDA PRIMEIRO, AVISA DEPOIS (08/09).
   *
   * A validação rodava DEPOIS do aviso de irreversibilidade: a pessoa encarava
   * "não tem volta", confirmava, e só então recebia *"Falta resolver: o ciclo
   * não tem nenhuma aplicação"*. O aviso mais pesado da tela era gasto com quem
   * nem podia abrir — e quem podia lia um "tem certeza?" sem número nenhum.
   *
   * Agora: pergunta ao backend o que a abertura faria; se há problema, mostra o
   * problema **e nada mais**; se não há, aí sim o aviso — com os números vindos
   * das mesmas funções que decidem.
   */
  async function pedirParaAbrir() {
    setProblemas(null);
    setOcupado(true);
    try {
      const p = await painel.previaDaAbertura(ciclo.id);
      if (p.problemas.length > 0) {
        setProblemas(p.problemas);
        return;
      }
      setPreviaAbertura(p);
      setConfirmandoAbrir(true);
    } catch (e) {
      setProblemas([mensagemDoErro(e, 'Não foi possível conferir a abertura.')]);
    } finally {
      setOcupado(false);
    }
  }

  async function agir(acao: 'abrir' | 'encerrar', confirmarPendentes = false) {
    setConfirmandoAbrir(false);
    setProblemas(null);
    setOcupado(true);
    try {
      await (acao === 'abrir'
        ? ciclos.abrir(ciclo.id)
        : ciclos.encerrar(
            ciclo.id,
            confirmarPendentes ? { confirmarPendentes: true, motivo: motivoPendencia.trim() } : {},
          ));
      setEncerrandoComPendencia(false);
      setMotivoPendencia('');
      await aoMudar();
    } catch (e) {
      // A validação de abertura devolve um ARRAY de problemas. Juntar tudo numa
      // frase só faria a gestora ler seis pendências como se fossem uma.
      const bruto = (e as { response?: { data?: { message?: string | string[] } } }).response?.data
        ?.message;
      setProblemas(Array.isArray(bruto) ? bruto : [mensagemDoErro(e)]);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{ciclo.nome}</h3>
            <EtiquetaDeCiclo status={ciclo.status} />
            {ciclo.valeParaMerito && (
              <span className="text-xs font-medium text-amber-700">vale para mérito</span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange size={14} aria-hidden />
              {data(ciclo.periodoInicio)} a {data(ciclo.periodoFim)}
            </span>
            <span>
              data-base <strong className="font-medium text-slate-700">{data(ciclo.dataBase)}</strong>
            </span>
          </p>
          {/* ⭐⭐ O CARD CITA A OUTRA CONTA (09/09). `_count.avaliacoes` já vem
              filtrado por `ONDE_A_AVALIACAO_CONTA` — canceladas fora —, e a
              linha de estado logo abaixo mostra "1 de 1 enviadas · 5
              canceladas". Dois números verdadeiros sobre o mesmo ciclo, sem
              nada dizendo por que 1 ≠ 6: é o irmão do "52 avaliações × faltam
              37" (§3.1). Quem concilia é o TERMO, e ele tem de estar na conta
              menor, que é a que parece errada. */}
          <p className="mt-1 text-sm text-slate-500">
            {contagem(ciclo._count.aplicacoes, 'aplicação', 'aplicações')} ·{' '}
            {contagem(ciclo._count.avaliacoes, 'avaliação', 'avaliações')}
            {ciclo.canceladas > 0 &&
              ` (${ciclo.canceladas} ${flexao(ciclo.canceladas, 'cancelada não entra', 'canceladas não entram')} nesta conta)`}
            {ciclo.incluirAfastados && ' · inclui afastados'}
          </p>
        </div>
        <Link
          to={`/ciclos/${ciclo.id}`}
          className="alvo-toque inline-flex shrink-0 items-center gap-1 self-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:border-capul-300"
        >
          Abrir <ChevronRight size={15} aria-hidden />
        </Link>
      </div>

      {/* ⚠️ ENCERRADO entra aqui: é onde mora o botão de REABRIR. Antes, um
          ciclo encerrado não tinha ação nenhuma na tela — e a rota de reabertura
          existia sem botão, a mesma lacuna da §3.1.5 que tínhamos acabado de
          registrar sobre o vínculo. */}
      {tem(ROLES.RH_ADMIN) && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            /**
             * ⚠️ ENCERRAR É A AÇÃO IRREVERSÍVEL DO MÓDULO, e estava clicável com
             * 892 de 894 avaliações por enviar — a única barreira era a frase
             * cinza abaixo. O servidor recusa (e diz quantas faltam), mas
             * descobrir a regra clicando no botão que fecha o ciclo é o tipo de
             * aprendizado que só se quer ter uma vez.
             */
            /**
             * ⚠️ Não é mais DESABILITADO por pendência (08/09). Ficar cinza sem
             * saída era o beco: uma pessoa desligada travava o ciclo para
             * sempre, e o botão só dizia "não". Agora ele ABRE A CONVERSA — o
             * diálogo mostra quantas ficariam canceladas e exige o motivo.
             */
            disabled={ocupado}
            onClick={() =>
              ciclo.status === 'RASCUNHO'
                ? void pedirParaAbrir()
                : ciclo.status === 'ENCERRADO'
                  ? setReabrindo(true)
                  : ciclo.pendentes > 0
                    ? setEncerrandoComPendencia(true)
                    : agir('encerrar')
            }
            className="alvo-toque inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {ciclo.status === 'ABERTO' ? <Lock size={15} aria-hidden /> : <Unlock size={15} aria-hidden />}
            {ocupado
              ? 'Aguarde…'
              : ciclo.status === 'RASCUNHO'
                ? 'Abrir ciclo'
                : ciclo.status === 'ENCERRADO'
                  ? 'Reabrir ciclo'
                  : 'Encerrar ciclo'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {ciclo.status === 'ENCERRADO'
              ? // ⭐ O CARD NÃO PODE PROMETER O QUE O DIÁLOGO DESMENTE (09/09).
                // Dizia "Reabrir devolve tudo isso" — e "tudo isso" lê como
                // "volta ao que era", incluindo as avaliações canceladas. O
                // diálogo avisa que não, em bloco âmbar, mas quem DECIDE olhando
                // a lista nunca chega até ele: a promessa é lida aqui e a
                // ressalva mora duas telas adiante. Com canceladas, o card diz o
                // que reabrir NÃO faz; sem elas, não há o que ressalvar.
                `Encerrado${ciclo.encerradoEm ? ` em ${data(ciclo.encerradoEm)}` : ''} — designar, mexer no público e apurar estão fechados. Reabrir devolve esses três, com motivo registrado.${
                  ciclo.canceladas > 0
                    ? ` As ${ciclo.canceladas} ${flexao(ciclo.canceladas, 'cancelada continua cancelada', 'canceladas continuam canceladas')} — reabrir devolve o ciclo, não as avaliações.`
                    : ''
                }`
              : ciclo.status === 'RASCUNHO'
              ? 'Abrir LIBERA os avaliadores para responder e trava a montagem: aplicações e critérios só mudam enquanto é rascunho. As avaliações já existem — quem as cria é a designação.'
              : ciclo.pendentes > 0
                ? `${flexao(ciclo.pendentes, 'Falta', 'Faltam')} ${contagem(ciclo.pendentes, 'avaliação', 'avaliações')} por enviar. Se não vão entrar, dá para encerrar com pendência — elas ficam canceladas, com motivo registrado.`
                : 'Todas as avaliações foram enviadas: o ciclo pode ser encerrado.'}
          </p>
        </div>
      )}

      {/* ⭐⭐ CONFIRMAÇÃO DE ABRIR — no molde da do Apurar (§3.1.8): diz o que
          FECHA e o que NÃO VOLTA, antes do clique valer.
          ⚠️ Abrir é a porta mais definitiva do módulo: não existe rota de ABERTO
          para RASCUNHO. Até 07/09 nada avisava — a única frase era a cinza
          embaixo do botão, que se lê depois de clicar. */}
      {confirmandoAbrir && previaAbertura && (
        <Modal titulo={`Abrir "${ciclo.nome}"`} aoFechar={() => setConfirmandoAbrir(false)}>
          <p className="text-sm text-slate-700">
            Abrir <strong>libera os avaliadores para responder</strong> — e{' '}
            <strong className="text-amber-800">não tem volta: não existe voltar para rascunho.</strong>
          </p>

          {/* ⭐⭐ OS NÚMEROS, e eles vêm do BACKEND (§3.1.23) — das mesmas funções
              que decidem: `listar()` da designação, que aplica a régua do ciclo,
              e `problemasParaAbrir`, que a API roda no clique. Contar aqui
              divergiria no primeiro caso de borda, e o caso de borda é a régua
              barrando alguém que está no público.
              ⚠️ E o número NÃO é "quantas avaliações vão nascer": abrir não cria
              nenhuma. Elas nascem na designação; abrir libera as que existem. */}
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="text-slate-700">
              <strong className="tabular-nums text-capul-700">{previaAbertura.designados}</strong>{' '}
              {flexao(previaAbertura.designados, 'avaliação já designada será liberada', 'avaliações já designadas serão liberadas')} para responder, em{' '}
              <strong className="tabular-nums">{previaAbertura.totalAplicacoes}</strong>{' '}
              {flexao(previaAbertura.totalAplicacoes, 'aplicação', 'aplicações')}{' '}
              {/* ⚠️ O `{' '}` não é enfeite: o JSX APAGA a quebra de linha entre
                  uma expressão e o texto seguinte, e saía "aplicações· 54". */}
              · <strong className="tabular-nums">{previaAbertura.noPublico}</strong>{' '}
              {flexao(previaAbertura.noPublico, 'pessoa', 'pessoas')} no público.
            </p>
            {/* ⭐⭐ QUEM NÃO CONSEGUE RESPONDER — o último momento barato de
                dizer. Depois de abrir, a fila existe, o prazo corre, e ninguém
                descobre que parte dela é impossível até alguém ir cobrar.
                No ciclo de simulação de 09/09 eram 24 de 50 designações.
                ⚠️ Fica FORA da lista âmbar de propósito: aquelas são pendências
                do ciclo, esta é uma pendência de CADASTRO DE ACESSO, resolvida
                em outro módulo e por outra pessoa. E não bloqueia. */}
            {/* ⭐⭐ CRITÉRIO SEM VALOR — o último momento em que isto ainda muda
                alguma coisa. A conferência de pendências do painel roda sobre
                avaliações ENVIADA: com zero enviadas ela diz "nada a conferir
                ainda", e só fala depois que as notas já saíram sem o critério.
                Aviso, não bloqueio: importar depois de abrir é o fluxo normal. */}
            {previaAbertura.avisos.length > 0 && (
              <div className="mt-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-semibold">
                  ⚠️ {contagem(previaAbertura.avisos.length, 'critério ainda não tem', 'critérios ainda não têm')}{' '}
                  valor neste ciclo
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {previaAbertura.avisos.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* ⭐⭐ QUEM PODE ENTRAR MAS NÃO ESTÁ TRABALHANDO — a irmã que
                faltava (12/09). A prévia conferia UMA condição de impedimento
                (acesso) e não a outra: férias e afastamento não impedem entrar,
                mas a avaliação fica parada com quem não está no trabalho.
                ⚠️ Bloco SEPARADO do de acesso, e em outro tom: "sem conta" se
                resolve no Configurador, com outra pessoa; "de férias" se
                resolve redesignando ou esperando, e é decisão do RH. Juntos, o
                segundo seria lido como defeito de cadastro. */}
            {previaAbertura.avaliadoresDeLicenca.length > 0 && (
              <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                <p className="font-semibold">
                  ⓘ {contagem(previaAbertura.avaliacoesComAvaliadorDeLicenca, 'avaliação está', 'avaliações estão')}{' '}
                  com {contagem(previaAbertura.avaliadoresDeLicenca.length, 'avaliador de licença', 'avaliadores de licença')}
                </p>
                <p className="mt-0.5 text-xs">
                  Eles <strong>conseguem entrar</strong> — férias e afastamento não bloqueiam o
                  acesso. Só não estão no trabalho. Não impede abrir: quem voltar responde
                  normalmente; se não for voltar a tempo, redesigne.
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {previaAbertura.avaliadoresDeLicenca.slice(0, 6).map((a) => (
                    <li key={a.avaliadorId}>
                      <strong>{a.nome}</strong> ({a.matricula}) ·{' '}
                      {a.situacao === 'FERIAS' ? 'férias' : 'afastado'} ·{' '}
                      {contagem(a.avaliacoes, 'avaliação', 'avaliações')}
                    </li>
                  ))}
                  {previaAbertura.avaliadoresDeLicenca.length > 6 && (
                    <li className="text-xs">
                      e mais {previaAbertura.avaliadoresDeLicenca.length - 6}
                    </li>
                  )}
                </ul>
              </div>
            )}
            {previaAbertura.avaliadoresSemAcesso.length > 0 && (
              <div className="mt-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
                <p className="font-semibold">
                  ⚠️ {contagem(previaAbertura.avaliacoesSemAvaliadorComAcesso, 'avaliação está', 'avaliações estão')}{' '}
                  com {contagem(previaAbertura.avaliadoresSemAcesso.length, 'avaliador que NÃO consegue', 'avaliadores que NÃO conseguem')}{' '}
                  entrar na plataforma.
                </p>
                <p className="mt-1 text-xs">
                  Designar não dá acesso. O ciclo abre e essas avaliações ficam paradas até alguém
                  criar a conta ou dar a permissão — no <strong>Configurador</strong>, que é outro
                  módulo. Dá para abrir assim e resolver depois; só não dá para não saber.
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {previaAbertura.avaliadoresSemAcesso.slice(0, 8).map((a) => (
                    <li key={a.avaliadorId}>
                      <strong>{a.nome}</strong> ({a.matricula}) —{' '}
                      {contagem(a.avaliacoes, 'avaliação', 'avaliações')} · {a.motivo}
                    </li>
                  ))}
                  {previaAbertura.avaliadoresSemAcesso.length > 8 && (
                    <li>… e mais {previaAbertura.avaliadoresSemAcesso.length - 8}</li>
                  )}
                </ul>
              </div>
            )}

            {(previaAbertura.semAvaliador > 0 || previaAbertura.foraDoCiclo > 0) && (
              <ul className="mt-2 space-y-0.5 text-amber-900">
                {previaAbertura.semAvaliador > 0 && (
                  <li>
                    ⚠️ <strong className="tabular-nums">{previaAbertura.semAvaliador}</strong> no
                    público <strong>sem avaliador</strong> — não serão avaliadas enquanto ninguém as
                    designar. Designar continua valendo depois de abrir.
                  </li>
                )}
                {previaAbertura.foraDoCiclo > 0 && (
                  <li>
                    ⚠️ <strong className="tabular-nums">{previaAbertura.foraDoCiclo}</strong> no
                    público estão <strong>fora do ciclo</strong> — pela régua (afastados, cargo
                    inelegível) <em>ou</em> por decisão do RH. Entram na conta do público e não
                    geram avaliação.
                    {/* ⚠️ O negrito dizia "fora pela régua do ciclo" e a ressalva ia entre
                        parênteses. O número conta as duas causas: afirmar a régua no destaque
                        e admitir a outra no rodapé é a mesma mentira do nome antigo do campo,
                        só que na tela. */}
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* ⚠️ RECORTE PROVISÓRIO: avisa, não bloqueia. Confirmar em bloco é a
              pergunta que está com a gestora (lista A); bloquear antes de ela
              responder tiraria a única saída que existe hoje. */}
          {previaAbertura.aplicacoesProvisorias > 0 && (
            <div className="mt-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">
                ⚠️ {previaAbertura.aplicacoesProvisorias} de {previaAbertura.totalAplicacoes}{' '}
                {flexao(previaAbertura.aplicacoesProvisorias, 'aplicação está', 'aplicações estão')} com{' '}
                <strong>recorte provisório</strong>.
              </p>
              <p className="mt-1">
                A própria tela chama esse público de <em>recorte de trabalho, não decisão do RH</em>{' '}
                — e o ciclo vai abrir com ele. Se a lista ainda não é a que o RH confirmou, volte a
                Aplicações antes de abrir: depois, o público ainda muda, mas a montagem trava.
              </p>
            </div>
          )}
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-medium">A abertura FECHA:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>criar aplicação e mudar o peso da avaliação ou dos critérios</li>
            </ul>
            <p className="mt-2 font-medium">CONTINUA valendo depois de abrir:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>montar público, designar e apurar</li>
              <li>
                mudar o período do ciclo — a <strong>data-base</strong>, não: ela congela o cálculo
              </li>
            </ul>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmandoAbrir(false)}
              className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void agir('abrir')}
              className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ocupado ? 'Abrindo…' : 'Abrir o ciclo'}
            </button>
          </div>
        </Modal>
      )}

      {/* ⭐⭐ REABRIR — mesmo tratamento do Apurar e do Abrir: diz o que VOLTA a
          ser possível e exige o motivo no próprio diálogo, porque é ele que fica
          registrado. Sem motivo o backend recusa; pedir aqui evita o vaivém. */}
      {reabrindo && (
        <Modal titulo={`Reabrir "${ciclo.nome}"`} aoFechar={() => setReabrindo(false)}>
          <p className="text-sm text-slate-700">
            Reabrir devolve o ciclo para <strong>ABERTO</strong> — e volta a permitir:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            <li>designar (à mão e pelo cadastro) e mexer no público</li>
            <li>apurar e reapurar</li>
            <li>reabrir avaliações — que com o ciclo fechado ficariam sem quem respondesse</li>
          </ul>
          {/* ⭐⭐ O QUE REABRIR **NÃO** DESFAZ. O diálogo listava só o que volta,
              e quem encerrou com pendência lê isso como "desfaz o
              encerramento". Não desfaz: as canceladas continuam canceladas, e
              não há caminho para descancelar. Dizer só o que se ganha, num ato
              que alguém aciona para consertar outro, é meia verdade que custa
              caro. */}
          {ciclo.canceladas > 0 && (
            <p className="mt-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠️ <strong>O que reabrir NÃO faz:</strong> as{' '}
              <strong className="tabular-nums">{ciclo.canceladas}</strong>{' '}
              {flexao(ciclo.canceladas, 'avaliação cancelada continua cancelada',
                      'avaliações canceladas continuam canceladas')}. Reabrir devolve o ciclo, não
              as avaliações — não há caminho para descancelar.
            </p>
          )}
          <p className="mt-2 text-sm text-slate-500">
            ⚠️ Volta para ABERTO, <strong>nunca para rascunho</strong>: aplicação e peso continuam
            travados, porque mudar peso depois de haver resultado é reapuração, não montagem.
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Motivo da reabertura
            <textarea
              value={motivoReabertura}
              onChange={(e) => setMotivoReabertura(e.target.value)}
              rows={2}
              placeholder="Por que este ciclo está sendo reaberto?"
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-800"
            />
          </label>
          {/* Mesmo par do encerrar: explicação fixa + contador só quando falta.
              Antes o botão travava em silêncio abaixo do mínimo. */}
          <p className="text-xs text-slate-500">
            Fica registrado no ciclo e na auditoria, com quem reabriu e quando — é o que responde,
            meses depois, por que um ciclo encerrado voltou a aceitar mudança.
          </p>
          {motivoReabertura.trim().length > 0 &&
            motivoReabertura.trim().length < MOTIVO_MINIMO_EM_MASSA && (
              <p className="mt-0.5 text-xs font-medium text-amber-800">
                Escreva pelo menos {MOTIVO_MINIMO_EM_MASSA} caracteres — faltam{' '}
                {MOTIVO_MINIMO_EM_MASSA - motivoReabertura.trim().length}.
              </p>
            )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setReabrindo(false)}
              className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || motivoReabertura.trim().length < MOTIVO_MINIMO_EM_MASSA}
              onClick={() => void reabrir()}
              className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ocupado ? 'Reabrindo…' : 'Reabrir o ciclo'}
            </button>
          </div>
        </Modal>
      )}

      {/* ⭐⭐ ENCERRAR COM PENDÊNCIA — o override, no molde do RDV da Logística.
          O custo aparece ANTES: o número exato do que vai ser cancelado, o que
          acontece com as respostas parciais, e o motivo obrigatório, que fica
          gravado em CADA avaliação cancelada, não só no ciclo. */}
      {encerrandoComPendencia && (
        <Modal
          titulo={`Encerrar "${ciclo.nome}" com pendência`}
          aoFechar={() => setEncerrandoComPendencia(false)}
        >
          <p className="text-sm text-slate-700">
            Faltam{' '}
            <strong className="text-amber-800">
              {contagem(ciclo.pendentes, 'avaliação', 'avaliações')}
            </strong>{' '}
            por enviar. Encerrar assim <strong>cancela todas elas</strong>.
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            <li>As respostas já dadas <strong>ficam registradas</strong> e não entram na apuração.</li>
            <li>Elas somem da fila dos avaliadores e param de travar o encerramento.</li>
            <li>A contagem de canceladas fica visível no Painel, por aplicação.</li>
          </ul>
          {/* ⭐⭐ IRREVERSÍVEL, DITO ANTES. O diálogo listava só o que ganha e
              omitia o que se perde: cancelada não tem caminho de volta em tela
              nenhuma — nem "Incluir", nem restaurar, nem em lote —, e reabrir o
              ciclo NÃO as descancela. Quem encerrasse achando que reabrir
              desfaz, desfazia só metade. */}
          <p className="mt-2 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
            <strong>Isto não tem volta.</strong> Uma avaliação cancelada não pode ser
            descancelada — não há caminho em tela para isso, e{' '}
            <strong>reabrir o ciclo não as traz de volta</strong>: ele volta a permitir designar e
            apurar, mas estas {ciclo.pendentes} continuam canceladas. Se houver dúvida se
            alguma ainda vai responder, é melhor esperar do que encerrar.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Use isto quando as pendências <strong>não vão entrar</strong> — pessoa desligada ou
            afastada, avaliador que não vai responder. Se é só demora, o Painel mostra{' '}
            <strong>quantas faltam por avaliador</strong>.
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
            Motivo do encerramento com pendência
            <textarea
              value={motivoPendencia}
              onChange={(e) => setMotivoPendencia(e.target.value)}
              rows={2}
              placeholder="Por que estas avaliações não vão entrar?"
              className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm text-slate-800"
            />
          </label>
          {/* ⚠️ A EXIGÊNCIA ERA MUDA. O botão ficava desabilitado abaixo do
              mínimo, sem hint, sem contador e sem mensagem: digitar "ab" e
              clicar não produzia nada e parecia defeito. Agora a regra aparece
              ANTES de o botão travar, e o texto muda quando ela é cumprida. */}
          {/* ⭐ OS DOIS CONVIVEM — o aviso do mínimo NÃO substitui a explicação
              (09/09). Era um ternário só: enquanto a pessoa escrevia, a frase
              que diz PARA QUE SERVE o motivo sumia, e só voltava aos 15 — some
              exatamente no momento em que ela decide o que escrever, e é ela
              que faz a frase ficar boa. Vale para todo campo com mínimo: o
              contador é sobre a FORMA, a explicação é sobre o CONTEÚDO, e uma
              não é versão da outra. */}
          <p className="text-xs text-slate-500">
            Fica gravado no ciclo, na auditoria e em cada avaliação cancelada — é o que responde,
            meses depois, por que estas ficaram sem nota.
          </p>
          {motivoPendencia.trim().length > 0 &&
            motivoPendencia.trim().length < MOTIVO_MINIMO_EM_MASSA && (
              <p className="mt-0.5 text-xs font-medium text-amber-800">
                Escreva pelo menos {MOTIVO_MINIMO_EM_MASSA} caracteres — faltam{' '}
                {MOTIVO_MINIMO_EM_MASSA - motivoPendencia.trim().length}.
              </p>
            )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setEncerrandoComPendencia(false)}
              className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || motivoPendencia.trim().length < MOTIVO_MINIMO_EM_MASSA}
              onClick={() => void agir('encerrar', true)}
              className="alvo-toque flex-1 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ocupado
                ? 'Encerrando…'
                : `Encerrar e cancelar ${ciclo.pendentes}`}
            </button>
          </div>
        </Modal>
      )}

      {problemas && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            {problemas.length === 1
              ? 'Falta resolver:'
              : `Faltam resolver ${contagem(problemas.length, 'ponto', 'pontos')}:`}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Régua padrão — contígua por construção (fim de uma = início da próxima). */
const CONCEITOS_PADRAO = [
  { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 25, cor: '#C0392B', ordem: 1 },
  { descricao: 'Abaixo do esperado', limiteInferior: 25, limiteSuperior: 50, cor: '#E67E22', ordem: 2 },
  { descricao: 'Atende', limiteInferior: 50, limiteSuperior: 75, cor: '#F1C40F', ordem: 3 },
  { descricao: 'Supera', limiteInferior: 75, limiteSuperior: 90, cor: '#72BF44', ordem: 4 },
  { descricao: 'Excelente', limiteInferior: 90, limiteSuperior: 100, cor: '#006838', ordem: 5 },
];

function DialogoNovoCiclo({
  aoFechar,
  aoCriar,
}: {
  aoFechar: () => void;
  aoCriar: (dados: NovoCiclo) => Promise<void>;
}) {
  const hoje = new Date();
  const [nome, setNome] = useState(`Avaliação de Desempenho ${hoje.getFullYear()}`);
  const [periodoInicio, setInicio] = useState(`${hoje.getFullYear()}-01-01`);
  const [periodoFim, setFim] = useState(`${hoje.getFullYear()}-12-31`);
  const [dataBase, setDataBase] = useState(iso(hoje));
  const [janela, setJanela] = useState(12);
  const [incluirAfastados, setIncluirAfastados] = useState(false);
  const [valeParaMerito, setMerito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await aoCriar({
        nome: nome.trim(),
        periodoInicio,
        periodoFim,
        dataBase,
        janelaTreinamentoMeses: janela,
        incluirAfastados,
        valeParaMerito,
        conceitos: CONCEITOS_PADRAO,
      });
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível criar o ciclo.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="titulo-novo-ciclo"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h3 id="titulo-novo-ciclo" className="text-lg font-semibold text-slate-800">
          Novo ciclo
        </h3>

        <div className="mt-4 space-y-4">
          <Campo rotulo="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início do período">
              <input
                type="date"
                value={periodoInicio}
                onChange={(e) => setInicio(e.target.value)}
                className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </Campo>
            <Campo rotulo="Fim do período">
              <input
                type="date"
                value={periodoFim}
                onChange={(e) => setFim(e.target.value)}
                className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </Campo>
          </div>

          <Campo
            rotulo="Data-base"
            ajuda="Congela todo cálculo temporal do ciclo — tempo de casa, tempo na função e a janela de treinamento são medidos NESTA data, não em 'hoje'. Reapurar um ciclo antigo tem de devolver o mesmo número de sempre."
          >
            <input
              type="date"
              value={dataBase}
              onChange={(e) => setDataBase(e.target.value)}
              className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <Campo rotulo="Janela de treinamento (meses)" ajuda="Quanto tempo para trás contam os cursos concluídos.">
            <input
              type="number"
              min={1}
              value={janela}
              onChange={(e) => setJanela(Number(e.target.value))}
              className="alvo-toque w-32 rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <Opcao
            marcado={incluirAfastados}
            aoMudar={setIncluirAfastados}
            rotulo="Incluir afastados"
            ajuda="Decisão do ciclo, medida pela situação na data-base. Férias sempre entram; afastamento é a escolha aqui."
          />
          <Opcao
            marcado={valeParaMerito}
            aoMudar={setMerito}
            rotulo="Vale para mérito"
            ajuda="Marca o ciclo como base de decisão salarial. Não muda o cálculo — muda o que ele significa."
          />

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Régua de conceitos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Contígua por construção — o fim de uma faixa é o começo da próxima, então nota 24,5 tem
              conceito. Para mudar nome, limites ou cor: abra o ciclo e use{' '}
              <strong>Régua de conceitos</strong>, logo abaixo do nome — enquanto ninguém tiver
              sido apurado.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {CONCEITOS_PADRAO.map((c) => (
                <li
                  key={c.descricao}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: c.cor }}
                >
                  {c.descricao} {c.limiteInferior}–{c.limiteSuperior}
                </li>
              ))}
            </ul>
          </div>

          {erro && <Erro mensagem={erro} />}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !nome.trim()}
            onClick={salvar}
            className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {salvando ? 'Criando…' : 'Criar ciclo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{rotulo}</span>
      {ajuda && <span className="mt-0.5 block text-xs text-slate-500">{ajuda}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Opcao({
  marcado,
  aoMudar,
  rotulo,
  ajuda,
}: {
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  ajuda: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 size-4 accent-capul-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{rotulo}</span>
        <span className="block text-xs text-slate-500">{ajuda}</span>
      </span>
    </label>
  );
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
