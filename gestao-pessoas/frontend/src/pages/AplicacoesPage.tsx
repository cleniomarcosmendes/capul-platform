import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Plus, Users } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import {
  aplicacoes as apiAplicacoes,
  catalogo,
  mensagemDoErro,
  type AplicacaoDoCiclo,
  type CentroCustoDoCatalogo,
  type CriterioDoCatalogo,
  type ModeloDoCatalogo,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';

/**
 * APLICAÇÕES — a peça que resolve o problema que originou o módulo: as mesmas 15
 * perguntas eram aplicadas a ~1.000 pessoas, do aprendiz ao supervisor.
 *
 * Cada aplicação casa UM questionário com UM público (centros de custo) e diz
 * quanto ele vale ao lado dos critérios cadastrais.
 *
 * ⭐ A tela mostra a DIVISÃO EM PERCENTUAL enquanto se digita. Os pesos são
 * números livres (18 e 6 são pesos, não porcentagens), e sem ver "questionário
 * 60% · escolaridade 20% · tempo de casa 20%" ninguém sabe o que acabou de
 * montar. É a mesma normalização que o motor faz na hora de apurar.
 *
 * ⭐ Aplicação SEM nenhum critério é válida — é o caso dos aprendizes, que estão
 * no piso de escolaridade, tempo de casa e cursos por definição.
 */
export default function AplicacoesPage() {
  const { ciclo } = useOutletContext<ContextoDoCiclo>();
  const { tem } = useAuth();
  const [lista, setLista] = useState<AplicacaoDoCiclo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const montavel = ciclo.status === 'RASCUNHO' && tem(ROLES.RH_ADMIN, ROLES.RH_CICLO);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo.id]);

  async function carregar() {
    setErro(null);
    try {
      setLista(await apiAplicacoes.doCiclo(ciclo.id));
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível carregar as aplicações.'));
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">
          Um questionário por perfil de público. O peso da avaliação e o dos critérios definem a
          composição da nota.
        </p>
        {montavel && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="alvo-toque inline-flex shrink-0 items-center gap-2 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white"
          >
            <Plus size={16} aria-hidden /> Nova
          </button>
        )}
      </div>

      {ciclo.status !== 'RASCUNHO' && (
        <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
          O ciclo está {ciclo.status.replace('_', ' ')} — aplicações só podem ser montadas enquanto ele é
          RASCUNHO. Mudança de peso depois da abertura é reapuração, não remontagem.
        </p>
      )}

      {erro && <Erro mensagem={erro} aoTentarDeNovo={carregar} />}
      {!erro && !lista && <Carregando />}
      {lista?.length === 0 && (
        <Vazio
          titulo="Nenhuma aplicação montada"
          detalhe="Sem aplicação não há questionário, e o ciclo não abre. Comece por uma para o público geral e crie outras para os perfis que precisam de instrumento próprio."
        />
      )}

      {lista && lista.length > 0 && (
        <ul className="space-y-3">
          {lista.map((a) => (
            <li key={a.id}>
              <CartaoDeAplicacao aplicacao={a} />
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <DialogoNovaAplicacao
          cicloId={ciclo.id}
          aoFechar={() => setCriando(false)}
          aoCriar={async () => {
            setCriando(false);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

/** Divisão em percentual — a mesma normalização que o motor faz ao apurar. */
function repartir(pesoAvaliacao: number, criterios: { nome: string; peso: number }[]) {
  const total = pesoAvaliacao + criterios.reduce((s, c) => s + c.peso, 0);
  if (total <= 0) return [];
  return [
    { nome: 'Questionário', pct: (pesoAvaliacao / total) * 100 },
    ...criterios.map((c) => ({ nome: c.nome, pct: (c.peso / total) * 100 })),
  ];
}

function CartaoDeAplicacao({ aplicacao }: { aplicacao: AplicacaoDoCiclo }) {
  const fatias = repartir(
    Number(aplicacao.pesoAvaliacao),
    aplicacao.criterios.map((c) => ({ nome: c.criterio.nome, peso: Number(c.peso) })),
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-800">{aplicacao.nome}</h3>
        <Etiqueta tom="azul">{aplicacao._count.avaliacoes} avaliação(ões)</Etiqueta>
        {aplicacao.criterios.length === 0 && (
          <Etiqueta tom="ambar">só questionário</Etiqueta>
        )}
      </div>

      <BarraDeComposicao fatias={fatias} />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Critérios</p>
          {aplicacao.criterios.length === 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              Nenhum — a nota é 100% do questionário.
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5 text-sm text-slate-600">
              {aplicacao.criterios.map((c) => (
                <li key={c.criterioId}>
                  {c.criterio.nome} <span className="text-slate-400">peso {Number(c.peso)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Público</p>
          {/* ⚠️ O público é NOMINAL: uma linha por pessoa em `aplicacao_publico`.
              Mostrar a lista de centros de custo diria a coisa errada sobre um
              público montado por outro caminho — o dos aprendizes é por cargo e
              não tem centro de custo nenhum. Aqui vai o número e DE ONDE veio. */}
          {aplicacao.publico.total === 0 ? (
            <p className="mt-1 text-sm text-amber-700">
              Nenhuma pessoa no público — ninguém será designado nesta aplicação.
            </p>
          ) : (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-slate-700">
                <strong className="tabular-nums">{aplicacao.publico.total}</strong> pessoa(s)
              </p>
              {aplicacao.publico.provisorio && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                  ⚠️ RECORTE PROVISÓRIO — montado por script para teste. Não é decisão do RH:
                  refaça o público antes de abrir o ciclo.
                </p>
              )}
              <ul className="text-xs text-slate-500">
                {aplicacao.publico.origens.map((o, i) => (
                  <li key={i}>
                    {o.pessoas} por {o.origem.toLowerCase().replace('_', ' ')}
                    {o.referencia ? ` — ${o.referencia}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BarraDeComposicao({ fatias }: { fatias: { nome: string; pct: number }[] }) {
  if (fatias.length === 0) return null;
  const cores = ['bg-capul-600', 'bg-sky-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500'];
  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {fatias.map((f, i) => (
          <div key={f.nome} className={cores[i % cores.length]} style={{ width: `${f.pct}%` }} />
        ))}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        {fatias.map((f, i) => (
          <li key={f.nome} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${cores[i % cores.length]}`} aria-hidden />
            {f.nome} <strong className="font-semibold">{f.pct.toFixed(1).replace('.', ',')}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DialogoNovaAplicacao({
  cicloId,
  aoFechar,
  aoCriar,
}: {
  cicloId: string;
  aoFechar: () => void;
  aoCriar: () => Promise<void>;
}) {
  const [modelos, setModelos] = useState<ModeloDoCatalogo[] | null>(null);
  const [criterios, setCriterios] = useState<CriterioDoCatalogo[] | null>(null);
  const [centros, setCentros] = useState<CentroCustoDoCatalogo[] | null>(null);

  const [nome, setNome] = useState('');
  const [versaoId, setVersaoId] = useState('');
  const [pesoAvaliacao, setPeso] = useState(60);
  const [pesosCriterio, setPesos] = useState<Record<string, number>>({});
  const [ccEscolhidos, setCc] = useState<Set<string>>(new Set());
  const [filtroCc, setFiltroCc] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    Promise.all([catalogo.modelos(), catalogo.criterios(), catalogo.centrosCusto()])
      .then(([m, c, cc]) => {
        setModelos(m);
        setCriterios(c);
        setCentros(cc);
      })
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível carregar o catálogo.')));
  }, []);

  const versoes = useMemo(
    () =>
      (modelos ?? []).flatMap((m) =>
        m.versoes
          // Versão não publicada não é instrumento — é rascunho de quem monta.
          .filter((v) => v.publicadoEm)
          .map((v) => ({ ...v, modeloNome: m.nome, finalidade: m.finalidade, ativo: m.ativo })),
      ),
    [modelos],
  );

  const fatias = repartir(
    pesoAvaliacao,
    Object.entries(pesosCriterio)
      .filter(([, p]) => p > 0)
      .map(([id, p]) => ({ nome: criterios?.find((c) => c.id === id)?.nome ?? id, peso: p })),
  );

  const centrosFiltrados = (centros ?? []).filter((c) => {
    const alvo = `${c.centroCusto} ${c.descricao ?? ''} ${c.filial}`.toLowerCase();
    return alvo.includes(filtroCc.trim().toLowerCase());
  });
  const pessoasNoPublico = (centros ?? [])
    .filter((c) => ccEscolhidos.has(chave(c)))
    .reduce((s, c) => s + c.pessoas, 0);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await apiAplicacoes.criar({
        cicloId,
        modeloVersaoId: versaoId,
        nome: nome.trim(),
        pesoAvaliacao,
        criterios: Object.entries(pesosCriterio)
          .filter(([, p]) => p > 0)
          .map(([criterioId, peso], i) => ({ criterioId, peso, ordem: i })),
        centrosCusto: (centros ?? [])
          .filter((c) => ccEscolhidos.has(chave(c)))
          .map((c) => ({ filial: c.filial, centroCusto: c.centroCusto })),
      });
      await aoCriar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível criar a aplicação.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="titulo-nova-aplicacao"
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h3 id="titulo-nova-aplicacao" className="text-lg font-semibold text-slate-800">
          Nova aplicação
        </h3>

        {!modelos && !erro && (
          <div className="mt-4">
            <Carregando linhas={2} />
          </div>
        )}

        {modelos && (
          <div className="mt-4 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nome</span>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Operacional — lojas"
                className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Questionário</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Só versões publicadas. Modelo de DEMONSTRAÇÃO não abre ciclo válido.
              </span>
              <select
                value={versaoId}
                onChange={(e) => setVersaoId(e.target.value)}
                className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              >
                <option value="">Escolha…</option>
                {versoes.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.modeloNome} · v{v.versao} · {v.perguntas} perguntas
                    {v.finalidade === 'DEMONSTRACAO' ? ' (DEMONSTRAÇÃO)' : ''}
                  </option>
                ))}
              </select>
              {versoes.length === 0 && (
                <span className="mt-1.5 block text-sm text-amber-700">
                  Nenhuma versão publicada no catálogo. Publique um modelo antes de montar a aplicação.
                </span>
              )}
            </label>

            <div>
              <p className="text-sm font-medium text-slate-700">Composição da nota</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Pesos são números livres, não porcentagens — a divisão real aparece na barra.
              </p>

              <div className="mt-3 flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="w-28 shrink-0">Questionário</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={pesoAvaliacao}
                    onChange={(e) => setPeso(Number(e.target.value))}
                    className="alvo-toque w-24 rounded-xl border border-slate-300 px-3 text-slate-800"
                  />
                </label>
              </div>

              <ul className="mt-2 space-y-2">
                {(criterios ?? []).map((c) => (
                  <li key={c.id} className="flex items-start gap-3">
                    <label className="flex flex-1 items-center gap-2 text-sm text-slate-700">
                      <span className="w-28 shrink-0 truncate" title={c.nome}>
                        {c.nome}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={!c.utilizavel}
                        value={pesosCriterio[c.id] ?? 0}
                        onChange={(e) => setPesos({ ...pesosCriterio, [c.id]: Number(e.target.value) })}
                        className="alvo-toque w-24 rounded-xl border border-slate-300 px-3 text-slate-800 disabled:bg-slate-100"
                      />
                    </label>
                    {!c.utilizavel && (
                      <span className="flex-1 text-xs text-amber-800">
                        <AlertTriangle size={12} className="mr-1 inline" aria-hidden />
                        {c.motivoIndisponivel}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <BarraDeComposicao fatias={fatias} />
              {pesoAvaliacao <= 0 && (
                <p className="mt-2 text-sm text-amber-800">
                  O peso do questionário precisa ser maior que zero — sem ele a avaliação não conta na
                  própria nota.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-slate-700">Público (centros de custo)</p>
                <p className="text-xs text-slate-500">
                  <Users size={12} className="mr-1 inline" aria-hidden />
                  {pessoasNoPublico} pessoa(s) selecionada(s)
                </p>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Deixar vazio faz a lista de designação trazer todo mundo — útil para uma aplicação única,
                arriscado quando há mais de uma.
              </p>
              <input
                value={filtroCc}
                onChange={(e) => setFiltroCc(e.target.value)}
                placeholder="Filtrar por código, descrição ou filial"
                className="alvo-toque mt-2 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
                {centrosFiltrados.map((c) => {
                  const k = chave(c);
                  return (
                    <li key={k}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={ccEscolhidos.has(k)}
                          onChange={(e) => {
                            const proximo = new Set(ccEscolhidos);
                            if (e.target.checked) proximo.add(k);
                            else proximo.delete(k);
                            setCc(proximo);
                          }}
                          className="size-4 accent-capul-600"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          <strong className="font-medium">{c.centroCusto}</strong>
                          {/* Sem descrição não vira "(sem descrição)" repetido 82
                              vezes — ruído que empurra o dado útil para fora da
                              linha. O código e a filial já identificam. */}
                          {c.descricao ? ` ${c.descricao}` : ''}
                          <span className="text-slate-400"> · filial {c.filial}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">{c.pessoas}</span>
                      </label>
                    </li>
                  );
                })}
                {centrosFiltrados.length === 0 && (
                  <li className="px-2 py-3 text-center text-sm text-slate-500">Nada encontrado.</li>
                )}
              </ul>
            </div>

            {erro && <Erro mensagem={erro} />}
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
            disabled={salvando || !nome.trim() || !versaoId || pesoAvaliacao <= 0}
            onClick={salvar}
            className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Criando…' : 'Criar aplicação'}
          </button>
        </div>
      </div>
    </div>
  );
}

function chave(c: CentroCustoDoCatalogo) {
  return `${c.filial}|${c.centroCusto}`;
}
