import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Lock, RefreshCw, Search, Send, UserX, X } from 'lucide-react';
import { avaliacoes, ehFaltaDePermissao, mensagemDoErro, type ItemDaFila } from '../services/api';
import { MOTIVO_MINIMO, faltamCaracteres } from '../lib/motivo';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { contagem, flexao } from '../lib/formato';

/**
 * A FILA DO AVALIADOR — a primeira tela de quem vai avaliar.
 *
 * Pensada para um supervisor com 30 liderados, no celular, entre uma tarefa e
 * outra. Por isso, nesta ordem:
 *   • o PROGRESSO GERAL no topo ("4 de 22 enviadas") — sem isso ele não sabe
 *     se está no começo ou no fim;
 *
 * ⚠️ "ENVIADAS" no topo, "PERGUNTAS RESPONDIDAS" no cartão. A palavra
 * "respondidas" significava as duas coisas na mesma tela — 6 de 22 eram
 * avaliações enviadas, 3 de 14 eram perguntas marcadas — e é a mesma família do
 * "Faltam 18 / 18%": dois números com a mesma palavra medindo coisas
 * diferentes, na mesma dobra da tela.
 *   • o CICLO e o PRAZO de cada bloco — sem prazo, "quando" não tem resposta
 *     em lugar nenhum da tela;
 *   • o progresso DE CADA UM na linha ("7 de 15 respondidas") — é o que
 *     transforma "recomeçar" em "retomar";
 *   • as pendentes primeiro, as enviadas depois, porque o trabalho é o que
 *     falta.
 *
 * ⚠️ A FILA NÃO É DE UM CICLO SÓ. Podem existir dois abertos ao mesmo tempo — a
 * produção abre por ondas de unidade — e foi o que aconteceu no DEV: 22 na
 * fila, 14 num ciclo e 8 no outro. Misturados e sem rótulo, o total não bate
 * com ciclo nenhum e a pessoa não sabe até quando responder cada um. Por isso a
 * lista é AGRUPADA POR CICLO, com o prazo no cabeçalho do grupo.
 */
/** Estado da ABA, não do usuário: morre junto com ela. */
const CHAVE_ROLAGEM = 'gestao-pessoas:rolagem:minhas-avaliacoes';

export default function MinhasAvaliacoesPage() {
  const [itens, setItens] = useState<ItemDaFila[] | null>(null);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  /** O que está sendo contestado: uma linha da fila, ou "falta gente" no ciclo. */
  const [contestando, setContestando] = useState<
    { tipo: 'LINHA'; item: ItemDaFila } | { tipo: 'FALTA'; ciclo: ItemDaFila['ciclo'] } | null
  >(null);
  /** A frase que o BACKEND devolveu — é ela que diz que a avaliação continua com ele. */
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  useEffect(() => {
    void carregar();
  }, []);

  /**
   * ⭐ RESTAURAR A ROLAGEM ao voltar de uma avaliação.
   *
   * A tela de responder é outra rota, fora do Layout, então esta lista
   * DESMONTA — e voltar jogava a pessoa no topo. Numa fila de 95, quem abriu o
   * quadragésimo cartão volta e tem de rolar tudo de novo para achar o
   * quadragésimo primeiro; na prática, ou ela responde em ordem ou desiste.
   *
   * Guardado em `sessionStorage` de propósito: é estado da aba, morre com ela, e
   * não faz sentido sobreviver a um login de outra pessoa no mesmo navegador.
   */
  useEffect(() => {
    if (!itens) return;
    const salvo = Number(sessionStorage.getItem(CHAVE_ROLAGEM) ?? '0');
    if (salvo > 0) {
      // Depois da pintura: antes disso a lista ainda não tem altura e o
      // scrollTo não vai a lugar nenhum.
      requestAnimationFrame(() => window.scrollTo(0, salvo));
    }
    return () => sessionStorage.setItem(CHAVE_ROLAGEM, String(window.scrollY));
  }, [itens]);

  async function carregar() {
    setErro(null);
    try {
      setItens(await avaliacoes.minhas());
    } catch (e) {
      setSemPermissao(ehFaltaDePermissao(e));
      setErro(mensagemDoErro(e, 'Não foi possível carregar suas avaliações.'));
    }
  }

  if (erro) {
    return (
      <Erro
        mensagem={erro}
        // Falta de permissão não se resolve tentando de novo — oferecer o botão
        // faz a pessoa insistir num caminho que nunca vai abrir.
        aoTentarDeNovo={semPermissao ? undefined : carregar}
        dica={semPermissao ? 'Peça ao RH que lhe conceda acesso ao módulo.' : undefined}
      />
    );
  }
  if (!itens) return <Carregando />;
  if (itens.length === 0) return <Vazio />;

  const filtrados = filtrar(itens, busca);
  const buscando = busca.trim().length > 0;
  const porCiclo = agruparPorCiclo(filtrados);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4 sm:pt-6">
      <ProgressoGeral total={itens.length} concluidas={itens.filter((i) => i.status === 'ENVIADA').length} />

      <Busca
        valor={busca}
        aoMudar={setBusca}
        resultados={buscando ? filtrados.length : null}
        total={itens.length}
      />

      {/* ⭐⭐ A confirmação fica NA TELA, não num toast que some: ela contém a
          parte que o avaliador precisa levar — a avaliação continua com ele.
          Aviso que desaparece sozinho é aviso que não foi lido. */}
      {confirmacao && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-capul-300 bg-capul-50 p-3 text-sm text-capul-900">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p className="flex-1">{confirmacao}</p>
          <button
            type="button"
            onClick={() => setConfirmacao(null)}
            aria-label="Fechar aviso"
            className="alvo-toque shrink-0 rounded-lg px-2 text-capul-700"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {porCiclo.map((grupo) => (
        <BlocoDoCiclo
          key={grupo.ciclo.id}
          grupo={grupo}
          aoContestar={(item) => setContestando({ tipo: 'LINHA', item })}
          aoRelatarFalta={() => setContestando({ tipo: 'FALTA', ciclo: grupo.ciclo })}
        />
      ))}

      {contestando && (
        <ModalDeContestacao
          alvo={contestando}
          aoFechar={() => setContestando(null)}
          aoGravar={async (texto) => {
            const r =
              contestando.tipo === 'LINHA'
                ? await avaliacoes.contestarDesignacao(contestando.item.id, texto)
                : await avaliacoes.faltaGente(contestando.ciclo.id, texto);
            setContestando(null);
            setConfirmacao(r.frase);
            // Recarrega para a MARCA da linha persistir — sem isto ela sumiria
            // no F5 e ele clicaria de novo achando que não gravou.
            await carregar();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {buscando && filtrados.length === 0 && <NadaEncontrado termo={busca} total={itens.length} />}
    </div>
  );
}


/**
 * ⭐ O MODAL das duas causas. Um só componente porque a decisão é a mesma —
 * escrever o que houve e mandar para o RH —, e porque duas cópias divergiriam
 * no texto que importa.
 *
 * ⚠️ O botão de gravar exige o mínimo de motivo e DIZ quantos caracteres faltam
 * (`faltamCaracteres`), como o resto do módulo: "desabilitado sem dizer por quê"
 * é o defeito que a §5.9 chama de silêncio.
 */
function ModalDeContestacao({
  alvo,
  aoFechar,
  aoGravar,
}: {
  alvo: { tipo: 'LINHA'; item: ItemDaFila } | { tipo: 'FALTA'; ciclo: ItemDaFila['ciclo'] };
  aoFechar: () => void;
  aoGravar: (texto: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const curto = texto.trim().length < MOTIVO_MINIMO;

  const daLinha = alvo.tipo === 'LINHA';
  const titulo = daLinha ? 'Esta pessoa não é da minha equipe' : 'Falta alguém da minha equipe';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl">
        <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>

        {daLinha ? (
          <p className="mt-1 text-sm text-slate-600">
            Sobre <strong>{alvo.item.nome}</strong> ({alvo.item.matricula}).
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            No ciclo <strong>{alvo.ciclo.nome}</strong>. Diga quem falta — nome ou matrícula, se
            você souber.
          </p>
        )}

        {/* ⭐⭐ O AVISO ANTES do envio, não só depois. Quem lê aqui já decide
            sabendo que vai continuar responsável — e quem fecha o modal sem
            enviar também levou a informação. */}
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {daLinha
            ? 'Isto avisa o RH e não muda nada agora: a avaliação continua na sua fila e deve ser respondida no prazo. Quem decide trocar o avaliador é o RH.'
            : 'Isto avisa o RH para revisar o cadastro. Quem faltar só entra na sua fila se o RH confirmar — e as avaliações que você já tem continuam valendo.'}
        </p>

        <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="motivo-contestacao">
          {daLinha ? 'Por quê?' : 'Quem falta?'}
        </label>
        <textarea
          id="motivo-contestacao"
          rows={3}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            daLinha
              ? 'Ex.: saiu do meu setor em julho; hoje responde para o CD.'
              : 'Ex.: falta o JOÃO DA SILVA (004321), que entrou na equipe em agosto.'
          }
          className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-sm"
        />
        {curto && texto.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">{faltamCaracteres(texto, MOTIVO_MINIMO)}</p>
        )}
        {erro && <p className="mt-2 text-sm text-rose-700">{erro}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={aoFechar}
            className="alvo-toque rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={curto || gravando}
            title={curto ? faltamCaracteres(texto, MOTIVO_MINIMO) : undefined}
            onClick={async () => {
              setGravando(true);
              setErro(null);
              try {
                await aoGravar(texto.trim());
              } catch (e) {
                setErro(mensagemDoErro(e, 'Não foi possível registrar. Tente de novo.'));
                setGravando(false);
              }
            }}
            className="alvo-toque rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {gravando ? 'Enviando…' : 'Avisar o RH'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sem acento e sem caixa: quem procura "ana" tem de achar "ANA CLÁUDIA". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * ⭐ BUSCA LOCAL, por nome e matrícula.
 *
 * A fila inteira já está em memória — ir ao servidor a cada tecla adicionaria
 * espera para filtrar uma lista que já está aqui, e quebraria a busca justamente
 * onde ela mais serve: no corredor da loja, com sinal ruim.
 *
 * ⚠️ Filtra ANTES do agrupamento, de propósito. Buscar "ana" tem de devolver a
 * Ana de "Em andamento" E a de "A responder", **cada uma na sua seção** — uma
 * lista achatada faria a pessoa perder a informação de que uma delas já estava
 * começada, que é justamente o que ela precisa saber antes de abrir.
 */
function filtrar(itens: ItemDaFila[], termo: string): ItemDaFila[] {
  const alvo = normalizar(termo.trim());
  if (alvo === '') return itens;
  return itens.filter(
    (i) => normalizar(i.nome).includes(alvo) || normalizar(i.matricula).includes(alvo),
  );
}

function Busca({
  valor,
  aoMudar,
  resultados,
  total,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  /** null = não está buscando. */
  resultados: number | null;
  total: number;
}) {
  return (
    <div className="mt-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        {/* ⚠️ `type="text"`, NÃO `type="search"`. O `search` desenha um "limpar"
            PRÓPRIO no WebKit, que aparecia colado ao nosso — dois X na mesma
            caixa a 360px. Escondê-lo por CSS não funciona aqui: a regra com
            `::-webkit-search-cancel-button` é descartada no build (o Lightning
            CSS do Tailwind v4 remove o pseudo-elemento com prefixo), e ela
            sumia em silêncio. `inputMode` + `enterKeyHint` dão o mesmo teclado
            no celular sem trazer o widget nativo junto. */}
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          placeholder="Procurar por nome ou matrícula"
          aria-label="Procurar por nome ou matrícula"
          className="alvo-toque w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 text-slate-800"
        />
        {valor && (
          <button
            type="button"
            onClick={() => aoMudar('')}
            aria-label="Limpar busca"
            className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 active:bg-slate-100"
          >
            <X size={16} aria-hidden />
          </button>
        )}
      </div>
      {/* ⚠️ O número de resultados é o que separa "não achei ninguém" de "minha
          fila está vazia" — sem ele, a tela filtrada e a tela sem trabalho são
          visualmente a mesma coisa. `aria-live` para quem usa leitor de tela
          ouvir a contagem mudar enquanto digita. */}
      {resultados !== null && (
        <p className="mt-1.5 px-1 text-xs text-slate-500" aria-live="polite">
          {resultados === 0
            ? `Nenhum resultado — sua fila tem ${total}`
            : `${resultados} de ${contagem(total, 'avaliação', 'avaliações')}`}
        </p>
      )}
    </div>
  );
}

function NadaEncontrado({ termo, total }: { termo: string; total: number }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <Search size={28} className="mx-auto text-slate-300" aria-hidden />
      <p className="mt-3 font-medium text-slate-700">Ninguém com “{termo.trim()}”</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        Sua fila tem {contagem(total, 'avaliação', 'avaliações')} — limpe a busca para
        ver todas. A procura é por nome ou matrícula.
      </p>
    </div>
  );
}

interface GrupoDeCiclo {
  ciclo: ItemDaFila['ciclo'];
  /** Começadas e não enviadas — inclui a respondida por inteiro que falta enviar. */
  emAndamento: ItemDaFila[];
  aResponder: ItemDaFila[];
  enviadas: ItemDaFila[];
}

/**
 * Um bloco por ciclo, o de prazo mais curto primeiro — é o que vence antes.
 *
 * ⭐ Dentro do ciclo, TRÊS seções: "Em andamento", "A responder", "Enviadas".
 *
 * O que estava começado antes subia para o topo de "A responder" por uma
 * ordenação implícita — e isso reorganizava a lista SOB O DEDO a cada avaliação
 * iniciada: abrir uma pessoa e voltar mudava o lugar de todas as outras. Seção
 * própria entrega o "continue de onde parou" sem mexer na posição de ninguém.
 *
 * ⚠️ A ordem DENTRO de "A responder" não é decidida aqui, de propósito — ela vem
 * do backend (`criadoEm asc`) e é pergunta aberta para o RH. Ver ESTADO §3.11.
 */
function agruparPorCiclo(itens: ItemDaFila[]): GrupoDeCiclo[] {
  const mapa = new Map<string, GrupoDeCiclo>();
  for (const item of itens) {
    const g =
      mapa.get(item.ciclo.id) ?? { ciclo: item.ciclo, emAndamento: [], aResponder: [], enviadas: [] };
    if (item.status === 'ENVIADA') g.enviadas.push(item);
    else if (item.perguntasRespondidas > 0) g.emAndamento.push(item);
    else g.aResponder.push(item);
    mapa.set(item.ciclo.id, g);
  }
  for (const g of mapa.values()) {
    // Só DENTRO de "Em andamento": o que já está inteiro e só falta enviar vem
    // primeiro, porque é um toque. As outras seções ficam na ordem do backend.
    g.emAndamento.sort((a, b) => prioridade(b) - prioridade(a));
  }
  return [...mapa.values()].sort((a, b) => a.ciclo.prazo.localeCompare(b.ciclo.prazo));
}

function BlocoDoCiclo({
  grupo,
  aoContestar,
  aoRelatarFalta,
}: {
  grupo: GrupoDeCiclo;
  aoContestar: (item: ItemDaFila) => void;
  aoRelatarFalta: () => void;
}) {
  return (
    <section className="mt-6">
      <CabecalhoDoCiclo
        ciclo={grupo.ciclo}
        aResponder={grupo.emAndamento.length + grupo.aResponder.length}
        total={grupo.emAndamento.length + grupo.aResponder.length + grupo.enviadas.length}
      />

      {grupo.emAndamento.length > 0 && (
        <>
          <h3 className="mb-2 mt-3 px-1 text-sm font-semibold text-amber-800">
            Em andamento ({grupo.emAndamento.length})
          </h3>
          <ul className="space-y-2">
            {grupo.emAndamento.map((item) => (
              <li key={item.id}>
                <Cartao item={item} aoContestar={aoContestar} />
              </li>
            ))}
          </ul>
        </>
      )}

      {grupo.aResponder.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 px-1 text-sm font-semibold text-slate-500">
            A responder ({grupo.aResponder.length})
          </h3>
          <ul className="space-y-2">
            {grupo.aResponder.map((item) => (
              <li key={item.id}>
                <Cartao item={item} aoContestar={aoContestar} />
              </li>
            ))}
          </ul>
        </>
      )}

      {grupo.enviadas.length > 0 && (
        <>
          <h3 className="mb-2 mt-6 px-1 text-sm font-semibold text-slate-500">
            Enviadas ({grupo.enviadas.length})
          </h3>
          <ul className="space-y-2">
            {grupo.enviadas.map((item) => (
              <li key={item.id}>
                <Cartao item={item} aoContestar={aoContestar} />
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ⭐ A SEGUNDA CAUSA — "falta gente" é sobre quem NÃO está na lista, e
          por isso não tem cartão onde clicar. Sem este caminho, metade do que o
          avaliador tem a dizer sobre o cadastro se perderia por uma razão de
          implementação. Fica no rodapé do bloco: quem chegou até aqui viu a
          fila inteira e é exatamente quem sabe dizer quem falta. */}
      <button
        type="button"
        onClick={aoRelatarFalta}
        className="alvo-toque mt-3 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-capul-300 hover:text-capul-800"
      >
        Falta alguém da minha equipe nesta lista?
      </button>
    </section>
  );
}

/**
 * ⭐ O PRAZO e a CONTAGEM DO BLOCO, juntos.
 *
 * Sem o prazo, a tela não respondia "até quando posso responder" em lugar
 * nenhum — e quem responde no corredor da loja não vai procurar isso fora do
 * sistema.
 *
 * ⭐ E a contagem precisa ser POR BLOCO, não só no topo. O total geral soma
 * ciclos com urgências diferentes: 14 avaliações que vencem em 24 dias e 8 que
 * vencem em 55 viram um "27%" só, e quem está contra o prazo do Piloto olha
 * esse número sem saber quanto dele é urgente. O agregado esconde exatamente a
 * informação que faz alguém agir hoje.
 */
function CabecalhoDoCiclo({
  ciclo,
  aResponder,
  total,
}: {
  ciclo: ItemDaFila['ciclo'];
  aResponder: number;
  total: number;
}) {
  const prazo = new Date(ciclo.prazo);
  const dias = Math.ceil((prazo.getTime() - Date.now()) / 86_400_000);
  const urgente = dias <= 7;

  // Sticky ajuda quem rola, mas NÃO substitui o rótulo no cartão: o cabeçalho
  // some atrás de qualquer coisa que abra por cima, e a informação que decide
  // precisa estar onde a pessoa toca.
  //
  // ⚠️ Encaixa ABAIXO do cabeçalho do módulo, que também é sticky. A altura vem
  // de `--altura-cabecalho`, medida pelo Layout — fixar um número erraria no
  // celular, onde nome e filial podem quebrar em duas linhas.
  return (
    <div
      style={{ top: 'var(--altura-cabecalho, 0px)' }}
      className="sticky z-10 -mx-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-xl border border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur"
    >
      <span className="truncate text-sm font-semibold text-slate-700">{ciclo.nome}</span>
      <span className="text-xs font-medium text-slate-600">
        {aResponder === 0 ? `tudo enviado · ${total}` : `${aResponder} a responder de ${total}`}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          urgente ? 'text-amber-800' : 'text-slate-600'
        }`}
      >
        <CalendarClock size={13} aria-hidden />
        até {prazo.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
        {dias >= 0 ? ` · ${contagem(dias, 'dia', 'dias')}` : ' · prazo vencido'}
      </span>
    </div>
  );
}

/** Só falta enviar = 2 · começada = 1 · não começada = 0. */
function prioridade(item: ItemDaFila): number {
  if (item.perguntasTotal > 0 && item.perguntasRespondidas >= item.perguntasTotal) return 2;
  return item.perguntasRespondidas > 0 ? 1 : 0;
}

/**
 * ⚠️ TUDO AQUI CONTA NA MESMA DIREÇÃO — o que já foi feito.
 *
 * Antes o título dizia o que FALTAVA ("Faltam 18 de 22") e o percentual ao lado
 * dizia o que estava CONCLUÍDO (18%). Dois números com o mesmo valor
 * significando coisas opostas, um do lado do outro, e a barra enchendo na
 * direção do segundo. Com 22 avaliações e 4 enviadas os dois davam 18, o que é
 * a pior coincidência possível: parecia confirmação em vez de contradição.
 */
function ProgressoGeral({ total, concluidas }: { total: number; concluidas: number }) {
  const percentual = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold text-slate-800">
          {concluidas === total
                ? 'Tudo enviado'
                : `${concluidas} de ${total} ${flexao(total, 'enviada', 'enviadas')}`}
        </p>
        <span className="text-sm tabular-nums text-slate-500">{percentual}%</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={concluidas}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${concluidas} de ${contagem(total, 'avaliação enviada', 'avaliações enviadas')}`}
      >
        <div
          className="h-full rounded-full bg-capul-600 transition-[width]"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

function Cartao({
  item,
  aoContestar,
}: {
  item: ItemDaFila;
  aoContestar: (item: ItemDaFila) => void;
}) {
  const enviada = item.status === 'ENVIADA';
  const conteudo = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-800">{item.nome}</p>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {item.cargo ?? 'Sem cargo cadastrado'} · {item.matricula}
        </p>
        {/* ⭐ O CICLO NO PRÓPRIO CARTÃO. Com dois ciclos abertos, a mesma pessoa
            aparece DUAS VEZES na fila com cartões idênticos — mesmo nome, cargo,
            matrícula e "14 perguntas". O cabeçalho do bloco não basta: com 14
            cartões no bloco de cima, quem rola até o de baixo já perdeu o
            cabeçalho de vista e responde sem saber qual dos dois abriu. */}
        <p className="mt-1 truncate text-xs font-medium text-capul-700">{item.ciclo.nome}</p>
        <div className="mt-2">
          {item.restrita ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
              <Lock size={12} aria-hidden /> {item.motivoRestricao}
            </span>
          ) : enviada ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-capul-600">
              <CheckCircle2 size={14} aria-hidden /> Enviada
            </span>
          ) : (
            <ProgressoDoItem
              respondidas={item.perguntasRespondidas}
              total={item.perguntasTotal}
            />
          )}
        </div>
        {/* ⭐ A MARCA PERSISTE e diz as duas coisas: que o RH foi avisado E que
            a avaliação continua com ele. Só "avisado" faria o cartão parecer
            resolvido — que é o defeito que este recurso não pode ter. */}
        {item.contestadaEm && (
          <p className="mt-2 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
            Você avisou o RH que esta pessoa não é da sua equipe. Enquanto ele
            não decidir, a avaliação continua com você.
          </p>
        )}
      </div>
      {!item.restrita && !enviada && (
        <ChevronRight size={20} className="shrink-0 self-center text-slate-300" aria-hidden />
      )}
    </>
  );

  const classe =
    'flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm alvo-toque';

  /**
   * ⭐⭐ "NÃO É MINHA EQUIPE" — o instrumento do sinal que só o piloto dá.
   *
   * ⚠️ FORA do `<Link>`, e não dentro: botão dentro de link é interativo
   * aninhado — o toque no celular pega o link e abre o questionário.
   *
   * ⚠️ E some na ENVIADA e na RESTRITA. Na enviada é ato sem objeto (ele já
   * julgou a pessoa; a discussão agora é do RH); na restrita, a avaliação é a
   * dele mesmo. "Some quando falta objeto, desabilita quando falta estado" — a
   * mesma regra do Reabrir na linha da Designação.
   */
  const aviso =
    !item.restrita && !enviada ? (
      <button
        type="button"
        onClick={() => aoContestar(item)}
        className="alvo-toque mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <UserX size={13} aria-hidden />
        {item.contestadaEm ? 'Avisar de novo' : 'Não é da minha equipe'}
      </button>
    ) : null;

  // A própria avaliação APARECE na lista — a gestora precisa estar designada
  // para o superior dela receber a tarefa — mas não abre.
  if (item.restrita) {
    return (
      <div className={`${classe} border-amber-200 bg-amber-50/40`} aria-disabled>
        {conteudo}
      </div>
    );
  }
  if (enviada) return <div className={`${classe} border-slate-200 opacity-75`}>{conteudo}</div>;

  return (
    <div>
      <Link
        to={`/avaliacao/${item.id}`}
        className={`${classe} border-slate-200 transition hover:border-capul-300 hover:shadow active:bg-slate-50`}
      >
        {conteudo}
      </Link>
      {aviso}
    </div>
  );
}

function ProgressoDoItem({ respondidas, total }: { respondidas: number; total: number }) {
  const comecou = respondidas > 0;
  const completa = total > 0 && respondidas >= total;

  // ⭐ Respondida por inteiro mas NÃO enviada é o estado mais perigoso da fila:
  // a pessoa fez o trabalho todo e some da conta do RH porque esqueceu o último
  // toque. Aqui ele deixa de parecer "quase igual aos outros".
  if (completa) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
        <Send size={11} aria-hidden /> Respondida — falta enviar
      </span>
    );
  }

  // ⚠️ Sem nenhuma resposta, a barra fica vazia em TODOS os cartões — um
  // elemento cinza que nunca muda não informa nada e ainda sugere defeito. Ela
  // só aparece quando tem o que mostrar; antes disso basta o tamanho da tarefa.
  if (!comecou) {
    return (
      <span className="text-xs tabular-nums text-slate-500">
        {contagem(total, 'pergunta', 'perguntas')}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-capul-400"
          style={{ width: `${total > 0 ? (respondidas / total) * 100 : 0}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-slate-500">
        {respondidas} de {contagem(total, 'pergunta respondida', 'perguntas respondidas')}
      </span>
    </div>
  );
}

function Carregando() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

/**
 * ⭐ O estado vazio é a resposta desenhada para "não tenho fila" — é por existir
 * que o item de menu não precisa de condição de papel (§3.1.3), e é por isso que
 * o redirect por papel foi removido (ver `App.tsx`).
 *
 * ⚠️ O atalho para Ciclos aparece para quem é do RH. É ATALHO, não porta: quem
 * é do RH já tem "Ciclos" na barra lateral. Existe para a tela vazia não ser um
 * beco para quem chegou aqui por engano.
 */
function Vazio() {
  const { tem } = useAuth();
  const doRh = tem(ROLES.RH_ADMIN, ROLES.RH_CICLO, ROLES.RH_MODELO);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
      <CheckCircle2 size={40} className="mx-auto text-slate-300" aria-hidden />
      <p className="mt-4 font-medium text-slate-700">Nenhuma avaliação designada a você</p>
      <p className="mt-1 text-sm text-slate-500">
        Quando o RH abrir um ciclo e designar avaliações, elas aparecem aqui.
      </p>
      {doRh && (
        <Link
          to="/ciclos"
          className="alvo-toque mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Ir para os ciclos
        </Link>
      )}
    </div>
  );
}

function Erro({
  mensagem,
  aoTentarDeNovo,
  dica,
}: {
  mensagem: string;
  aoTentarDeNovo?: () => void;
  dica?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 text-center">
      <AlertCircle size={36} className="mx-auto text-red-400" aria-hidden />
      <p className="mt-3 font-medium text-slate-800">{mensagem}</p>
      {dica && <p className="mt-1 text-sm text-slate-500">{dica}</p>}
      {aoTentarDeNovo && (
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="alvo-toque mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          <RefreshCw size={16} aria-hidden /> Tentar de novo
        </button>
      )}
    </div>
  );
}
