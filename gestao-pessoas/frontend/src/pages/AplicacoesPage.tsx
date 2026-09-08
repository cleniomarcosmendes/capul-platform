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
  publicoDaAplicacao,
  type AlvoDoPublico,
  type AplicacaoDoCiclo,
  type CentroCustoDoCatalogo,
  type CriterioDoCatalogo,
  type ModeloDoCatalogo,
  type PessoaDoPublico,
  type PreviaDoPublico,
} from '../services/api';
import type { ContextoDoCiclo } from './CicloPage';
import { motivoCicloEncerrado } from '../lib/ciclo-encerrado';

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
  const { ciclo, recarregarResumo } = useOutletContext<ContextoDoCiclo>();
  /** `null` = o ciclo aceita escrita. Ver `lib/ciclo-encerrado.ts`. */
  const fechado = motivoCicloEncerrado(ciclo);
  const { tem } = useAuth();
  const [lista, setLista] = useState<AplicacaoDoCiclo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  const montavel = ciclo.status === 'RASCUNHO' && tem(ROLES.RH_ADMIN, ROLES.RH_CICLO);

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciclo.id]);

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

      {/* ⚠️ O aviso falava de CRIAR aplicação, mas ficava logo acima dos botões
          "Montar público" — que continuam funcionando, e devem: acrescentar
          alguém ao público de um ciclo aberto é operação legítima (a pessoa
          entra, é designada e responde). Aviso que descreve uma proibição
          diferente da do controle ao lado ensina a ignorar o aviso. */}
      {ciclo.status !== 'RASCUNHO' && (
        <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
          O ciclo está {ciclo.status.replace('_', ' ')} — <strong>criar</strong> aplicação e mudar peso
          só enquanto ele é RASCUNHO; mudança de peso depois da abertura é reapuração, não
          remontagem. <strong>Montar público continua valendo:</strong> quem entrar agora precisa ser
          designado para gerar avaliação.
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
              <CartaoDeAplicacao aplicacao={a} fechado={fechado} aoMudarPublico={gravou} />
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
            await gravou();
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

function CartaoDeAplicacao({
  fechado,
  aplicacao,
  aoMudarPublico,
}: {
  /** Motivo de o ciclo não aceitar escrita — `null` quando aceita. */
  fechado: string | null;
  aplicacao: AplicacaoDoCiclo;
  aoMudarPublico: () => Promise<void> | void;
}) {
  const [editandoPublico, setEditandoPublico] = useState(false);
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
                  ⚠️ RECORTE PROVISÓRIO — recorte de trabalho, não decisão do RH.
                  Precisa da confirmação dele antes da produção.
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
          <button
            type="button"
            onClick={() => setEditandoPublico((v) => !v)}
            aria-expanded={editandoPublico}
            // ⚠️ Desabilitado COM O MOTIVO, nunca escondido — ver
            // `lib/ciclo-encerrado.ts`.
            disabled={!!fechado}
            title={fechado ?? undefined}
            className="alvo-toque mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            <Users size={14} aria-hidden />
            {editandoPublico ? 'Fechar' : 'Montar público'}
          </button>
        </div>
      </div>

      {editandoPublico && (
        <EditorDePublico aplicacao={aplicacao} aoMudar={aoMudarPublico} />
      )}
    </div>
  );
}

/**
 * ⭐ CENTRO DE CUSTO E FILIAL SÃO ATALHOS DE PREENCHIMENTO.
 *
 * Escolhe o recorte → o sistema traz as pessoas → ajusta → salva a lista
 * resultante. O que fica gravado é sempre nominal; o recorte sobrevive em
 * `origem` + `origemReferencia`, para o painel explicar de onde a linha veio.
 *
 * ⚠️ A prévia vem antes do salvar por causa de `@@unique([ciclo, colaborador])`:
 * ninguém fica em duas aplicações do mesmo ciclo. Sem ela, escolher um centro
 * de custo que se sobrepõe a outro público falharia no INSERT, com o erro do
 * banco e sem dizer de quem se trata.
 */
function EditorDePublico({
  aplicacao,
  aoMudar,
}: {
  aplicacao: AplicacaoDoCiclo;
  aoMudar: () => Promise<void> | void;
}) {
  const [centros, setCentros] = useState<CentroCustoDoCatalogo[] | null>(null);
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');
  const [previa, setPrevia] = useState<PreviaDoPublico | null>(null);
  /**
   * ⭐⭐ DE QUAL SELEÇÃO esta prévia é.
   *
   * A prévia era um retrato que não sabia de quando: mudar os centros de custo
   * deixava na tela os nomes e a contagem ANTIGOS, com o botão de aplicar vivo —
   * e o clique gravava pela seleção NOVA. O que se conferia e o que se gravava
   * eram coisas diferentes, sem nada avisar.
   */
  const [previaDe, setPreviaDe] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<PessoaDoPublico[] | null>(null);
  const [provisorio, setProvisorio] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    catalogo.centrosCusto().then(setCentros).catch(() => setCentros([]));
    void recarregarPessoas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacao.id]);

  async function recarregarPessoas() {
    setPessoas(await publicoDaAplicacao.listar(aplicacao.id));
  }

  const alvo = (): AlvoDoPublico => {
    const lista = [...escolhidos].map((chave) => {
      const [filial, centroCusto] = chave.split('|');
      return { filial, centroCusto };
    });
    return {
      origem: 'CENTRO_CUSTO',
      referencia: lista.length === 1 ? `${lista[0].filial}|${lista[0].centroCusto}` : `${lista.length} centros de custo`,
      centrosCusto: lista,
      provisorio,
    };
  };

  async function verPrevia() {
    setOcupado(true); setErro(null); setMsg(null);
    try {
      setPrevia(await publicoDaAplicacao.previa(aplicacao.id, alvo()));
      setPreviaDe(chaveDaSelecao);
    } catch (e) {
      setPrevia(null);
      setPreviaDe(null);
      setErro(mensagemDoErro(e, 'Não foi possível calcular.'));
    } finally {
      setOcupado(false);
    }
  }

  async function adicionar() {
    setOcupado(true); setErro(null);
    try {
      const r = await publicoDaAplicacao.adicionar(aplicacao.id, alvo());
      setMsg(`${r.adicionadas} pessoa(s) adicionadas ao público.`);
      setPrevia(null);
      setPreviaDe(null);
      setEscolhidos(new Set());
      await recarregarPessoas();
      await aoMudar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível adicionar.'));
    } finally {
      setOcupado(false);
    }
  }

  async function remover(colaboradorId: string, nome: string) {
    setOcupado(true); setErro(null);
    try {
      await publicoDaAplicacao.remover(aplicacao.id, colaboradorId);
      setMsg(`${nome} saiu do público.`);
      await recarregarPessoas();
      await aoMudar();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  /** Identidade da seleção — é o que diz se a prévia na tela ainda vale. */
  const chaveDaSelecao = [...escolhidos].sort().join(',');
  const previaVelha = previa !== null && previaDe !== chaveDaSelecao;
  /**
   * ⚠️ Soma das pessoas dos CCs escolhidos — é ESTIMATIVA, não "quem entra":
   * não desconta quem já está aqui nem quem está em outra aplicação. Por isso
   * aparece como "pessoas neles", e o número de quem entra só sai na prévia.
   */
  const pessoasNosCentros = (centros ?? [])
    .filter((c) => escolhidos.has(`${c.filial}|${c.centroCusto}`))
    .reduce((soma, c) => soma + c.pessoas, 0);

  const filtrados = (centros ?? []).filter((c) => {
    const alvoTexto = `${c.centroCusto} ${c.descricao ?? ''} ${c.filial}`.toLowerCase();
    return busca.trim() === '' || alvoTexto.includes(busca.trim().toLowerCase());
  });

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Trazer pessoas por centro de custo</p>
        <p className="text-xs text-slate-500">
          O recorte é um <strong>atalho</strong>: o que fica gravado é a lista de pessoas, e
          você pode tirar quem não deveria entrar.
        </p>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar centro de custo"
          aria-label="Filtrar centro de custo"
          className="alvo-toque mt-2 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
        />
        <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
          {centros === null ? (
            <p className="p-3 text-sm text-slate-500">Carregando…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtrados.map((c) => {
                const chave = `${c.filial}|${c.centroCusto}`;
                return (
                  <li key={chave}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={escolhidos.has(chave)}
                        onChange={() =>
                          setEscolhidos((s) => {
                            const n = new Set(s);
                            if (n.has(chave)) n.delete(chave);
                            else n.add(chave);
                            return n;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <strong className="font-medium">{c.centroCusto}</strong>{' '}
                        <span className="text-slate-500">{c.descricao ?? ''}</span>
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        filial {c.filial} · {c.pessoas}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={provisorio}
          disabled={ocupado}
          onChange={(e) => setProvisorio(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Recorte provisório
          <span className="block text-xs text-slate-500">
            Marcado, o público entra como recorte de trabalho e o cartão avisa. Desmarque só
            quando este for o público que o RH confirmou.
          </span>
        </span>
      </label>

      {/* ⚠️ O (N) do botão contava CENTROS DE CUSTO, e o rótulo "o que vai
          entrar" faz qualquer um ler GENTE — "Ver o que vai entrar (3)" com 87
          pessoas atrás. Agora o botão não carrega número, e a conta da seleção
          fica ao lado dele, dizendo o que cada número é. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled={ocupado || escolhidos.size === 0}
          onClick={() => void verPrevia()}
          className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          Ver o que vai entrar
        </button>
        {escolhidos.size > 0 && (
          <p className="text-sm text-slate-600">
            <strong className="tabular-nums">{escolhidos.size}</strong> centro(s) de custo ·{' '}
            <strong className="tabular-nums">{pessoasNosCentros}</strong> pessoa(s) neles
          </p>
        )}
      </div>

      {erro && <Erro mensagem={erro} />}
      {msg && (
        <p className="rounded-xl border border-capul-200 bg-capul-50 px-3 py-2 text-sm text-capul-900">
          {msg}
        </p>
      )}

      {previa && (
        <div
          className={`space-y-2 rounded-xl border-2 p-3 ${
            previaVelha ? 'border-amber-300 bg-amber-50/40' : 'border-capul-300'
          }`}
        >
          {/* ⭐ A prévia envelhece com a seleção — e diz isso, em vez de sumir.
              Sumir esconderia que ela existiu; ficar calada era pior ainda. */}
          {previaVelha && (
            <p className="rounded-lg bg-amber-100 px-2 py-1.5 text-xs font-medium text-amber-900">
              A seleção mudou depois desta prévia. Os números abaixo são do recorte anterior —
              clique em <strong>Ver o que vai entrar</strong> para recalcular.
            </p>
          )}
          {/* ⚠️ DUAS PERGUNTAS, DOIS NÚMEROS. "N pessoa(s) entram" sempre esteve
              CERTO sobre o público — e era lido como "N vão ser avaliadas".
              Entrar no público e gerar avaliação são coisas diferentes: a régua
              do ciclo pode barrar quem entrou (afastado na data-base, por
              exemplo). Misturar as duas num número só é o mesmo erro do painel
              do lote (§3.1.20): responder uma pergunta e escrever sobre a outra. */}
          <p className={`text-sm ${previaVelha ? 'text-slate-500' : 'text-slate-700'}`}>
            <strong
              className={`tabular-nums text-lg ${previaVelha ? 'text-slate-500' : 'text-capul-700'}`}
            >
              {previa.adicionar}
            </strong>{' '}
            pessoa(s) entram no público · {previa.jaNesta} já estão aqui ·{' '}
            {previa.encontradas} no recorte
          </p>
          {!previaVelha && previa.adicionar > 0 && (
            <p
              className={`text-sm ${
                previa.barradosPelaRegua.length > 0 ? 'text-amber-900' : 'text-slate-600'
              }`}
            >
              <strong className="tabular-nums">{previa.geramAvaliacao}</strong> destas geram
              avaliação
              {previa.barradosPelaRegua.length > 0 &&
                ` — ${previa.barradosPelaRegua.length} não gera(m), pela régua do ciclo`}
              .
            </p>
          )}

          {/* ⭐ Os NOMES de quem é barrado, com o motivo da régua — a mesma
              frase que a Designação mostra. Ela existia lá e só chegava DEPOIS
              de gravar, que é tarde para quem está montando o recorte. */}
          {!previaVelha && previa.barradosPelaRegua.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">
                Entram no público e NÃO geram avaliação — ficam na lista de Designação, marcadas
                com o motivo:
              </p>
              <ul className="mt-1 space-y-0.5">
                {previa.barradosPelaRegua.slice(0, 8).map((b) => (
                  <li key={b.colaboradorId}>
                    <strong>{b.nome}</strong> ({b.matricula}) — {b.justificativa}
                  </li>
                ))}
                {previa.barradosPelaRegua.length > 8 && (
                  <li>… e mais {previa.barradosPelaRegua.length - 8}</li>
                )}
              </ul>
            </div>
          )}

          {/* ⭐⭐ OS NOMES. `amostra` vinha do backend desde sempre e a tela
              mostrava só números (§3.1.9) — e é a tela em que o número já
              enganava. Ver dez nomes é o que denuncia o recorte errado antes de
              gravar; contagem certa de gente errada continua parecendo certa. */}
          {!previaVelha && previa.amostra.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600">
              <p className="font-medium text-slate-700">
                Quem entra {previa.amostra.length < previa.adicionar
                  ? `(os ${previa.amostra.length} primeiros de ${previa.adicionar})`
                  : ''}
              </p>
              <ul className="mt-1 space-y-0.5">
                {previa.amostra.map((a) => (
                  <li key={a.matricula} className="truncate">
                    {a.nome} <span className="text-slate-400">· {a.matricula}</span>
                    {a.area && <span className="text-slate-500"> · {a.area}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {previa.emOutraAplicacao.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">
                ⚠️ {previa.emOutraAplicacao.length} já estão em OUTRA aplicação e não entram —
                ninguém responde dois questionários no mesmo ciclo:
              </p>
              {/* ⚠️ O mesmo corte de 8 do bloco de cima — que TEM indicador.
                  Este não tinha: alguém acertou um e esqueceu o irmão, e a lista
                  passava a mentir a partir da nona pessoa. */}
              <ul className="mt-1">
                {previa.emOutraAplicacao.slice(0, 8).map((p) => (
                  <li key={p.colaboradorId}>
                    {p.nome} ({p.matricula}) — está em <strong>{p.aplicacao}</strong>
                  </li>
                ))}
                {previa.emOutraAplicacao.length > 8 && (
                  <li>… e mais {previa.emOutraAplicacao.length - 8}</li>
                )}
              </ul>
            </div>
          )}
          <button
            type="button"
            disabled={ocupado || previa.adicionar === 0 || previaVelha}
            onClick={() => void adicionar()}
            className="alvo-toque w-full rounded-xl bg-capul-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {previaVelha
              ? 'Recalcule antes de adicionar'
              : previa.adicionar === 0
                ? 'Nada a adicionar'
                : `Adicionar ${previa.adicionar} ao público`}
          </button>
        </div>
      )}

      {pessoas && pessoas.length > 0 && (
        <details className="rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            Quem está no público ({pessoas.length})
          </summary>
          <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {pessoas.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {p.nome} <span className="text-slate-400">· {p.matricula}</span>
                  {p.area && <span className="text-slate-500"> · {p.area}</span>}
                </span>
                {/* A própria linha aparece marcada, nunca some: sumir faria o
                    total do público não bater com o da designação. */}
                {p.restrita && <Etiqueta tom="azul">você</Etiqueta>}
                {p.provisorio && <Etiqueta tom="ambar">provisório</Etiqueta>}
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void remover(p.colaboradorId, p.nome)}
                  className="alvo-toque shrink-0 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700 disabled:opacity-50"
                >
                  Tirar
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
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

  const [nome, setNome] = useState('');
  const [versaoId, setVersaoId] = useState('');
  const [pesoAvaliacao, setPeso] = useState(60);
  const [pesosCriterio, setPesos] = useState<Record<string, number>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // ⚠️ Sem `centrosCusto` aqui desde 08/09: o modal não monta mais público —
    // quem monta é o "Montar público" do cartão, com prévia.
    Promise.all([catalogo.modelos(), catalogo.criterios()])
      .then(([m, c]) => {
        setModelos(m);
        setCriterios(c);
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

            {/* ⭐⭐ O SELETOR DE CENTROS DE CUSTO SAIU DAQUI (08/09).
                Ele contava "3 pessoa(s) selecionada(s)" ao vivo e a aplicação
                nascia com público VAZIO: a seleção ia para `aplicacao_centro_custo`,
                que desde a virada para público NOMINAL (06/09) é só registro do
                atalho e não põe ninguém em lugar nenhum. Contador que promete
                gente que não entra é pior que campo nenhum.

                Não virou "gravar de verdade" de propósito: o caminho que grava é
                o "Montar público", que tem PRÉVIA, amostra de nomes e o aviso de
                quem já está em outra aplicação do ciclo. Criar aplicação e
                adicionar 87 pessoas num clique, sem nada disso, recriaria aqui o
                defeito que a prévia acabou de resolver do outro lado (§3.1.10). */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Público: o próximo passo</p>
              <p className="mt-0.5 text-sm text-slate-600">
                A aplicação nasce <strong>sem público</strong>. Depois de criar, use{' '}
                <strong>Montar público</strong> no cartão dela — lá dá para ver quem entra antes de
                gravar, e o sistema avisa quem já está em outra aplicação deste ciclo.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                ⚠️ Aplicação sem público não gera avaliação nenhuma, e o ciclo não abre enquanto
                houver uma assim.
              </p>
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

