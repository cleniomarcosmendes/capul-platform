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
  copiaDoCadastro,
  designacao,
  mensagemDoErro,
  type AplicacaoDoCiclo,
  type ColaboradorDaBusca,
  type LinhaDaDesignacao,
  type PreviaDaDesignacao,
  type RelatorioDaCopia,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';

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
  const [so, setSo] = useState<'TODOS' | 'SEM_AVALIADOR' | 'EXCLUIDOS'>('TODOS');
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [decidindo, setDecidindo] = useState<LinhaDaDesignacao | null>(null);
  const [designando, setDesignando] = useState(false);
  /** Designar UMA pessoa, pela linha — sem passar pela seleção. */
  const [designandoUm, setDesignandoUm] = useState<LinhaDaDesignacao | null>(null);
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

  const contagem = useMemo(() => {
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
          className="alvo-toque inline-flex items-center gap-2 rounded-xl bg-capul-600 px-4 font-medium text-white disabled:opacity-50"
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
          <Filtro atual={so} valor="SEM_AVALIADOR" aoEscolher={setSo} destaque={contagem.semAvaliador > 0}>
            Sem avaliador ({contagem.semAvaliador})
          </Filtro>
          <Filtro atual={so} valor="EXCLUIDOS" aoEscolher={setSo}>
            Fora do ciclo ({contagem.excluidos})
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
            {selecao.size} selecionada(s)
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
            className="alvo-toque inline-flex items-center gap-2 rounded-lg bg-capul-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
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

      {designandoUm && (
        <DialogoAvaliador
          quantidade={1}
          nomeUnico={designandoUm.nome}
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
}: {
  /** Motivo de o ciclo não aceitar escrita — `null` quando aceita. */
  fechado: string | null;
  linha: LinhaDaDesignacao;
  selecionada: boolean;
  aoSelecionar: (v: boolean) => void;
  aoDecidir: () => void;
  aoDesignar: () => void;
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
            disabled={!!fechado}
            title={fechado ?? undefined}
            className={`alvo-toque inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50 ${
              semAvaliador
                ? 'bg-capul-600 text-white'
                : 'border border-capul-300 text-capul-800'
            }`}
          >
            <UserPlus size={14} aria-hidden />
            {semAvaliador ? 'Definir avaliador' : 'Trocar avaliador'}
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
          className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
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
  aplicacaoId,
  avaliados,
  aoFechar,
  aoConcluir,
}: {
  quantidade: number;
  /** Quando é UMA pessoa, o título diz o nome dela em vez de "1 pessoa(s)". */
  nomeUnico?: string;
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
        `${feitas} designação(ões) gravada(s) para ${escolhido.nome}.` +
          (substituicoes.length > 0 ? ` ${substituicoes.length} substituíram o avaliador anterior.` : ''),
      );
      await aoConcluir();
    } else {
      setErro(`${falhas.length} de ${avaliados.length} não puderam ser designadas.`);
    }
  }

  return (
    <Modal
      titulo={nomeUnico ? `Definir avaliador de ${nomeUnico}` : `Definir avaliador de ${quantidade} pessoa(s)`}
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
          <p className="text-sm text-slate-700">
            <strong className="tabular-nums">{previa.criar}</strong> ganham avaliador ·{' '}
            <strong className={`tabular-nums ${previa.substituir > 0 ? 'text-amber-800' : ''}`}>
              {previa.substituir}
            </strong>{' '}
            têm o avaliador SUBSTITUÍDO
            {previa.nadaAFazer > 0 && ` · ${previa.nadaAFazer} já são de ${previa.avaliadorNome}`}
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
              <p className="font-medium">{recusadas.length} serão recusadas:</p>
              <ul className="mt-1 space-y-1">
                {recusadas.map((l) => (
                  <li key={l.colaboradorId}>{l.frase}</li>
                ))}
              </ul>
            </div>
          )}

          {previa.criar + previa.substituir + comAviso.length === 0 && (
            <p className="text-sm text-slate-500">Nada mudaria com esta escolha.</p>
          )}
        </div>
      )}

      {progresso && (
        <p className="mt-3 text-sm text-slate-600">
          {progresso.feitos} de {avaliados.length} processada(s)
          {progresso.falhas.length > 0 && ` · ${progresso.falhas.length} recusada(s)`}
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
          disabled={
            !escolhido ||
            carregandoPrevia ||
            (progresso !== null && progresso.feitos === avaliados.length)
          }
          onClick={aplicar}
          className={`alvo-toque flex-1 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${
            comAviso.length > 0 ? 'bg-rose-700' : 'bg-capul-600'
          }`}
        >
          {/* O rótulo carrega o efeito, não "Aplicar" — em lote, o número. */}
          {comAviso.length > 0
            ? `Aplicar mesmo assim (${comAviso.length} respondida(s))`
            : previa && previa.substituir > 0
              ? `Aplicar · ${previa.substituir} substituição(ões)`
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
          {/* ⚠️ Dizia "{N} pessoa(s) ficam de fora" para TODAS as não-aplicadas —
              incluindo as já respondidas e as ajustadas à mão, que estão bem
              dentro do ciclo. Era a mesma afirmação falsa do aviso, e mais
              ampla que ele. "O lote não altera" é o que estas linhas têm em
              comum; ficar de fora é só de uma delas, e o rótulo diz qual. */}
          <p className="font-medium text-slate-700">
            {copia.naoAplicadas.length} pessoa(s) que o lote NÃO altera:
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
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {copia.naoAplicadas
              .filter((l) => l.motivo !== 'SEM_AVALIADOR_NO_CADASTRO')
              .slice(0, 12)
              .map((l) => (
                <li key={l.colaboradorId}>
                  <strong>{l.nome}</strong> ({l.matricula}) — {rotulo[l.motivo]}
                </li>
              ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Por aplicação</summary>
        <ul className="mt-2 space-y-1 text-slate-600">
          {copia.porAplicacao.map((a) => (
            <li key={a.aplicacaoId}>
              <strong>{a.nome}</strong>: {a.publico} no público · {a.criar} a criar ·{' '}
              {a.jaIguais} já iguais · {a.semAvaliador} sem avaliador
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
            className="alvo-toque w-full rounded-xl bg-capul-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
          >
            {copiando
              ? 'Aplicando…'
              : aGravar === 0
                ? 'Nada a fazer — a designação já reflete o cadastro'
                : `Confirmar e designar ${aGravar} pessoa(s)`}
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
