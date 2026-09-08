import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Search, UserCheck, UserPlus, Wand2, X } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { Modal } from '../components/Modal';
import { SeletorDeColaborador } from '../components/SeletorDeColaborador';
import { motivoCicloEncerrado } from '../lib/ciclo-encerrado';
import {
  aplicacoes as apiAplicacoes,
  avaliacoesRh,
  copiaDoCadastro,
  designacao,
  mensagemDoErro,
  type AplicacaoDoCiclo,
  type ColaboradorDaBusca,
  type EfeitoDaReabertura,
  type LinhaDaDesignacao,
  type PreviaDaDesignacao,
  type RelatorioDaCopia,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';
import { contagem, dataHora, flexao, nota } from '../lib/formato';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';

/**
 * DESIGNAÇÃO — quem entra no ciclo, e quem avalia quem.
 *
 * ⚠️ NADA É FILTRADO EM SILÊNCIO. A lista traz incluídos E excluídos, cada
 * exclusão com o motivo escrito, e a decisão manual aparece marcada como tal.
 * Esconder quem a régua deixou de fora faria o total não fechar — e o total é
 * justamente o número que alguém vai conferir contra a folha.
 *
 * ⭐ "Sem avaliador" tem destaque próprio. Elegível que ninguém designou não
 * gera avaliação, não tem status e não entra em contagem nenhuma: é a única
 * pendência do módulo que some sozinha.
 */
export default function DesignacaoPage() {
  const { ciclo, recarregarResumo } = useOutletContext<ContextoDoCiclo>();
  /** `null` = o ciclo aceita escrita. Ver `lib/ciclo-encerrado.ts`. */
  const fechado = motivoCicloEncerrado(ciclo);
  const [apls, setApls] = useState<AplicacaoDoCiclo[] | null>(null);
  const [aplicacaoId, setAplicacaoId] = useState('');
  const [linhas, setLinhas] = useState<LinhaDaDesignacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const { tem } = useAuth();
  const [so, setSo] = useState<'TODOS' | 'SEM_AVALIADOR' | 'EXCLUIDOS'>('TODOS');
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [decidindo, setDecidindo] = useState<LinhaDaDesignacao | null>(null);
  const [designando, setDesignando] = useState(false);
  /** Designar UMA pessoa, pela linha — sem passar pela seleção. */
  const [designandoUm, setDesignandoUm] = useState<LinhaDaDesignacao | null>(null);
  const [reabrindo, setReabrindo] = useState<LinhaDaDesignacao | null>(null);
  const [copia, setCopia] = useState<RelatorioDaCopia | null>(null);
  const [copiando, setCopiando] = useState(false);
  const [substituirManuais, setSubstituirManuais] = useState(false);

  async function previaDaCopia(comSubstituicao = substituirManuais) {
    setCopiando(true);
    setErro(null);
    try {
      setCopia(await copiaDoCadastro.previa(ciclo.id, comSubstituicao));
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível calcular a cópia.'));
    } finally {
      setCopiando(false);
    }
  }

  async function aplicarCopia() {
    setCopiando(true);
    setErro(null);
    try {
      setCopia(await copiaDoCadastro.aplicar(ciclo.id, substituirManuais));
      await gravou();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível aplicar a cópia.'));
    } finally {
      setCopiando(false);
    }
  }

  useEffect(() => {
    apiAplicacoes
      .doCiclo(ciclo.id)
      .then((lista) => {
        setApls(lista);
        if (lista.length > 0) setAplicacaoId((atual) => atual || lista[0].id);
      })
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível carregar as aplicações.')));
  }, [ciclo.id]);

  useEffect(() => {
    if (!aplicacaoId) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId]);

  /**
   * ⭐ Depois de GRAVAR — nunca na montagem. O cabeçalho (linha de estado,
   * "→ Próximo", faixas) é do pai e não tem como saber que esta aba escreveu.
   *
   * ⚠️ Separado do `carregar()` de propósito: `carregar` roda também ao montar
   * a aba, e o `/resumo` é caro (ele varre as aplicações para contar quem está
   * sem avaliador). Pendurar a recarga ali dobrava o custo a cada troca de aba,
   * para atualizar um número que não mudou.
   */
  async function gravou() {
    await carregar();
    void recarregarResumo();
  }

  async function carregar() {
    setErro(null);
    setLinhas(null);
    setSelecao(new Set());
    try {
      setLinhas(await designacao.listar(aplicacaoId));
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível carregar a lista.'));
    }
  }

  /**
   * ⚠️ Chamava-se `contagem` e colidia com o helper de concordância
   * (`lib/formato`), que tem o mesmo nome e é usado nesta mesma tela. São
   * contadores dos filtros, e `contadores` é o nome que o backend já usa para
   * a mesma coisa no relatório da cópia.
   */
  const contadores = useMemo(() => {
    const l = linhas ?? [];
    const elegiveis = l.filter((x) => x.elegivel);
    return {
      elegiveis: elegiveis.length,
      excluidos: l.length - elegiveis.length,
      semAvaliador: elegiveis.filter((x) => !x.avaliadorId).length,
    };
  }, [linhas]);

  const visiveis = (linhas ?? [])
    .filter((l) =>
      so === 'SEM_AVALIADOR'
        ? l.elegivel && !l.avaliadorId
        : so === 'EXCLUIDOS'
          ? !l.elegivel
          : true,
    )
    .filter((l) => {
      const t = filtro.trim().toLowerCase();
      return !t || l.nome.toLowerCase().includes(t) || l.matricula.includes(t);
    });

  if (!apls) return <Carregando />;
  if (apls.length === 0) {
    return (
      <Vazio
        titulo="Nenhuma aplicação neste ciclo"
        detalhe="A lista de designação sai dos centros de custo da aplicação. Monte pelo menos uma antes."
      />
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-52 flex-1">
          <span className="text-sm font-medium text-slate-700">Aplicação</span>
          <select
            value={aplicacaoId}
            onChange={(e) => setAplicacaoId(e.target.value)}
            className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
          >
            {apls.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Nome ou matrícula"
            aria-label="Filtrar pessoas"
            className="alvo-toque w-full rounded-xl border border-slate-300 pl-9 pr-3 text-slate-800"
          />
        </div>
        <button
          type="button"
          disabled={copiando || !!fechado}
          title={fechado ?? undefined}
          onClick={() => void previaDaCopia()}
          /* ⚠️ `opacity-50` sobre um botão VERDE SÓLIDO continua um botão verde
             sólido: só o cursor e o `title` denunciavam que estava desligado.
             O desabilitado precisa MUDAR DE COR, não ficar translúcido. */
          className="alvo-toque inline-flex items-center gap-2 rounded-xl bg-capul-600 px-4 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          <Wand2 size={16} aria-hidden />
          {copiando && !copia ? 'Calculando…' : 'Designar pelo cadastro'}
        </button>
      </div>

      {copia && (
        <PainelDaCopia
          copia={copia}
          copiando={copiando}
          substituirManuais={substituirManuais}
          aoTrocarSubstituicao={(v) => {
            setSubstituirManuais(v);
            void previaDaCopia(v);
          }}
          aoAplicar={aplicarCopia}
          aoFechar={() => setCopia(null)}
        />
      )}

      {linhas && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Filtro atual={so} valor="TODOS" aoEscolher={setSo}>
            Todos ({linhas.length})
          </Filtro>
          <Filtro atual={so} valor="SEM_AVALIADOR" aoEscolher={setSo} destaque={contadores.semAvaliador > 0}>
            Sem avaliador ({contadores.semAvaliador})
          </Filtro>
          <Filtro atual={so} valor="EXCLUIDOS" aoEscolher={setSo}>
            Fora do ciclo ({contadores.excluidos})
          </Filtro>
        </div>
      )}

      {erro && (
        <div className="mt-4">
          <Erro mensagem={erro} aoTentarDeNovo={carregar} />
        </div>
      )}
      {!erro && !linhas && (
        <div className="mt-4">
          <Carregando linhas={5} />
        </div>
      )}

      {selecao.size > 0 && (
        <div className="sticky top-0 z-10 mt-4 flex items-center gap-3 rounded-xl border border-capul-200 bg-capul-50 p-3">
          <p className="flex-1 text-sm font-medium text-capul-800">
            {contagem(selecao.size, 'selecionada', 'selecionadas')}
          </p>
          <button
            type="button"
            onClick={() => setSelecao(new Set())}
            className="alvo-toque rounded-lg px-3 text-sm text-capul-800"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => setDesignando(true)}
            disabled={!!fechado}
            title={fechado ?? undefined}
            className="alvo-toque inline-flex items-center gap-2 rounded-lg bg-capul-600 px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <UserPlus size={15} aria-hidden /> Definir avaliador
          </button>
        </div>
      )}

      {linhas && (
        <ul className="mt-4 space-y-2">
          {visiveis.map((l) => (
            <li key={l.colaboradorId}>
              <LinhaDaLista
                fechado={fechado}
                linha={l}
                selecionada={selecao.has(l.colaboradorId)}
                aoSelecionar={(marcada) => {
                  const p = new Set(selecao);
                  if (marcada) p.add(l.colaboradorId);
                  else p.delete(l.colaboradorId);
                  setSelecao(p);
                }}
                aoDecidir={() => setDecidindo(l)}
                aoDesignar={() => setDesignandoUm(l)}
                aoReabrir={() => setReabrindo(l)}
                podeReabrir={tem(ROLES.RH_ADMIN)}
              />
            </li>
          ))}
          {visiveis.length === 0 && (
            <li>
              <Vazio titulo="Nada aqui" detalhe="Nenhuma pessoa corresponde ao filtro." />
            </li>
          )}
        </ul>
      )}

      {decidindo && (
        <DialogoDecisao
          linha={decidindo}
          cicloId={ciclo.id}
          aoFechar={() => setDecidindo(null)}
          aoDecidir={async () => {
            setDecidindo(null);
            await gravou();
          }}
        />
      )}

      {reabrindo?.avaliacaoId && (
        <DialogoReabrir
          linha={reabrindo}
          aoFechar={() => setReabrindo(null)}
          aoReabrir={async () => {
            setReabrindo(null);
            await gravou();
          }}
        />
      )}

      {designandoUm && (
        <DialogoAvaliador
          quantidade={1}
          nomeUnico={designandoUm.nome}
          // ⭐ A MESMA condição do rótulo do botão da linha (`semAvaliador`), para
          // o título do diálogo não contradizer o botão que o abriu.
          verbo={designandoUm.avaliadorId ? 'Trocar' : 'Definir'}
          aplicacaoId={aplicacaoId}
          avaliados={[designandoUm.colaboradorId]}
          aoFechar={() => setDesignandoUm(null)}
          aoConcluir={async () => {
            setDesignandoUm(null);
            await gravou();
          }}
        />
      )}

      {designando && (
        <DialogoAvaliador
          quantidade={selecao.size}
          aplicacaoId={aplicacaoId}
          avaliados={[...selecao]}
          aoFechar={() => setDesignando(false)}
          aoConcluir={async () => {
            setDesignando(false);
            await gravou();
          }}
        />
      )}
    </div>
  );
}

function Filtro<T extends string>({
  atual,
  valor,
  aoEscolher,
  destaque,
  children,
}: {
  atual: T;
  valor: T;
  aoEscolher: (v: T) => void;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  const ativo = atual === valor;
  return (
    <button
      type="button"
      onClick={() => aoEscolher(valor)}
      aria-pressed={ativo}
      className={`alvo-toque rounded-full border px-3 text-sm font-medium ${
        ativo
          ? 'border-capul-600 bg-capul-600 text-white'
          : destaque
            ? 'border-amber-300 bg-amber-50 text-amber-900'
            : 'border-slate-300 bg-white text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function LinhaDaLista({
  fechado,
  linha,
  selecionada,
  aoSelecionar,
  aoDecidir,
  aoDesignar,
  aoReabrir,
  podeReabrir,
}: {
  /** Motivo de o ciclo não aceitar escrita — `null` quando aceita. */
  fechado: string | null;
  linha: LinhaDaDesignacao;
  selecionada: boolean;
  aoSelecionar: (v: boolean) => void;
  aoDecidir: () => void;
  aoDesignar: () => void;
  aoReabrir: () => void;
  /** RH_ADMIN — só ele reabre, e a API cobra o mesmo. */
  podeReabrir: boolean;
}) {
  const semAvaliador = linha.elegivel && !linha.avaliadorId;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${
        !linha.elegivel ? 'border-slate-200 opacity-70' : semAvaliador ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      <input
        type="checkbox"
        checked={selecionada}
        disabled={!linha.elegivel || !!fechado}
        title={fechado ?? undefined}
        onChange={(e) => aoSelecionar(e.target.checked)}
        aria-label={`Selecionar ${linha.nome}`}
        className="mt-1 size-4 shrink-0 accent-capul-600 disabled:opacity-40"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800">
          {linha.nome}
          {/* ⭐ A própria linha vem MARCADA, nunca filtrada: filtrar faria o
              total não fechar, e o total é o número que alguém confere contra a
              folha. Aqui a gestora se vê com "Avalia: CLAUDIMAR · PENDENTE" — é
              informação sobre ela, e ela precisa saber que está olhando para si. */}
          {linha.restrita && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 align-middle text-xs font-medium text-sky-800">
              você
            </span>
          )}
        </p>
        <p className="truncate text-sm text-slate-500">
          {linha.matricula} · CC {linha.centroCusto ?? '—'} · filial {linha.filial}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {!linha.elegivel && (
            <Etiqueta tom="neutro">
              <X size={11} aria-hidden /> Fora: {rotuloDoMotivo(linha.motivo)}
            </Etiqueta>
          )}
          {linha.decididoManualmente && <Etiqueta tom="azul">decisão do RH</Etiqueta>}
          {/* ⚠️ NÃO depende mais de `elegivel` (08/09). A etiqueta só aparecia
              para elegíveis, então bastava excluir alguém para a avaliação dele
              SUMIR DA TELA DO RH — enquanto continuava na fila do avaliador.
              Era pior que esconder a pessoa: escondia o que estava em jogo,
              justamente de quem precisava decidir. Marcar, nunca filtrar. */}
          {linha.avaliadorId && (
            <Etiqueta tom={linha.avaliacaoStatus === 'CANCELADA' ? 'neutro' : 'verde'}>
              <UserCheck size={11} aria-hidden />{' '}
              {linha.avaliacaoStatus === 'CANCELADA' ? 'Era de' : 'Avalia'}: {linha.avaliadorNome}
            </Etiqueta>
          )}
          {semAvaliador && (
            <Etiqueta tom="ambar">Sem avaliador — não vai gerar avaliação</Etiqueta>
          )}
          {linha.avaliacaoStatus && linha.avaliacaoStatus !== 'PENDENTE' && (
            <Etiqueta tom="neutro">{linha.avaliacaoStatus.replace('_', ' ').toLowerCase()}</Etiqueta>
          )}
        </div>
        {linha.justificativa && (
          <p className="mt-1 text-xs italic text-slate-500">“{linha.justificativa}”</p>
        )}
        {/* ⭐⭐ O MOTIVO DO CANCELAMENTO, que a linha não tinha por onde mostrar.
            As 37 canceladas pelo encerramento do SIMULACAO apareciam só como
            "cancelada", enquanto as 2 excluídas à mão traziam o texto delas —
            e o motivo das 37 estava gravado o tempo todo. O diálogo de encerrar
            promete que ele "responde, meses depois, por que estas ficaram sem
            nota"; era o único caso em que não respondia.
            ⚠️ Só quando DIFERE da justificativa: o Excluir grava o mesmo texto
            nos dois campos, e repeti-lo faria a linha dizer duas vezes. */}
        {linha.motivoCancelamento && linha.motivoCancelamento !== linha.justificativa && (
          <p className="mt-1 text-xs italic text-rose-700">“{linha.motivoCancelamento}”</p>
        )}
      </div>
      {/* ⭐⭐ "Definir avaliador" NA LINHA, e antes do "Excluir".
          Quem está sem avaliador tinha um ato só à mão — **Excluir** —, e o
          caminho de menor resistência para zerar a pendência era eliminar a
          pessoa: o contador caía como se estivesse resolvido. Designar exigia
          descobrir o checkbox e a barra de seleção. É irmão da hipótese dos dois
          atos combinados (§3.1.4), com um agravante: ali são dois atos
          deliberados, aqui é UM, e era o mais fácil. */}
      <div className="flex shrink-0 flex-col items-stretch gap-1 self-center sm:flex-row sm:items-center">
        {/* ⭐⭐ TROCAR pela LINHA (08/09). O botão só aparecia para quem estava
            SEM avaliador: quem errou a designação não tinha correção na linha —
            sobrava "Excluir", e a única saída era o lote, que era o outro
            defeito do item E. Agora a linha oferece as duas coisas, e o rótulo
            diz qual é qual.
            ⚠️ Some só quando não há o que designar (linha fora do ciclo) — e aí
            fica DESABILITADO com o motivo, nunca escondido. */}
        {linha.elegivel && (
          <button
            type="button"
            onClick={aoDesignar}
            /* ⚠️ CANCELADA recusa no backend (`efeitoDeDesignar`: o upsert a
               reviveria cancelada, com avaliador novo). O botão era oferecido
               igual e só falhava no clique — a tela prometendo o que a API
               nega, de novo. É estado, não falta de objeto: desabilita com o
               motivo, e o motivo diz que não há caminho de volta. */
            disabled={!!fechado || linha.avaliacaoStatus === 'CANCELADA'}
            title={
              fechado ??
              (linha.avaliacaoStatus === 'CANCELADA'
                ? 'A avaliação desta pessoa está CANCELADA e não há caminho para descancelar — designar de novo a reviveria cancelada.'
                : undefined)
            }
            /* ⚠️ REGRA DE DESABILITADO (varrida em 16 botões): `opacity-50`
               sobre cor própria NÃO lê como desligado — um verde 50% continua
               verde. Só o cursor e o `title` denunciavam. Botão com cor
               precisa TROCAR de cor ao desabilitar; o cinza é o sinal. */
            className={`alvo-toque inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${
              semAvaliador
                ? 'bg-capul-600 text-white'
                : 'border border-capul-300 text-capul-800'
            }`}
          >
            <UserPlus size={14} aria-hidden />
            {semAvaliador ? 'Definir avaliador' : 'Trocar avaliador'}
          </button>
        )}
        {/* ⭐⭐ REABRIR, NA LINHA. O diálogo de envio PROMETE ao avaliador que
            "o RH pode reabrir", e o ato só existia na API — a tela anunciava
            para outra pessoa uma saída que ninguém conseguia percorrer
            (§3.1.41). É "capacidade sem sinal na tela" agravada.
            ⚠️⚠️ SOME, não fica desabilitado — e a distinção é regra, não gosto.
            "Desabilite com o motivo, nunca esconda" (§5.9 regra 8) existe para
            o caso em que a pessoa **poderia querer fazer** e algo a impede:
            ali o cinza com o motivo ensina o que falta. Reabrir uma avaliação
            que não foi enviada é **ato sem objeto** — não há nada para reabrir,
            e um botão cinza dizendo "não enviada" ofereceria uma ação que não
            existe, convidando a pessoa a procurar a permissão que lhe falta.
            **Falta de objeto some; falta de permissão ou de estado desabilita
            com o motivo** — e é por isso que o `disabled={!!fechado}` continua
            aqui: ciclo encerrado É estado, e aí o botão fica cinza dizendo
            "reabra o ciclo primeiro". */}
        {podeReabrir && linha.avaliacaoStatus === 'ENVIADA' && linha.avaliacaoId && (
          <button
            type="button"
            onClick={aoReabrir}
            disabled={!!fechado}
            title={fechado ?? undefined}
            className="alvo-toque rounded-lg border border-amber-400 px-3 text-sm font-medium text-amber-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Reabrir
          </button>
        )}
        <button
          type="button"
          onClick={aoDecidir}
          disabled={!!fechado}
          title={fechado ?? undefined}
          className="alvo-toque rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {linha.elegivel ? 'Excluir' : 'Incluir'}
        </button>
      </div>
    </div>
  );
}

function rotuloDoMotivo(motivo: string | null) {
  if (!motivo) return 'sem motivo registrado';
  return motivo.toLowerCase().replace(/_/g, ' ');
}

function DialogoDecisao({
  linha,
  cicloId,
  aoFechar,
  aoDecidir,
}: {
  linha: LinhaDaDesignacao;
  cicloId: string;
  aoFechar: () => void;
  aoDecidir: () => Promise<void>;
}) {
  const decisao = linha.elegivel ? 'EXCLUIR' : 'INCLUIR';
  /**
   * ⭐⭐ O EFEITO REAL, dito antes do clique valer — e vindo do backend, que é
   * quem decide. Até 08/09 esta confirmação dizia só "Excluir a tira deste
   * ciclo", enquanto no dado a avaliação continuava viva na fila do avaliador.
   * `RECUSAR` = a API vai barrar (avaliação já enviada): a tela desabilita e
   * mostra o porquê, em vez de deixar descobrir no erro.
   */
  const efeito = decisao === 'EXCLUIR' ? linha.efeitoDoExcluir : null;
  const bloqueado = efeito?.acao === 'RECUSAR';
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await designacao.decidir(cicloId, linha.colaboradorId, decisao, justificativa.trim());
      await aoDecidir();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível registrar a decisão.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`${decisao === 'INCLUIR' ? 'Incluir' : 'Excluir'} ${linha.nome}`} aoFechar={aoFechar}>
      <p className="text-sm text-slate-600">
        {decisao === 'INCLUIR'
          ? 'Esta pessoa está fora da lista pela régua. Incluir sobrepõe a régua para este ciclo.'
          : 'Esta pessoa está na lista pela régua. Excluir a tira deste ciclo.'}
      </p>
      <p className="mt-2 text-sm text-slate-500">
        A decisão anterior não é apagada — fica marcada como removida, e reverter é registrar outra.
      </p>

      {efeito?.frase && (
        <div
          className={`mt-3 rounded-xl border p-3 text-sm ${
            bloqueado
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-medium">
            {bloqueado ? 'Não dá para excluir agora' : 'O que isto faz com a avaliação'}
          </p>
          <p className="mt-1">{efeito.frase}</p>
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">Motivo</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Sem motivo a linha vira “alguém decidiu algo”, que é o mesmo que não ter registro quando
          alguém perguntar meses depois.
        </span>
        <textarea
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-slate-800"
        />
      </label>

      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro} />
        </div>
      )}

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
          disabled={salvando || bloqueado || justificativa.trim().length < 3}
          onClick={salvar}
          className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {salvando ? 'Registrando…' : 'Registrar decisão'}
        </button>
      </div>
    </Modal>
  );
}

function DialogoAvaliador({
  quantidade,
  nomeUnico,
  verbo = 'Definir',
  aplicacaoId,
  avaliados,
  aoFechar,
  aoConcluir,
}: {
  quantidade: number;
  /** Quando é UMA pessoa, o título diz o nome dela em vez de "1 pessoa(s)". */
  nomeUnico?: string;
  /**
   * ⭐ O MODO, dito por quem abriu. O título era sempre "Definir avaliador de…",
   * inclusive quando o botão clicado dizia "Trocar avaliador" — quem já tem
   * avaliador lia, no diálogo, que estava definindo um do zero. A linha sabe
   * qual é o caso (`semAvaliador`); faltava passar.
   */
  verbo?: 'Definir' | 'Trocar';
  aplicacaoId: string;
  avaliados: string[];
  aoFechar: () => void;
  aoConcluir: () => Promise<void>;
}) {
  const [escolhido, setEscolhido] = useState<ColaboradorDaBusca | null>(null);
  const [previa, setPrevia] = useState<PreviaDaDesignacao | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [progresso, setProgresso] = useState<{ feitos: number; falhas: string[] } | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * ⭐⭐ A PRÉVIA VEM DO BACKEND, da MESMA função que o `designar` usa para
   * decidir. A tela não recalcula quantos serão substituídos: se recalculasse,
   * a prévia e o ato divergiriam no primeiro caso de borda — que é exatamente o
   * defeito que ela veio evitar (§3.1.22).
   */
  useEffect(() => {
    if (!escolhido) {
      setPrevia(null);
      return;
    }
    let vivo = true;
    setCarregandoPrevia(true);
    designacao
      .previaDaDesignacao(aplicacaoId, avaliados, escolhido.id)
      .then((p) => vivo && setPrevia(p))
      .catch((e) => vivo && setErro(mensagemDoErro(e, 'Não foi possível calcular o efeito.')))
      .finally(() => vivo && setCarregandoPrevia(false));
    return () => {
      vivo = false;
    };
  }, [escolhido, aplicacaoId, avaliados]);

  /**
   * ⭐ O QUE O BOTÃO VAI MESMO FAZER. Uma conta, lida em dois lugares — a frase
   * "Nada mudaria com esta escolha" e o `disabled` do botão. `recusar` e
   * `nadaAFazer` ficam de fora porque nenhum dos dois grava.
   */
  const nadaAAplicar =
    previa !== null && previa.criar + previa.substituir + previa.exigeConfirmacao === 0;

  const substituicoes = previa?.linhas.filter((l) => l.acao === 'SUBSTITUIR') ?? [];
  const comAviso = previa?.linhas.filter((l) => l.acao === 'EXIGE_CONFIRMACAO') ?? [];
  const recusadas = previa?.linhas.filter((l) => l.acao === 'RECUSAR') ?? [];

  async function aplicar() {
    if (!escolhido) return;
    setErro(null);
    setSucesso(null);
    const falhas: string[] = [];
    let feitas = 0;
    for (const [i, avaliadoId] of avaliados.entries()) {
      try {
        // ⚠️ A confirmação só vale para as linhas que a PRÉVIA marcou como
        // "exige confirmação" — a pessoa leu o aviso com o nome delas antes de
        // clicar. Mandar `true` para todas seria confirmar o que ninguém viu.
        const precisaConfirmar = comAviso.some((l) => l.colaboradorId === avaliadoId);
        await designacao.designar(aplicacaoId, avaliadoId, escolhido.id, precisaConfirmar);
        feitas++;
      } catch (e) {
        // ⚠️ Uma recusa não pode derrubar as outras — a mais comum é a pessoa
        // selecionada ser o próprio avaliador, e a lista inteira parar por
        // causa dela seria pior do que dizer quais não deram.
        falhas.push(mensagemDoErro(e));
      }
      setProgresso({ feitos: i + 1, falhas });
    }
    if (falhas.length === 0) {
      // ⭐ MENSAGEM DE SUCESSO. O diálogo fechava calado, e quem clicou ficava
      // sem saber se algo aconteceu — em lote, sem saber com quantas.
      setSucesso(
        `${contagem(feitas, 'designação gravada', 'designações gravadas')} para ${escolhido.nome}.` +
          (substituicoes.length > 0 ? ` ${substituicoes.length} substituíram o avaliador anterior.` : ''),
      );
      await aoConcluir();
    } else {
      setErro(`${falhas.length} de ${avaliados.length} não puderam ser designadas.`);
    }
  }

  return (
    <Modal
      titulo={
        nomeUnico
          ? `${verbo} avaliador de ${nomeUnico}`
          : `${verbo} avaliador de ${contagem(quantidade, 'pessoa', 'pessoas')}`
      }
      aoFechar={aoFechar}
    >
      {/* Mesma peça do cadastro (`SeletorDeColaborador`): duas cópias de uma
          busca com debounce envelhecem diferente, e a que envelhece pior é a que
          ninguém está olhando. */}
      <SeletorDeColaborador escolhido={escolhido} aoEscolher={setEscolhido} rotulo="Buscar avaliador" />

      <p className="mt-2 text-xs text-slate-500">
        Ninguém pode ser avaliador da própria avaliação — se a pessoa escolhida estiver na seleção, a
        linha dela é recusada e as demais seguem.
      </p>

      {/* ⭐⭐ QUEM SÃO AS N, e o que acontece com cada uma. O diálogo em lote não
          dizia nem uma coisa nem outra: marcava-se um grupo, escolhia-se um
          avaliador e quem já tinha outro era SOBRESCRITO em silêncio. É a
          família do modal de vínculo — botão armado com efeito que a tela não
          mostra. */}
      {carregandoPrevia && <p className="mt-3 text-sm text-slate-500">Calculando o efeito…</p>}
      {previa && !carregandoPrevia && (
        <div className="mt-3 space-y-2 rounded-xl border-2 border-capul-300 p-3">
          {/* ⭐⭐ AS CINCO AÇÕES, e não quatro. O contador de `EXIGE_CONFIRMACAO`
              faltava e o efeito não tinha onde aparecer: trocar o avaliador de
              quem já respondeu imprimia "0 ganham · 0 SUBSTITUÍDO" com o botão
              logo abaixo prestes a aplicar 1. Os zeros continuam ocultos — o que
              não pode é um número existir e não ter linha. */}
          <p className="text-sm text-slate-700">
            <strong className="tabular-nums">{previa.criar}</strong>{' '}
            {flexao(previa.criar, 'ganha', 'ganham')} avaliador ·{' '}
            <strong className={`tabular-nums ${previa.substituir > 0 ? 'text-amber-800' : ''}`}>
              {previa.substituir}
            </strong>{' '}
            {flexao(previa.substituir, 'tem', 'têm')} o avaliador SUBSTITUÍDO
            {previa.exigeConfirmacao > 0 && (
              <>
                {' · '}
                <strong className="tabular-nums text-rose-800">{previa.exigeConfirmacao}</strong>{' '}
                <span className="text-rose-800">
                  {flexao(
                    previa.exigeConfirmacao,
                    'já respondida — pede confirmação',
                    'já respondidas — pedem confirmação',
                  )}
                </span>
              </>
            )}
            {previa.nadaAFazer > 0 &&
              ` · ${previa.nadaAFazer} ${flexao(previa.nadaAFazer, 'já é', 'já são')} de ${previa.avaliadorNome}`}
            {previa.recusar > 0 && ` · ${contagem(previa.recusar, 'recusada', 'recusadas')}`}
          </p>

          {substituicoes.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">Estas trocam de avaliador:</p>
              <ul className="mt-1 space-y-0.5">
                {substituicoes.slice(0, 10).map((l) => (
                  <li key={l.colaboradorId}>
                    <strong>{l.nome}</strong> — hoje é avaliada por {l.avaliadorAtual}
                  </li>
                ))}
                {substituicoes.length > 10 && <li>… e mais {substituicoes.length - 10}</li>}
              </ul>
            </div>
          )}

          {/* ⚠️ Avaliação JÁ RESPONDIDA: continua permitido — é como o RH corrige
              "designei o supervisor errado" — mas nunca em silêncio.
              ⚠️ A EXPLICAÇÃO vai UMA VEZ (`avisoDeRespondidas`, escrito pelo
              backend) e a lista diz só de QUEM se trata: repetir a frase inteira
              por pessoa fica ilegível já em três, e com cinquenta ninguém lê. */}
          {comAviso.length > 0 && (
            <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
              <p className="font-semibold">{previa.avisoDeRespondidas}</p>
              <ul className="mt-1.5 space-y-0.5">
                {comAviso.slice(0, 10).map((l) => (
                  <li key={l.colaboradorId}>
                    <strong>{l.nome}</strong> — {l.estadoAtual}
                  </li>
                ))}
                {comAviso.length > 10 && <li>… e mais {comAviso.length - 10}</li>}
              </ul>
            </div>
          )}

          {recusadas.length > 0 && (
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-700">
              <p className="font-medium">
                {recusadas.length}{' '}
                {flexao(recusadas.length, 'será recusada', 'serão recusadas')}:
              </p>
              <ul className="mt-1 space-y-1">
                {recusadas.map((l) => (
                  <li key={l.colaboradorId}>{l.frase}</li>
                ))}
              </ul>
            </div>
          )}

          {nadaAAplicar && (
            <p className="text-sm text-slate-500">Nada mudaria com esta escolha.</p>
          )}
        </div>
      )}

      {progresso && (
        <p className="mt-3 text-sm text-slate-600">
          {progresso.feitos} de {contagem(avaliados.length, 'processada', 'processadas')}
          {progresso.falhas.length > 0 && ` · ${contagem(progresso.falhas.length, 'recusada', 'recusadas')}`}
        </p>
      )}
      {sucesso && (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {sucesso}
        </p>
      )}
      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro} dica={progresso?.falhas[0]} />
        </div>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          Fechar
        </button>
        <button
          type="button"
          /* ⭐⭐ NADA A APLICAR ⇒ BOTÃO DESLIGADO. Com tudo recusado, o painel
             já dizia "Nada mudaria com esta escolha" e o botão continuava
             armado: o inverso exato do defeito do §3.1.27 — lá ele fazia MAIS
             do que o resumo dizia, aqui não faria nada e parecia que faria.
             ⚠️ A conta é a MESMA do "Nada mudaria" logo acima, e é de propósito:
             a frase e o botão têm de sair do mesmo número, senão voltam a
             discordar. O modal de vínculo e a prévia do lote (`aGravar === 0`)
             já seguiam esta regra; esta era a que faltava. */
          disabled={
            !escolhido ||
            carregandoPrevia ||
            nadaAAplicar ||
            (progresso !== null && progresso.feitos === avaliados.length)
          }
          onClick={aplicar}
          className={`alvo-toque flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${
            comAviso.length > 0 ? 'bg-rose-700' : 'bg-capul-600'
          }`}
        >
          {/* O rótulo carrega o efeito, não "Aplicar" — em lote, o número. */}
          {comAviso.length > 0
            ? `Aplicar mesmo assim (${contagem(comAviso.length, 'respondida', 'respondidas')})`
            : previa && previa.substituir > 0
              ? `Aplicar · ${contagem(previa.substituir, 'substituição', 'substituições')}`
              : 'Aplicar'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * ⭐ A PRÉVIA DA CÓPIA — o que VAI acontecer, antes de gravar.
 *
 * Mesmo padrão da importação da planilha, pela mesma razão: mil designações
 * conferidas depois de gravadas não são conferidas. O botão só grava depois de
 * a gestora ver os números, e o que fica de fora aparece com nome e motivo.
 */
function PainelDaCopia({
  copia, copiando, substituirManuais, aoTrocarSubstituicao, aoAplicar, aoFechar,
}: {
  copia: RelatorioDaCopia;
  copiando: boolean;
  substituirManuais: boolean;
  aoTrocarSubstituicao: (v: boolean) => void;
  aoAplicar: () => Promise<void>;
  aoFechar: () => void;
}) {
  const aGravar = copia.criar + copia.atualizar;
  /**
   * ⚠️ Cada rótulo diz de que EIXO ele fala. "Sem avaliador no cadastro" e
   * "já designada à mão" são perguntas diferentes (cadastro × ciclo), e só a
   * primeira significa ficar de fora — ver §3.1.20.
   */
  const rotulo: Record<string, string> = {
    SEM_AVALIADOR_NO_CADASTRO: 'sem avaliador no cadastro e sem avaliação — ficam de fora',
    SEM_CADASTRO_JA_DESIGNADA: 'sem cadastro, mas já designadas no ciclo — seguem como estão',
    AJUSTE_MANUAL_DO_CICLO: 'ajustadas à mão neste ciclo',
    JA_RESPONDIDA: 'já respondidas',
    TROCA_DE_APLICACAO: 'trocariam de aplicação',
  };

  /**
   * Quem aparece NOMEADA na lista de baixo: todas as não-aplicadas menos as "sem
   * avaliador no cadastro", que se resolvem em lote no cadastro e encheriam a
   * tela com centenas de linhas. É esta lista que o corte de 12 recorta — e é
   * dela que o "… e mais N" tem de falar.
   */
  const nomeadas = copia.naoAplicadas.filter((l) => l.motivo !== 'SEM_AVALIADOR_NO_CADASTRO');

  return (
    <section className="mt-4 space-y-3 rounded-2xl border-2 border-capul-300 bg-white p-4">
      <div className="flex items-start gap-2">
        <Wand2 size={18} className="mt-0.5 shrink-0 text-capul-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-800">
            {copia.aplicado ? 'Designação aplicada' : 'O que vai acontecer'}
          </h3>
          <p className="text-sm text-slate-500">
            {copia.aplicado
              ? `Concluída em ${((copia.duracaoMs ?? 0) / 1000).toFixed(1)}s.`
              : 'Nada foi gravado ainda.'}
          </p>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="alvo-toque shrink-0 rounded-lg px-2 text-slate-400 hover:bg-slate-100"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NumeroDaCopia rotulo={copia.aplicado ? 'criadas' : 'a criar'} valor={copia.criar} destaque />
        <NumeroDaCopia rotulo={copia.aplicado ? 'atualizadas' : 'a atualizar'} valor={copia.atualizar} />
        <NumeroDaCopia rotulo="já iguais (não mexe)" valor={copia.jaIguais} />
        <NumeroDaCopia
          rotulo="de divisão não revisada"
          valor={copia.deDivisaoNaoRevisada}
          tom={copia.deDivisaoNaoRevisada > 0 ? 'ambar' : undefined}
        />
      </dl>

      {copia.avisos.map((a, i) => (
        <p key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle size={15} className="mr-1.5 inline align-text-top" aria-hidden />
          {a}
        </p>
      ))}

      {Object.keys(copia.porMotivo).length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {/* Uma lista só, para o corte e o "e mais N" contarem a MESMA coisa —
              a contagem sobre `naoAplicadas` inteira e o corte sobre a filtrada
              foi o que deixou o 13 e o 12 divergirem. */}
          {/* ⚠️ Dizia "{N} pessoa(s) ficam de fora" para TODAS as não-aplicadas —
              incluindo as já respondidas e as ajustadas à mão, que estão bem
              dentro do ciclo. Era a mesma afirmação falsa do aviso, e mais
              ampla que ele. "O lote não altera" é o que estas linhas têm em
              comum; ficar de fora é só de uma delas, e o rótulo diz qual. */}
          <p className="font-medium text-slate-700">
            {contagem(copia.naoAplicadas.length, 'pessoa', 'pessoas')} que o lote NÃO altera:
          </p>
          <ul className="mt-1 space-y-0.5 text-slate-600">
            {Object.entries(copia.porMotivo).map(([motivo, n]) => (
              <li key={motivo}>
                <strong className="tabular-nums">{n}</strong> {rotulo[motivo] ?? motivo}
              </li>
            ))}
          </ul>
          {/* Os nomes, e não só o total: quem vai resolver precisa saber de quem
              se trata — menos os "sem avaliador", que se resolvem em lote no
              cadastro e encheriam a tela com centenas de linhas.
              ⚠️ As "sem cadastro, mas já designadas" APARECEM: são poucas, e
              cada uma é uma decisão que alguém tomou à mão e que o cadastro
              ainda não conhece. */}
          {/* ⚠️ O CORTE TEM DE APARECER. A lista dizia "13 ajustadas à mão" e
              mostrava 12 nomes, sem indicador: qualquer ciclo com mais de 12
              ajustes manuais mentia calado, e o Piloto já passou desse número.
              O "… e mais N" é o padrão que o Painel ("fora de todas as
              aplicações") e as listas do diálogo de avaliador já usam. */}
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {nomeadas.slice(0, 12).map((l) => (
              <li key={l.colaboradorId}>
                <strong>{l.nome}</strong> ({l.matricula}) — {rotulo[l.motivo]}
              </li>
            ))}
            {nomeadas.length > 12 && <li>… e mais {nomeadas.length - 12}</li>}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Por aplicação</summary>
        <ul className="mt-2 space-y-1 text-slate-600">
          {copia.porAplicacao.map((a) => (
            <li key={a.aplicacaoId}>
              {/* ⭐ "ATIVOS no público": este número é o dos ELEGÍVEIS da
                  aplicação, não o das linhas montadas — quem o ciclo tirou não
                  entra aqui. O cabeçalho do ciclo imprime os dois lados
                  (montado × fora do ciclo); aqui basta o rótulo dizer qual é. */}
              <strong>{a.nome}</strong>: {a.publico} {flexao(a.publico, 'ativo', 'ativos')} no
              público · {a.criar} a criar · {a.jaIguais}{' '}
              {flexao(a.jaIguais, 'já igual', 'já iguais')} · {a.semAvaliador} sem avaliador
            </li>
          ))}
        </ul>
      </details>

      {!copia.aplicado && (
        <>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={substituirManuais}
              disabled={copiando}
              onChange={(e) => aoTrocarSubstituicao(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Substituir os ajustes manuais deste ciclo
              <span className="block text-xs text-slate-500">
                Sem isto, quem o RH já designou à mão dentro do ciclo fica como está — a
                decisão dele vale mais que o cadastro.
              </span>
            </span>
          </label>
          <button
            type="button"
            disabled={copiando || aGravar === 0}
            onClick={() => void aoAplicar()}
            className="alvo-toque w-full rounded-xl bg-capul-600 px-4 py-2.5 font-medium text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            {copiando
              ? 'Aplicando…'
              : aGravar === 0
                ? 'Nada a fazer — a designação já reflete o cadastro'
                : `Confirmar e designar ${contagem(aGravar, 'pessoa', 'pessoas')}`}
          </button>
        </>
      )}
    </section>
  );
}

function NumeroDaCopia({
  rotulo, valor, destaque, tom,
}: { rotulo: string; valor: number; destaque?: boolean; tom?: 'ambar' }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        tom === 'ambar' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <dd className={`tabular-nums font-semibold ${destaque ? 'text-2xl text-capul-700' : 'text-xl text-slate-800'}`}>
        {valor}
      </dd>
      <dt className="text-xs text-slate-600">{rotulo}</dt>
    </div>
  );
}

/**
 * ⭐⭐ REABRIR UMA AVALIAÇÃO — o diálogo que faltava (§3.1.41).
 *
 * ⚠️ **Diz o que vai APAGAR, com o número.** Reabrir apaga o resultado apurado
 * desta pessoa (decisão de 09/09: apagar, não recusar nem marcar como vencido —
 * ver o comentário de `avaliacao.service.reabrir`). Anunciar "isto apaga o
 * resultado" sem a nota deixaria alguém decidir no escuro; e a nota vem do
 * BACKEND, do mesmo registro que o ato vai apagar, não de uma conta da tela.
 */
function DialogoReabrir({
  linha,
  aoFechar,
  aoReabrir,
}: {
  linha: LinhaDaDesignacao;
  aoFechar: () => void;
  aoReabrir: () => Promise<void>;
}) {
  const [efeito, setEfeito] = useState<EfeitoDaReabertura | null>(null);
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    avaliacoesRh
      .efeitoDaReabertura(linha.avaliacaoId!)
      .then((e) => vivo && setEfeito(e))
      .catch((e) => vivo && setErro(mensagemDoErro(e, 'Não foi possível ver o efeito da reabertura.')));
    return () => {
      vivo = false;
    };
  }, [linha.avaliacaoId]);

  async function confirmar() {
    setSalvando(true);
    setErro(null);
    try {
      await avaliacoesRh.reabrir(linha.avaliacaoId!, motivo.trim());
      await aoReabrir();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Reabrir a avaliação de ${linha.nome}`} aoFechar={aoFechar}>
      <p className="text-sm text-slate-700">
        A avaliação volta para <strong>EM ANDAMENTO</strong> e{' '}
        <strong>{linha.avaliadorNome ?? 'o avaliador'}</strong> poderá responder de novo. A nota do
        envio deixa de valer.
      </p>

      {efeito === null && !erro && (
        <p className="mt-3 text-sm text-slate-500">Vendo o que isto afeta…</p>
      )}

      {/* ⭐⭐ O NÚMERO QUE SOME. Sem isto, quem reabre não sabe que está apagando
          um resultado — e a média do ciclo em Resultados muda sem explicação. */}
      {efeito?.apagaResultado && (
        <div className="mt-3 rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">Isto apaga o resultado apurado desta pessoa.</p>
          <p className="mt-1">
            Nota <strong className="tabular-nums">{nota(efeito.notaFinal ?? 0)}</strong>
            {efeito.conceito && <> · conceito <strong>{efeito.conceito}</strong></>}
            {efeito.apuradoEm && <> · apurado em {dataHora(efeito.apuradoEm)}</>}.
          </p>
          <p className="mt-1 text-xs">
            Ele <strong>volta quando você apurar de novo</strong>. Até lá, esta pessoa sai da lista
            de Resultados e da média do ciclo — que passa a ser sobre as demais.
          </p>
        </div>
      )}
      {efeito && !efeito.apagaResultado && (
        <p className="mt-3 text-sm text-slate-600">
          Esta avaliação ainda não foi apurada — não há resultado a apagar.
        </p>
      )}

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Motivo da reabertura
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
          placeholder="Por que esta avaliação precisa ser refeita?"
        />
        {/* ⚠️ Mesma correção do encerrar: a exigência era MUDA — o botão
            travava abaixo do mínimo sem dizer o mínimo. */}
        <span
          className={`mt-1 block text-xs ${
            motivo.trim().length > 0 && motivo.trim().length < 3
              ? 'font-medium text-amber-800'
              : 'text-slate-500'
          }`}
        >
          {motivo.trim().length > 0 && motivo.trim().length < 3
            ? `Escreva pelo menos 3 caracteres — ${flexao(3 - motivo.trim().length, 'falta', 'faltam')} ${3 - motivo.trim().length}.`
            : 'Fica registrado com o seu nome na auditoria, junto com o resultado apagado.'}
        </span>
      </label>

      {erro && <div className="mt-3"><Erro mensagem={erro} /></div>}

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
          disabled={salvando || efeito === null || motivo.trim().length < 3}
          onClick={() => void confirmar()}
          className="alvo-toque flex-1 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        >
          {salvando ? 'Reabrindo…' : 'Reabrir'}
        </button>
      </div>
    </Modal>
  );
}
