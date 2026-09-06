import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, Search, UserCheck, UserPlus, X } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import {
  aplicacoes as apiAplicacoes,
  catalogo,
  designacao,
  mensagemDoErro,
  type AplicacaoDoCiclo,
  type ColaboradorDaBusca,
  type LinhaDaDesignacao,
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
  const { ciclo } = useOutletContext<ContextoDoCiclo>();
  const [apls, setApls] = useState<AplicacaoDoCiclo[] | null>(null);
  const [aplicacaoId, setAplicacaoId] = useState('');
  const [linhas, setLinhas] = useState<LinhaDaDesignacao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [so, setSo] = useState<'TODOS' | 'SEM_AVALIADOR' | 'EXCLUIDOS'>('TODOS');
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [decidindo, setDecidindo] = useState<LinhaDaDesignacao | null>(null);
  const [designando, setDesignando] = useState(false);

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
      </div>

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
            className="alvo-toque inline-flex items-center gap-2 rounded-lg bg-capul-600 px-3 text-sm font-semibold text-white"
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
                linha={l}
                selecionada={selecao.has(l.colaboradorId)}
                aoSelecionar={(marcada) => {
                  const p = new Set(selecao);
                  if (marcada) p.add(l.colaboradorId);
                  else p.delete(l.colaboradorId);
                  setSelecao(p);
                }}
                aoDecidir={() => setDecidindo(l)}
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
            await carregar();
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
            await carregar();
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
  linha,
  selecionada,
  aoSelecionar,
  aoDecidir,
}: {
  linha: LinhaDaDesignacao;
  selecionada: boolean;
  aoSelecionar: (v: boolean) => void;
  aoDecidir: () => void;
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
        disabled={!linha.elegivel}
        onChange={(e) => aoSelecionar(e.target.checked)}
        aria-label={`Selecionar ${linha.nome}`}
        className="mt-1 size-4 shrink-0 accent-capul-600 disabled:opacity-40"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800">{linha.nome}</p>
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
          {linha.elegivel && linha.avaliadorId && (
            <Etiqueta tom="verde">
              <UserCheck size={11} aria-hidden /> Avalia: {linha.avaliadorNome}
            </Etiqueta>
          )}
          {semAvaliador && (
            <Etiqueta tom="ambar">Sem avaliador — não vai gerar avaliação</Etiqueta>
          )}
          {linha.avaliacaoStatus && linha.avaliacaoStatus !== 'PENDENTE' && (
            <Etiqueta tom="neutro">{linha.avaliacaoStatus.replace('_', ' ')}</Etiqueta>
          )}
        </div>
        {linha.justificativa && (
          <p className="mt-1 text-xs italic text-slate-500">“{linha.justificativa}”</p>
        )}
      </div>
      <button
        type="button"
        onClick={aoDecidir}
        className="alvo-toque shrink-0 self-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700"
      >
        {linha.elegivel ? 'Excluir' : 'Incluir'}
      </button>
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
          disabled={salvando || justificativa.trim().length < 3}
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
  aplicacaoId,
  avaliados,
  aoFechar,
  aoConcluir,
}: {
  quantidade: number;
  aplicacaoId: string;
  avaliados: string[];
  aoFechar: () => void;
  aoConcluir: () => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<ColaboradorDaBusca[]>([]);
  const [escolhido, setEscolhido] = useState<ColaboradorDaBusca | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; falhas: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      catalogo.colaboradores(busca).then(setAchados).catch(() => setAchados([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  async function aplicar() {
    if (!escolhido) return;
    setErro(null);
    const falhas: string[] = [];
    for (const [i, avaliadoId] of avaliados.entries()) {
      try {
        await designacao.designar(aplicacaoId, avaliadoId, escolhido.id);
      } catch (e) {
        // ⚠️ Uma recusa não pode derrubar as outras — a mais comum é a pessoa
        // selecionada ser o próprio avaliador, e a lista inteira parar por
        // causa dela seria pior do que dizer quais não deram.
        falhas.push(mensagemDoErro(e));
      }
      setProgresso({ feitos: i + 1, falhas });
    }
    if (falhas.length === 0) await aoConcluir();
    else setErro(`${falhas.length} de ${avaliados.length} não puderam ser designadas.`);
  }

  return (
    <Modal titulo={`Definir avaliador de ${quantidade} pessoa(s)`} aoFechar={aoFechar}>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou matrícula"
        aria-label="Buscar avaliador"
        className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
      />

      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
        {achados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEscolhido(c)}
              className={`alvo-toque flex w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${
                escolhido?.id === c.id ? 'bg-capul-50 text-capul-800' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {escolhido?.id === c.id && <Check size={15} aria-hidden />}
              <span className="min-w-0 flex-1 truncate">
                <strong className="font-medium">{c.nome}</strong>
                <span className="text-slate-500">
                  {' '}
                  · {c.matricula} · {c.cargoDescricao ?? 'sem cargo'}
                </span>
              </span>
            </button>
          </li>
        ))}
        {achados.length === 0 && (
          <li className="px-2 py-3 text-center text-sm text-slate-500">Nenhum resultado.</li>
        )}
      </ul>

      <p className="mt-2 text-xs text-slate-500">
        Ninguém pode ser avaliador da própria avaliação — se a pessoa escolhida estiver na seleção, a
        linha dela é recusada e as demais seguem.
      </p>

      {progresso && (
        <p className="mt-3 text-sm text-slate-600">
          {progresso.feitos} de {avaliados.length} processada(s)
          {progresso.falhas.length > 0 && ` · ${progresso.falhas.length} recusada(s)`}
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
          disabled={!escolhido || (progresso !== null && progresso.feitos === avaliados.length)}
          onClick={aplicar}
          className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Aplicar
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h3 className="text-lg font-semibold text-slate-800">{titulo}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
