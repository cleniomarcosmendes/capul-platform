import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarClock, CheckCircle2, ChevronRight, Lock, RefreshCw, Send } from 'lucide-react';
import { avaliacoes, ehFaltaDePermissao, mensagemDoErro, type ItemDaFila } from '../services/api';

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
export default function MinhasAvaliacoesPage() {
  const [itens, setItens] = useState<ItemDaFila[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  useEffect(() => {
    void carregar();
  }, []);

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

  const porCiclo = agruparPorCiclo(itens);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-4 sm:pt-6">
      <ProgressoGeral total={itens.length} concluidas={itens.filter((i) => i.status === 'ENVIADA').length} />

      {porCiclo.map((grupo) => (
        <BlocoDoCiclo key={grupo.ciclo.id} grupo={grupo} mostrarNome={porCiclo.length > 1} />
      ))}
    </div>
  );
}

interface GrupoDeCiclo {
  ciclo: ItemDaFila['ciclo'];
  pendentes: ItemDaFila[];
  enviadas: ItemDaFila[];
}

/** Um bloco por ciclo, o de prazo mais curto primeiro — é o que vence antes. */
function agruparPorCiclo(itens: ItemDaFila[]): GrupoDeCiclo[] {
  const mapa = new Map<string, GrupoDeCiclo>();
  for (const item of itens) {
    const g = mapa.get(item.ciclo.id) ?? { ciclo: item.ciclo, pendentes: [], enviadas: [] };
    if (item.status === 'ENVIADA') g.enviadas.push(item);
    else g.pendentes.push(item);
    mapa.set(item.ciclo.id, g);
  }
  for (const g of mapa.values()) {
    // Ordem do trabalho: o que só falta enviar vem primeiro (é um toque), depois
    // o que está começado (retomar é mais barato que começar), depois o resto.
    g.pendentes.sort((a, b) => prioridade(b) - prioridade(a));
  }
  return [...mapa.values()].sort((a, b) => a.ciclo.prazo.localeCompare(b.ciclo.prazo));
}

function BlocoDoCiclo({ grupo, mostrarNome }: { grupo: GrupoDeCiclo; mostrarNome: boolean }) {
  return (
    <section className="mt-6">
      <CabecalhoDoCiclo ciclo={grupo.ciclo} mostrarNome={mostrarNome} />

      {grupo.pendentes.length > 0 && (
        <>
          <h3 className="mb-2 mt-3 px-1 text-sm font-semibold text-slate-500">
            A responder ({grupo.pendentes.length})
          </h3>
          <ul className="space-y-2">
            {grupo.pendentes.map((item) => (
              <li key={item.id}>
                <Cartao item={item} />
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
                <Cartao item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/**
 * ⭐ O PRAZO. Sem ele a tela não respondia "até quando posso responder" em lugar
 * nenhum — e quem responde no corredor da loja não vai procurar essa informação
 * fora do sistema.
 */
function CabecalhoDoCiclo({ ciclo, mostrarNome }: { ciclo: ItemDaFila['ciclo']; mostrarNome: boolean }) {
  const prazo = new Date(ciclo.prazo);
  const dias = Math.ceil((prazo.getTime() - Date.now()) / 86_400_000);
  const urgente = dias <= 7;

  // Sticky ajuda quem rola, mas NÃO substitui o rótulo no cartão: o cabeçalho
  // some atrás de qualquer coisa que abra por cima, e a informação que decide
  // precisa estar onde a pessoa toca.
  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur">
      {mostrarNome && (
        <span className="truncate text-sm font-semibold text-slate-700">{ciclo.nome}</span>
      )}
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
          urgente ? 'text-amber-800' : 'text-slate-600'
        }`}
      >
        <CalendarClock size={13} aria-hidden />
        Responda até {prazo.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
        {dias >= 0 ? ` · ${dias} dia${dias === 1 ? '' : 's'}` : ' · prazo vencido'}
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
          {concluidas === total ? 'Tudo enviado' : `${concluidas} de ${total} enviadas`}
        </p>
        <span className="text-sm tabular-nums text-slate-500">{percentual}%</span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={concluidas}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${concluidas} de ${total} avaliações enviadas`}
      >
        <div
          className="h-full rounded-full bg-capul-600 transition-[width]"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}

function Cartao({ item }: { item: ItemDaFila }) {
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
      </div>
      {!item.restrita && !enviada && (
        <ChevronRight size={20} className="shrink-0 self-center text-slate-300" aria-hidden />
      )}
    </>
  );

  const classe =
    'flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm alvo-toque';

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
    <Link
      to={`/avaliacao/${item.id}`}
      className={`${classe} border-slate-200 transition hover:border-capul-300 hover:shadow active:bg-slate-50`}
    >
      {conteudo}
    </Link>
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
    return <span className="text-xs tabular-nums text-slate-500">{total} perguntas</span>;
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
        {respondidas} de {total} perguntas respondidas
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

function Vazio() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-16 text-center">
      <CheckCircle2 size={40} className="mx-auto text-slate-300" aria-hidden />
      <p className="mt-4 font-medium text-slate-700">Nenhuma avaliação designada a você</p>
      <p className="mt-1 text-sm text-slate-500">
        Quando o RH abrir um ciclo e designar avaliações, elas aparecem aqui.
      </p>
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
