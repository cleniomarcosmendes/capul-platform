import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileUp, Plus, ShieldQuestion,
  Undo2, UserCheck, UserPlus, UserX,
} from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { Modal } from '../components/Modal';
import { SeletorDeColaborador } from '../components/SeletorDeColaborador';
import { AvisoDosCiclos, AvisoDosCiclosEmLote } from '../components/AvisoDosCiclos';
import {
  cadastroAvaliadores, mensagemDoErro,
  type CartaoDeAvaliador, type ColaboradorDaBusca, type LinhaDaLista, type LoteDeImportacao,
  type PendenciasDoCadastro, type PreviaDaImportacao, type SituacaoNoCiclo, type VinculoCriado,
} from '../services/api';

/**
 * CADASTRO DE QUEM AVALIA QUEM.
 *
 * ⭐ A PENDÊNCIA REVERSA É A TELA, não uma segunda aba. Quem abre precisa ver o
 * que FALTA — quem não está na lista de ninguém — e não a lista do que já
 * existe. Quem não tem avaliador não gera avaliação, não aparece em status
 * nenhum e sai do ciclo sem erro: é a única pendência que some sozinha. A lista
 * completa responde "como está"; esta responde "o que fazer agora".
 *
 * ⭐ A pendência vem AGRUPADA por filial × centro de custo, maior primeiro,
 * porque é assim que se resolve: nomeando o responsável de um grupo inteiro. Um
 * centro de custo com 61 pessoas é uma decisão; 61 linhas soltas são 61.
 */

type Aba = 'pendencias' | 'avaliadores' | 'importacao';

export default function CadastroAvaliadoresPage() {
  const [aba, setAba] = useState<Aba>('pendencias');
  const [pendencias, setPendencias] = useState<PendenciasDoCadastro | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setPendencias(await cadastroAvaliadores.pendencias());
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível carregar o cadastro.'));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erro) return <div className="p-4"><Erro mensagem={erro} aoTentarDeNovo={carregar} /></div>;
  if (!pendencias) return <div className="p-4"><Carregando linhas={4} /></div>;

  return (
    <div className="space-y-4 p-4">
      <Resumo p={pendencias} />

      <nav className="flex gap-1 border-b border-slate-200" aria-label="Visões do cadastro">
        <AbaBotao atual={aba} valor="pendencias" ao={setAba}>
          O que falta{pendencias.semAvaliador.total > 0 && ` (${pendencias.semAvaliador.total})`}
        </AbaBotao>
        <AbaBotao atual={aba} valor="avaliadores" ao={setAba}>Por avaliador</AbaBotao>
        <AbaBotao atual={aba} valor="importacao" ao={setAba}>Importar planilha</AbaBotao>
      </nav>

      {aba === 'pendencias' && <SemAvaliador p={pendencias} aoMudar={carregar} />}
      {aba === 'avaliadores' && <PorAvaliador aoMudar={carregar} />}
      {aba === 'importacao' && <Importacao aoImportar={carregar} />}
    </div>
  );
}

function AbaBotao({
  atual, valor, ao, children,
}: { atual: Aba; valor: Aba; ao: (a: Aba) => void; children: React.ReactNode }) {
  const ativa = atual === valor;
  return (
    <button
      type="button"
      onClick={() => ao(valor)}
      aria-current={ativa ? 'page' : undefined}
      className={`alvo-toque -mb-px whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
        ativa ? 'border-capul-600 text-capul-700' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

/** Os dois números que decidem o que fazer, antes de qualquer lista. */
function Resumo({ p }: { p: PendenciasDoCadastro }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <Cartao
        tom={p.semAvaliador.total > 0 ? 'alerta' : 'ok'}
        icone={p.semAvaliador.total > 0 ? <UserX size={18} /> : <CheckCircle2 size={18} />}
        numero={p.semAvaliador.total}
        rotulo="sem avaliador no cadastro"
        detalhe={
          p.semAvaliador.total > 0
            ? 'Elegíveis de TODA a empresa que não estão na lista de ninguém. O painel de cada ciclo tem o número dele, e os dois universos não se contêm.'
            : 'Todo mundo elegível está na lista de alguém.'
        }
      />
      <Cartao
        tom={p.naoRevisadas.total > 0 ? 'atencao' : 'ok'}
        icone={<ShieldQuestion size={18} />}
        numero={p.naoRevisadas.total}
        rotulo="não revisadas"
        detalhe="Divididas em ordem alfabética pela importação — ninguém olhou ainda."
      />
      <Cartao
        tom="neutro"
        icone={<UserCheck size={18} />}
        numero={p.totais.comAvaliador}
        rotulo={`de ${p.totais.elegiveis} com avaliador`}
        detalhe={`${p.totais.avaliadores} pessoas avaliam${
          p.totais.provisorias > 0 ? ` · ${p.totais.provisorias} linhas provisórias` : ''
        }`}
      />
    </section>
  );
}

function Cartao({
  tom, icone, numero, rotulo, detalhe,
}: {
  tom: 'ok' | 'alerta' | 'atencao' | 'neutro';
  icone: React.ReactNode; numero: number; rotulo: string; detalhe: string;
}) {
  const cores = {
    ok: 'border-capul-200 bg-capul-50 text-capul-800',
    alerta: 'border-red-200 bg-red-50 text-red-900',
    atencao: 'border-amber-200 bg-amber-50 text-amber-900',
    neutro: 'border-slate-200 bg-white text-slate-800',
  }[tom];
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cores}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icone}
        <span className="tabular-nums text-2xl font-semibold">{numero}</span>
        <span>{rotulo}</span>
      </div>
      <p className="mt-1 text-xs opacity-80">{detalhe}</p>
    </div>
  );
}

// ── O que falta ─────────────────────────────────────────────────────────────

function SemAvaliador({ p, aoMudar }: { p: PendenciasDoCadastro; aoMudar: () => Promise<void> }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  /** Quem vai receber avaliador — o grupo inteiro ou uma pessoa da lista. */
  const [alvo, setAlvo] = useState<{ titulo: string; pessoas: PessoaDoVinculo[] } | null>(null);
  if (p.semAvaliador.total === 0) {
    return (
      <Vazio
        titulo="Ninguém ficou de fora"
        detalhe="Todo colaborador elegível está na lista de algum avaliador. Quando alguém for admitido ou trocar de área, ele aparece aqui."
      />
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        Agrupado por filial e centro de custo, o maior primeiro — nomear o responsável de um
        grupo resolve o grupo inteiro.
      </p>
      {alvo && (
        <DialogoDeVinculo
          titulo={alvo.titulo}
          escolher="AVALIADOR"
          pessoas={alvo.pessoas}
          aoFechar={() => setAlvo(null)}
          aoConcluir={aoMudar}
        />
      )}
      {p.semAvaliador.grupos.map((g) => {
        const aberto = abertos.has(g.chave);
        return (
          <div key={g.chave} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() =>
                setAbertos((s) => {
                  const n = new Set(s);
                  if (n.has(g.chave)) n.delete(g.chave);
                  else n.add(g.chave);
                  return n;
                })
              }
              aria-expanded={aberto}
              className="alvo-toque flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              {aberto ? <ChevronDown size={16} className="shrink-0 text-slate-400" />
                      : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-800">
                  {g.descricao ?? '(sem descrição)'}
                </p>
                <p className="truncate text-xs text-slate-500">{g.chave}</p>
              </div>
              <Etiqueta tom={g.pessoas.length >= 10 ? 'vermelho' : 'ambar'}>
                {g.pessoas.length} {g.pessoas.length === 1 ? 'pessoa' : 'pessoas'}
              </Etiqueta>
            </button>
            {/* ⚠️ FORA do botão que expande: botão dentro de botão é HTML
                inválido, e no celular o toque cairia no errado. */}
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                type="button"
                onClick={() =>
                  setAlvo({
                    titulo: `Definir avaliador de ${g.pessoas.length} pessoa(s) — ${g.descricao ?? g.chave}`,
                    pessoas: g.pessoas.map((x) => ({ colaboradorId: x.colaboradorId, nome: x.nome })),
                  })
                }
                className="alvo-toque inline-flex items-center gap-1.5 rounded-lg border border-capul-600 px-3 text-sm font-medium text-capul-700 hover:bg-capul-50"
              >
                <UserPlus size={15} aria-hidden />
                Definir avaliador · {g.pessoas.length} pessoa(s)
              </button>
            </div>
            {aberto && (
              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {g.pessoas.map((pessoa) => (
                  <li
                    key={pessoa.colaboradorId}
                    className="flex items-center gap-2 px-4 py-2 pl-11 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium text-slate-700">{pessoa.nome}</span>
                      <span className="text-slate-400"> · {pessoa.matricula}</span>
                      {pessoa.cargo && <span className="text-slate-500"> · {pessoa.cargo}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAlvo({
                          titulo: `Definir avaliador de ${pessoa.nome}`,
                          pessoas: [{ colaboradorId: pessoa.colaboradorId, nome: pessoa.nome }],
                        })
                      }
                      className="alvo-toque shrink-0 rounded-lg px-2 text-xs font-medium text-capul-700 hover:bg-capul-50"
                    >
                      Definir avaliador
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Por avaliador ───────────────────────────────────────────────────────────

function PorAvaliador({ aoMudar }: { aoMudar: () => Promise<void> }) {
  const [cartoes, setCartoes] = useState<CartaoDeAvaliador[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setCartoes(await cadastroAvaliadores.avaliadores());
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  if (erro) return <Erro mensagem={erro} aoTentarDeNovo={carregar} />;
  if (!cartoes) return <Carregando linhas={4} />;
  if (cartoes.length === 0) {
    return <Vazio titulo="Nenhum avaliador cadastrado" detalhe="Importe a planilha do RH para começar." />;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        Quem tem linhas <strong>não revisadas</strong> vem primeiro: são as que a importação
        dividiu em ordem alfabética e ninguém conferiu.
      </p>
      {cartoes.map((c) => (
        <div key={c.avaliadorId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setAberto((a) => (a === c.avaliadorId ? null : c.avaliadorId))}
            aria-expanded={aberto === c.avaliadorId}
            className="alvo-toque flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
          >
            {aberto === c.avaliadorId ? <ChevronDown size={16} className="shrink-0 text-slate-400" />
                                      : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-800">{c.nome}</p>
              <p className="truncate text-xs text-slate-500">
                {c.matricula} · filial {c.filial}
                {c.area ? ` · ${c.area}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {c.naoRevisadas > 0 && <Etiqueta tom="ambar">{c.naoRevisadas} a revisar</Etiqueta>}
              <Etiqueta>{c.total} avalia</Etiqueta>
            </div>
          </button>
          {aberto === c.avaliadorId && (
            <ListaDoAvaliador
              avaliadorId={c.avaliadorId}
              nomeDoAvaliador={c.nome}
              aoMudar={async () => { await carregar(); await aoMudar(); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ListaDoAvaliador({
  avaliadorId, nomeDoAvaliador, aoMudar,
}: { avaliadorId: string; nomeDoAvaliador: string; aoMudar: () => Promise<void> }) {
  const [linhas, setLinhas] = useState<LinhaDaLista[] | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLinhas(await cadastroAvaliadores.listaDe(avaliadorId));
  }, [avaliadorId]);
  useEffect(() => { void carregar(); }, [carregar]);

  if (!linhas) return <div className="border-t border-slate-100 p-4"><Carregando linhas={2} /></div>;

  const aRevisar = linhas.filter((l) => l.naoRevisada);

  async function agir(fn: () => Promise<unknown>, sucesso: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await fn();
      setAviso(sucesso);
      await carregar();
      await aoMudar();
    } catch (e) {
      setAviso(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="border-t border-slate-100">
      {adicionando && (
        <DialogoDeVinculo
          titulo={`Adicionar pessoa à lista de ${nomeDoAvaliador}`}
          escolher="AVALIADO"
          avaliadorId={avaliadorId}
          avaliadorNome={nomeDoAvaliador}
          aoFechar={() => setAdicionando(false)}
          aoConcluir={async () => {
            await carregar();
            await aoMudar();
          }}
        />
      )}
      {aRevisar.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            <strong>{aRevisar.length}</strong> linha(s) foram divididas em ordem alfabética pela
            importação. A ordem é arbitrária e não diz quem trabalha com quem —{' '}
            <strong>o motivo de cada uma está escrito na própria linha</strong>.
          </p>
          <button
            type="button"
            disabled={ocupado}
            onClick={() =>
              agir(
                () => cadastroAvaliadores.revisar(aRevisar.map((l) => l.id)),
                `${aRevisar.length} linha(s) marcadas como conferidas.`,
              )
            }
            className="alvo-toque shrink-0 rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 disabled:opacity-50"
          >
            {ocupado ? 'Marcando…' : 'Conferi, está certo'}
          </button>
        </div>
      )}
      {aviso && <p className="bg-slate-50 px-4 py-2 text-sm text-slate-700">{aviso}</p>}
      <div className="px-4 py-2 pl-11">
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="alvo-toque inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Plus size={15} aria-hidden />
          Adicionar pessoa
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {linhas.map((l) => (
          <li key={l.id} className="flex items-start gap-3 px-4 py-2 pl-11 text-sm">
            <div className="min-w-0 flex-1">
              <span className="font-medium text-slate-700">{l.nome}</span>
              <span className="text-slate-400"> · {l.matricula}</span>
              {l.cargo && <span className="text-slate-500"> · {l.cargo}</span>}
              {/* ⭐⭐ A OBSERVAÇÃO DA LINHA — texto que alguém escreveu dizendo
                  POR QUE esta pessoa é deste avaliador. Vinha do backend desde
                  sempre e nenhuma tela a mostrava (§3.1.9). Nas linhas de
                  divisão automática ela diz, com todas as letras, que a alocação
                  foi ARBITRADA em ordem alfabética — e é logo acima do botão
                  "Conferi, está certo". Quem confere estava confirmando um chute
                  sem ver que era um. */}
              {l.observacao && (
                <p className="mt-0.5 text-xs italic leading-snug text-slate-500">
                  “{l.observacao}”
                </p>
              )}
            </div>
            {/* Quem abre a lista de um avaliador pode ser uma das linhas dela —
                é o caso da gestora, avaliada pelo Diretor Executivo. Marca,
                nunca filtra: o total da lista tem de fechar. */}
            {l.restrita && <Etiqueta tom="azul">você</Etiqueta>}
            {l.naoRevisada && <Etiqueta tom="ambar">não revisada</Etiqueta>}
            {l.provisorio && <Etiqueta tom="azul">provisória</Etiqueta>}
            <button
              type="button"
              disabled={ocupado}
              onClick={() => agir(() => cadastroAvaliadores.remover(l.id), `${l.nome} saiu da lista.`)}
              className="alvo-toque shrink-0 rounded-lg px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-700 disabled:opacity-50"
            >
              Tirar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Importação ──────────────────────────────────────────────────────────────

/**
 * ⭐ PRÉ-VISUALIZAÇÃO OBRIGATÓRIA. 82 linhas de planilha viram ~1.000 pares:
 * importar e avisar depois seria pedir para a gestora conferir mil linhas já
 * gravadas. Aqui ela vê o que VAI acontecer, e só então grava — mandando de
 * volta a mesma conferência, para não confirmar um relatório e gravar outro
 * arquivo.
 */
function Importacao({ aoImportar }: { aoImportar: () => Promise<void> }) {
  const [conteudo, setConteudo] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [substituir, setSubstituir] = useState(false);
  const [provisorio, setProvisorio] = useState(true);
  const [previa, setPrevia] = useState<PreviaDaImportacao | null>(null);
  const [lotes, setLotes] = useState<LoteDeImportacao[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const carregarLotes = useCallback(async () => {
    setLotes(await cadastroAvaliadores.importacoes());
  }, []);
  useEffect(() => { void carregarLotes(); }, [carregarLotes]);

  async function escolher(arquivo: File) {
    setErro(null); setMsg(null); setPrevia(null);
    const texto = await arquivo.text();
    setConteudo(texto);
    setNome(arquivo.name);
    await gerarPrevia(texto, substituir);
  }

  async function gerarPrevia(texto: string, comSubstituicao: boolean) {
    setOcupado(true); setErro(null);
    try {
      setPrevia(await cadastroAvaliadores.previa(texto, comSubstituicao));
    } catch (e) {
      setPrevia(null);
      setErro(mensagemDoErro(e, 'Não foi possível ler a planilha.'));
    } finally {
      setOcupado(false);
    }
  }

  async function gravar() {
    if (!conteudo || !previa) return;
    setOcupado(true); setErro(null);
    try {
      const r = await cadastroAvaliadores.importar(conteudo, nome, previa.conferencia, substituir, provisorio);
      setMsg(`Importação gravada: ${r.pares.total} par(es).`);
      setPrevia(null); setConteudo(null); setNome('');
      if (input.current) input.current.value = '';
      await Promise.all([carregarLotes(), aoImportar()]);
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível gravar.'));
    } finally {
      setOcupado(false);
    }
  }

  async function desfazer(lote: LoteDeImportacao) {
    setOcupado(true); setErro(null); setMsg(null);
    try {
      const r = await cadastroAvaliadores.desfazer(lote.id);
      setMsg(
        `${r.encerradas} designação(ões) encerradas` +
          (r.revisadasAMao > 0 ? `, das quais ${r.revisadasAMao} já tinham sido revisadas à mão. ` : '. ') +
          r.aviso,
      );
      await Promise.all([carregarLotes(), aoImportar()]);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="planilha">
          Planilha de avaliadores (.csv)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Uma linha por centro de custo, com a matrícula de quem responde por ele. Para mais de
          um responsável no mesmo centro de custo, repita a linha. Deixar o avaliador em branco
          significa &quot;ainda não decidi&quot; — não é erro.
        </p>
        <input
          ref={input}
          id="planilha"
          type="file"
          accept=".csv,text/csv"
          disabled={ocupado}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void escolher(f); }}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-capul-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {/* ⭐ O padrão é PROVISÓRIO, e o padrão é o seguro: uma lista preenchida
            por quem conhece a estrutura não é a decisão do RH sobre quem avalia
            quem, e a nota tem consequência de mérito. Desmarcar é uma afirmação
            de alguém, não um default. */}
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={provisorio}
            disabled={ocupado}
            onChange={(e) => setProvisorio(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Lista provisória
            <span className="block text-xs text-slate-500">
              Marcada, as linhas entram como <strong>provisórias</strong> e a tela avisa que
              há dado a confirmar. Desmarque só quando esta for a lista que o RH confirmou —
              quem responde por &quot;quem avalia quem&quot; é o RH.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={substituir}
            disabled={ocupado}
            onChange={(e) => {
              setSubstituir(e.target.checked);
              if (conteudo) void gerarPrevia(conteudo, e.target.checked);
            }}
            className="mt-0.5"
          />
          <span>
            Passar por cima do que foi ajustado à mão
            <span className="block text-xs text-slate-500">
              Sem isto, quem já tem designação manual não é tocado — o conflito aparece na prévia
              com os dois nomes, para você decidir.
            </span>
          </span>
        </label>
      </div>

      {erro && <Erro mensagem={erro} />}
      {msg && (
        <p className="rounded-xl border border-capul-200 bg-capul-50 px-4 py-3 text-sm text-capul-900">
          {msg}
        </p>
      )}
      {ocupado && !previa && <Carregando linhas={2} />}
      {previa && <PainelDaPrevia previa={previa} ocupado={ocupado} aoGravar={gravar} />}

      {lotes.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Importações anteriores
          </h3>
          <ul className="divide-y divide-slate-100">
            {lotes.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-700">{l.arquivoNome}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(l.criadoEm).toLocaleString('pt-BR')} · {l.linhasNoArquivo} linha(s) ·{' '}
                    {l.paresGravados} par(es)
                  </p>
                </div>
                {l.desfeitoEm ? (
                  <Etiqueta tom="neutro">
                    desfeita em {new Date(l.desfeitoEm).toLocaleDateString('pt-BR')}
                  </Etiqueta>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => void desfazer(l)}
                    className="alvo-toque inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    <Undo2 size={14} aria-hidden /> Desfazer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PainelDaPrevia({
  previa, ocupado, aoGravar,
}: { previa: PreviaDaImportacao; ocupado: boolean; aoGravar: () => Promise<void> }) {
  const nadaAGravar = previa.pares.total === 0;
  return (
    <section className="space-y-3 rounded-2xl border-2 border-capul-300 bg-white p-4">
      <div className="flex items-center gap-2">
        <FileUp size={18} className="text-capul-700" aria-hidden />
        <h3 className="font-semibold text-slate-800">O que vai acontecer</h3>
        <span className="text-sm text-slate-500">— nada foi gravado ainda</span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="pares a gravar" valor={previa.pares.total} destaque />
        <Numero rotulo="já iguais (não mexe)" valor={previa.pares.inalterados} />
        <Numero rotulo="substituem a atual" valor={previa.pares.substituira} />
        <Numero
          rotulo="por divisão automática"
          valor={previa.pares.porDivisaoAutomatica}
          tom={previa.pares.porDivisaoAutomatica > 0 ? 'ambar' : undefined}
        />
      </dl>
      <p className="text-xs text-slate-500">
        {previa.linhasNoArquivo} linha(s) no arquivo
        {previa.linhasSemAvaliador > 0 && `, ${previa.linhasSemAvaliador} sem avaliador preenchido`}.
      </p>

      {previa.pares.porDivisaoAutomatica > 0 && (
        <Bloco tom="ambar" titulo={`${previa.pares.porDivisaoAutomatica} pares divididos em ordem alfabética`}>
          <p>
            Onde o centro de custo tem mais de um responsável, as pessoas foram repartidas
            igualmente por ordem alfabética. <strong>A ordem é arbitrária</strong> — ela existe
            para não perder o seu preenchimento, e essas linhas ficam marcadas como
            &quot;não revisadas&quot; até você conferir.
          </p>
          <ul className="mt-2 space-y-1">
            {previa.centrosCusto.filter((c) => c.porDivisaoAutomatica).map((c) => (
              <li key={c.chave}>
                <strong>{c.descricao ?? c.chave}</strong> ({c.chave}): {c.pessoas} pessoas →{' '}
                {c.divisao.map((d) => `${d.avaliador} ${d.quantos}`).join(' · ')}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {previa.conflitosComAjusteManual.length > 0 && (
        <Bloco tom="vermelho" titulo={`${previa.conflitosComAjusteManual.length} conflitam com ajuste manual — NÃO serão gravados`}>
          <ul className="space-y-1">
            {previa.conflitosComAjusteManual.map((c) => (
              <li key={c.matricula}>
                <strong>{c.nome}</strong> ({c.matricula}) está com <em>{c.avaliadorAtual}</em>; a
                planilha manda para <em>{c.avaliadorDaPlanilha}</em>.
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Marque &quot;passar por cima do que foi ajustado à mão&quot; se a planilha é que está
            certa.
          </p>
        </Bloco>
      )}

      {previa.recusas.length > 0 && (
        <Bloco tom="vermelho" titulo={`${previa.recusas.length} linha(s) recusadas`}>
          <ul className="space-y-1">
            {previa.recusas.map((r, i) => (
              <li key={`${r.numero}-${i}`}>
                <strong>Linha {r.numero}</strong>: {r.detalhe}
              </li>
            ))}
          </ul>
          <p className="mt-2">O resto do arquivo pode ser importado normalmente.</p>
        </Bloco>
      )}

      {previa.avisos.length > 0 && (
        <Bloco tom="ambar" titulo="Avisos">
          <ul className="space-y-1">{previa.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </Bloco>
      )}

      <button
        type="button"
        disabled={ocupado || nadaAGravar}
        onClick={() => void aoGravar()}
        className="alvo-toque w-full rounded-xl bg-capul-600 px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {ocupado
          ? 'Gravando…'
          : nadaAGravar
            ? 'Nada a gravar — a planilha já está aplicada'
            : `Confirmar e gravar ${previa.pares.total} par(es)`}
      </button>
    </section>
  );
}

function Numero({
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

function Bloco({
  tom, titulo, children,
}: { tom: 'ambar' | 'vermelho'; titulo: string; children: React.ReactNode }) {
  const cores = tom === 'ambar'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-red-200 bg-red-50 text-red-900';
  return (
    <div className={`rounded-xl border p-3 text-sm ${cores}`}>
      <p className="font-medium">{titulo}</p>
      <div className="mt-1 opacity-90">{children}</div>
    </div>
  );
}


// ── Vínculo avaliador → avaliado ────────────────────────────────────────────

export interface PessoaDoVinculo {
  colaboradorId: string;
  nome: string;
}

/**
 * ⭐⭐ A TELA QUE FALTAVA. Até 07/09/2026 o vínculo do cadastro só nascia por
 * PLANILHA: a rota `POST /designacao-padrao` existia no backend e no cliente, e
 * nenhuma página a chamava — capacidade na API sem botão na tela. A gestora
 * entrou procurando "vincular um avaliador" e não achou porque não estava lá.
 *
 * O mesmo diálogo serve aos dois sentidos, porque é o mesmo ato:
 *   • `AVALIADOR` — escolhe quem avalia N pessoas (um grupo, ou uma linha);
 *   • `AVALIADO`  — escolhe mais uma pessoa para a lista de um avaliador.
 *
 * ⚠️ **Não fecha sozinho depois de gravar.** O que ele mostra no fim — o que o
 * vínculo muda em cada ciclo ABERTO — é a metade do trabalho que não cabe num
 * toast: o cadastro não toca ciclo já aberto, e quem não ler isso sai daqui
 * convencido de que resolveu.
 */
function DialogoDeVinculo({
  titulo,
  escolher,
  pessoas,
  avaliadorId,
  avaliadorNome,
  aoFechar,
  aoConcluir,
}: {
  titulo: string;
  escolher: 'AVALIADOR' | 'AVALIADO';
  /** Quando `escolher === 'AVALIADOR'`: quem vai receber o avaliador escolhido. */
  pessoas?: PessoaDoVinculo[];
  /** Quando `escolher === 'AVALIADO'`: a lista de quem recebe a pessoa escolhida. */
  avaliadorId?: string;
  /** Idem — o nome, para o resumo poder dizer quem passa a avaliar. */
  avaliadorNome?: string;
  aoFechar: () => void;
  aoConcluir: () => Promise<void>;
}) {
  const [escolhido, setEscolhido] = useState<ColaboradorDaBusca | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [feitos, setFeitos] = useState<VinculoCriado[] | null>(null);

  const alvos = pessoas ?? [];
  /**
   * ⚠️ Os dois lados TROCAM de papel conforme o modo, e o resumo tem de dizer a
   * verdade nos dois: em `AVALIADOR` quem se escolhe é quem avalia; em
   * `AVALIADO` quem avalia é o dono da lista e quem se escolhe é o avaliado.
   */
  const quemAvalia = escolher === 'AVALIADO' ? (avaliadorNome ?? 'Este avaliador') : escolhido?.nome;

  /**
   * ⭐⭐ QUEM O BOTÃO VAI MESMO GRAVAR — a lista, não o total.
   *
   * A regra "ninguém avalia a si mesmo" existia e só rodava no modo de UMA
   * pessoa (`escolhido.id === alvos[0].colaboradorId`). No grupo ela não era
   * feita: escolher ADELSON para o grupo dele mesmo era aceito, e o modal
   * anunciava as 18 do grupo quando o efeito real eram 17 — erro de 1 no caso
   * que a própria tela recomenda ("nomear o responsável de um grupo resolve o
   * grupo inteiro"), porque o responsável quase sempre está dentro do grupo.
   *
   * A checagem é a MESMA, corrida contra a pertinência ao grupo em vez da
   * identidade com um alvo único. E é UMA lista, usada em três lugares — o
   * resumo, o botão e o `aplicar()` —, para que a tela grave exatamente o que
   * mostrou: um "desconto" só no texto voltaria a divergir do ato na primeira
   * mexida.
   */
  const alvosEfetivos =
    escolhido && escolher === 'AVALIADOR'
      ? alvos.filter((p) => p.colaboradorId !== escolhido.id)
      : alvos;
  /** A pessoa escolhida está dentro do próprio grupo: a linha dela fica de fora. */
  const escolhidoNoGrupo = alvosEfetivos.length < alvos.length;

  const quemEAvaliado =
    escolher === 'AVALIADO'
      ? escolhido?.nome
      : alvosEfetivos.length === 1
        ? alvosEfetivos[0].nome
        : `${alvosEfetivos.length} pessoa(s) deste grupo`;
  /**
   * ⚠️⚠️ RECUSA É SÓ QUANDO NÃO SOBRA NADA A GRAVAR — e isto foi decidido
   * explicitamente, contra a primeira formulação do conserto. **Não "corrija"
   * para desabilitar o botão quando a pessoa escolhida está no grupo.**
   *
   * Parece a leitura natural da regra ("ninguém avalia a si mesmo" ⇒ escolha
   * inválida ⇒ botão desligado), e é errada aqui. A tela recomenda, na frase
   * logo acima da lista, *"nomear o responsável de um grupo resolve o grupo
   * inteiro"* — e **o responsável quase sempre está no grupo**. Desabilitar o
   * botão tiraria o caminho que a própria tela ensina, para consertar um
   * defeito que era de CONTAGEM: o modal anunciava 18 e gravava 17.
   *
   * A regra certa é sobre o EFEITO, não sobre a escolha: recusa quando
   * `alvosEfetivos` fica vazio — uma pessoa que é ela mesma, ou um grupo cujo
   * único membro é quem se escolheu. Com 18 e o responsável dentro, o ato vale
   * para as 17 e o resumo diz 17, nomeando quem ficou de fora.
   *
   * ⚠️ A guarda do backend (`designar` recusa o par avaliado === avaliador)
   * continua sendo a que vale. Esta aqui existe para a tela não PROMETER o que
   * a API vai negar — não para substituí-la.
   */
  const ehAutoavaliacao =
    !!escolhido &&
    (escolher === 'AVALIADO' ? escolhido.id === avaliadorId : alvosEfetivos.length === 0);

  async function aplicar() {
    if (!escolhido) return;
    setSalvando(true);
    setErro(null);
    const criados: VinculoCriado[] = [];
    const recusas: string[] = [];
    try {
      if (escolher === 'AVALIADOR') {
        // ⭐ `alvosEfetivos`, não `alvos`: a mesma lista que o resumo contou. A
        // linha da própria pessoa já sai daqui, então o backend não precisa
        // recusá-la — e o "N pessoa(s) não receberam o vínculo" deixa de
        // aparecer para quem a tela nunca prometeu gravar.
        for (const pessoa of alvosEfetivos) {
          try {
            criados.push(await cadastroAvaliadores.designar(escolhido.id, pessoa.colaboradorId));
          } catch (e) {
            // ⚠️ Uma recusa não derruba as outras — a guarda do backend continua
            // sendo a que vale, para o caso de a tela estar com dado velho.
            recusas.push(`${pessoa.nome}: ${mensagemDoErro(e)}`);
          }
        }
      } else {
        criados.push(await cadastroAvaliadores.designar(avaliadorId!, escolhido.id));
      }
      setFeitos(criados);
      setFalhas(recusas);
      if (criados.length > 0) await aoConcluir();
      if (criados.length === 0) setErro(recusas[0] ?? 'Nada foi gravado.');
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={titulo} aoFechar={aoFechar}>
      {feitos === null ? (
        <>
          <SeletorDeColaborador
            escolhido={escolhido}
            aoEscolher={setEscolhido}
            aoLimpar={() => setEscolhido(null)}
            rotulo={escolher === 'AVALIADOR' ? 'Quem vai avaliar' : 'Quem entra na lista'}
            autoFoco
          />

          {/* ⚠️ O aviso de autoavaliação é de GRUPO: em modal de uma pessoa só
              ele fala de uma "seleção" que não existe na tela. Para uma pessoa,
              o caso é checado e dito na hora, embaixo. */}
          {escolher === 'AVALIADOR' && alvos.length > 1 && (
            <p className="mt-2 text-xs text-slate-500">
              Ninguém pode ser avaliador da própria avaliação — se a pessoa escolhida estiver no
              grupo, ela fica de fora e as demais seguem.
            </p>
          )}

          {/* ⭐⭐ O RESUMO ANTES DE CONFIRMAR. Diz, em uma frase, o que o botão
              vai gravar — e é o que impede a "escolha invisível": a lista se
              refaz a cada busca, o resumo não. Voz ATIVA ("X passa a avaliar Y")
              de propósito: "Y passa a ser avaliado por X" exigiria concordância
              de gênero, que o cadastro não tem como saber. */}
          {escolhido && !ehAutoavaliacao && (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-800">
              <strong className="font-semibold">{quemAvalia}</strong> passa a avaliar{' '}
              <strong className="font-semibold">{quemEAvaliado}</strong>.
              {/* ⭐ O termo que falta, NOMEADO. Só dizer "17" onde o grupo tem 18
                  deixaria quem lê procurando o que sumiu. */}
              {escolhidoNoGrupo && (
                <span className="mt-1 block text-xs text-slate-600">
                  {escolhido.nome} está neste grupo e fica de fora — ninguém avalia a si mesmo.
                </span>
              )}
            </p>
          )}
          {ehAutoavaliacao && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <strong>Ninguém avalia a si mesmo.</strong> Escolha outra pessoa.
            </p>
          )}

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
              disabled={!escolhido || ehAutoavaliacao || salvando}
              onClick={aplicar}
              className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? 'Gravando…' : 'Definir vínculo'}
            </button>
          </div>
        </>
      ) : (
        <>
          {feitos.length === 1 ? (
            <AvisoDosCiclos nome={primeiroNome(feitos[0].avaliadoNome)} ciclos={feitos[0].ciclos} />
          ) : (
            <AvisoDosCiclosEmLote quantidade={feitos.length} porCiclo={agruparPorCiclo(feitos)} />
          )}
          {falhas.length > 0 && (
            <div className="mt-3">
              <Erro
                mensagem={`${falhas.length} pessoa(s) não receberam o vínculo.`}
                dica={falhas[0]}
              />
            </div>
          )}
          <button
            type="button"
            onClick={aoFechar}
            className="alvo-toque mt-5 w-full rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white"
          >
            Entendi
          </button>
        </>
      )}
    </Modal>
  );
}

/** "MARIA APARECIDA DA SILVA" → "MARIA": a frase do aviso fica legível. */
function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/**
 * No lote, uma linha por pessoa seria ilegível (o maior grupo tem 61). Soma por
 * situação DENTRO de cada ciclo — o ciclo continua nomeado, que é a regra.
 */
function agruparPorCiclo(criados: VinculoCriado[]) {
  const porCiclo = new Map<
    string,
    { cicloId: string; cicloNome: string; contagem: Map<SituacaoNoCiclo, { pedeAcao: boolean; total: number }> }
  >();
  for (const c of criados) {
    for (const l of c.ciclos) {
      const atual =
        porCiclo.get(l.cicloId) ??
        { cicloId: l.cicloId, cicloNome: l.cicloNome, contagem: new Map() };
      const contado = atual.contagem.get(l.situacao) ?? { pedeAcao: l.pedeAcao, total: 0 };
      contado.total += 1;
      atual.contagem.set(l.situacao, contado);
      porCiclo.set(l.cicloId, atual);
    }
  }
  return [...porCiclo.values()].map((c) => ({
    cicloId: c.cicloId,
    cicloNome: c.cicloNome,
    contagem: [...c.contagem.entries()].map(([situacao, v]) => ({ situacao, ...v })),
  }));
}
