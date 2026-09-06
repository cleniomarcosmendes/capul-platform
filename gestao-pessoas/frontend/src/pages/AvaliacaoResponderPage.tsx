import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, CloudOff, Loader2, Send } from 'lucide-react';
import {
  avaliacoes,
  mensagemDoErro,
  type Questionario,
  type Pergunta,
} from '../services/api';

type EstadoDaResposta = 'salvando' | 'salvo' | 'erro';

/**
 * O QUESTIONÁRIO — a tela que o piloto inteiro depende de acertar.
 *
 * Quatro decisões que não são polimento:
 *
 * 1. **RASCUNHO AUTOMÁTICO.** Cada resposta é gravada na hora, não no envio. O
 *    avaliador vai ser interrompido no meio — cliente na loja, telefone,
 *    reunião — e quem perde o que respondeu não volta. Ao reabrir, a tela vem
 *    exatamente onde parou, e rola até a primeira pergunta sem resposta.
 *
 * 2. **ENVIO IRREVERSÍVEL, E DITO COM TODAS AS LETRAS.** Depois de enviar, só o
 *    RH reabre; o avaliador não vê a nota nem corrige sozinho. Por isso a
 *    confirmação explica isso antes, não depois.
 *
 * 3. **PROGRESSO SEMPRE À VISTA.** Barra fixa no topo com "7 de 15" — quem tem
 *    30 liderados precisa saber onde está sem contar na tela.
 *
 * 4. **CELULAR DE VERDADE, não desktop encolhido.** Alternativa é bloco de
 *    toque inteiro com no mínimo 44px, texto que quebra em várias linhas sem
 *    cortar, rádio grande, e a barra de envio fixa no rodapé respeitando a área
 *    segura do aparelho.
 *
 * ⚠️ O PESO da pergunta não aparece aqui — saber que uma vale o triplo muda a
 * resposta. Os pesos aparecem na memória de cálculo do RESULTADO, que é onde
 * servem para explicar a nota a quem contestar.
 */
export default function AvaliacaoResponderPage() {
  const { id = '' } = useParams();
  const navegar = useNavigate();

  const [questionario, setQuestionario] = useState<Questionario | null>(null);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});
  const [estados, setEstados] = useState<Record<string, EstadoDaResposta>>({});
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const primeiraSemResposta = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let vivo = true;
    avaliacoes
      .abrir(id)
      .then((q) => {
        if (!vivo) return;
        setQuestionario(q);
        const iniciais: Record<string, string> = {};
        for (const g of q.grupos) {
          for (const p of g.perguntas) {
            if (p.alternativaEscolhidaId) iniciais[p.id] = p.alternativaEscolhidaId;
          }
        }
        setEscolhas(iniciais);
      })
      .catch((e) => vivo && setErroCarregar(mensagemDoErro(e, 'Não foi possível abrir a avaliação.')));
    return () => {
      vivo = false;
    };
  }, [id]);

  // Ao reabrir, leva a pessoa de volta ao ponto em que parou.
  useEffect(() => {
    if (questionario && primeiraSemResposta.current) {
      primeiraSemResposta.current.scrollIntoView({ block: 'center' });
    }
  }, [questionario]);

  const responder = useCallback(
    async (perguntaId: string, alternativaId: string) => {
      // A escolha aparece na tela ANTES de a rede responder: o toque tem de dar
      // retorno imediato, senão a pessoa toca de novo achando que falhou.
      setEscolhas((atual) => ({ ...atual, [perguntaId]: alternativaId }));
      setEstados((atual) => ({ ...atual, [perguntaId]: 'salvando' }));
      try {
        await avaliacoes.responder(id, perguntaId, alternativaId);
        setEstados((atual) => ({ ...atual, [perguntaId]: 'salvo' }));
      } catch {
        // A escolha CONTINUA na tela: perder o que a pessoa acabou de marcar
        // por causa de uma oscilação de rede é o pior desfecho possível.
        setEstados((atual) => ({ ...atual, [perguntaId]: 'erro' }));
      }
    },
    [id],
  );

  if (erroCarregar) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 text-center">
        <AlertCircle size={36} className="mx-auto text-red-400" aria-hidden />
        <p className="mt-3 font-medium text-slate-800">{erroCarregar}</p>
        <button
          type="button"
          onClick={() => navegar('/')}
          className="alvo-toque mt-4 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
        >
          Voltar para a lista
        </button>
      </div>
    );
  }
  if (!questionario) return <Carregando />;

  const perguntas = questionario.grupos.flatMap((g) => g.perguntas);
  const respondidas = perguntas.filter((p) => escolhas[p.id]).length;
  const faltam = perguntas.length - respondidas;
  const completo = faltam === 0;
  const comErro = Object.values(estados).filter((e) => e === 'erro').length;
  let jaMarcouPrimeira = false;

  return (
    <div className="min-h-dvh bg-slate-50 pb-32">
      <CabecalhoFixo
        nome={questionario.avaliado.nome}
        cargo={questionario.avaliado.cargo}
        respondidas={respondidas}
        total={perguntas.length}
        aoVoltar={() => navegar('/')}
      />

      <div className="mx-auto max-w-2xl px-4">
        {questionario.grupos.map((grupo) => (
          <section key={grupo.id} className="mt-6">
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {grupo.titulo}
            </h2>
            <div className="mt-2 space-y-3">
              {grupo.perguntas.map((pergunta) => {
                const semResposta = !escolhas[pergunta.id];
                const ancora = semResposta && !jaMarcouPrimeira;
                if (ancora) jaMarcouPrimeira = true;
                return (
                  <div key={pergunta.id} ref={ancora ? primeiraSemResposta : undefined}>
                    <CartaoDePergunta
                      pergunta={pergunta}
                      escolhida={escolhas[pergunta.id] ?? null}
                      estado={estados[pergunta.id]}
                      aoEscolher={(alternativaId) => void responder(pergunta.id, alternativaId)}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <BarraDeEnvio
        completo={completo}
        faltam={faltam}
        comErro={comErro}
        onEnviar={() => setConfirmando(true)}
      />

      {confirmando && (
        <DialogoDeEnvio
          nome={questionario.avaliado.nome}
          enviando={enviando}
          erro={erroEnvio}
          onCancelar={() => {
            setConfirmando(false);
            setErroEnvio(null);
          }}
          onConfirmar={async () => {
            setEnviando(true);
            setErroEnvio(null);
            try {
              await avaliacoes.enviar(id);
              navegar('/', { replace: true });
            } catch (e) {
              setErroEnvio(mensagemDoErro(e, 'Não foi possível enviar.'));
            } finally {
              setEnviando(false);
            }
          }}
        />
      )}
    </div>
  );
}

function CabecalhoFixo({
  nome,
  cargo,
  respondidas,
  total,
  aoVoltar,
}: {
  nome: string;
  cargo: string | null;
  respondidas: number;
  total: number;
  aoVoltar: () => void;
}) {
  const percentual = total > 0 ? (respondidas / total) * 100 : 0;
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-2 py-2">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar para a lista"
          className="alvo-toque flex w-11 items-center justify-center rounded-xl text-slate-500 active:bg-slate-100"
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{nome}</p>
          <p className="truncate text-xs text-slate-500">{cargo ?? 'Sem cargo cadastrado'}</p>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-slate-600">
          {respondidas}/{total}
        </span>
      </div>
      <div
        className="h-1 bg-slate-100"
        role="progressbar"
        aria-valuenow={respondidas}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${respondidas} de ${total} perguntas respondidas`}
      >
        <div className="h-full bg-capul-600 transition-[width]" style={{ width: `${percentual}%` }} />
      </div>
    </header>
  );
}

function CartaoDePergunta({
  pergunta,
  escolhida,
  estado,
  aoEscolher,
}: {
  pergunta: Pergunta;
  escolhida: string | null;
  estado?: EstadoDaResposta;
  aoEscolher: (alternativaId: string) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="sr-only">{pergunta.enunciado}</legend>
      <div className="mb-3 flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800">{pergunta.enunciado}</p>
        <IndicadorDeSalvamento estado={estado} />
      </div>

      <div className="space-y-2">
        {pergunta.alternativas.map((alternativa) => {
          const marcada = escolhida === alternativa.id;
          return (
            <label
              key={alternativa.id}
              className={`alvo-toque flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                marcada
                  ? 'border-capul-600 bg-capul-50 ring-1 ring-capul-600'
                  : 'border-slate-200 active:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={pergunta.id}
                value={alternativa.id}
                checked={marcada}
                onChange={() => aoEscolher(alternativa.id)}
                // 20px: alvo confortável para o dedo, e visível para quem
                // enxerga mal. O rádio padrão do celular é pequeno demais.
                className="mt-0.5 size-5 shrink-0 accent-capul-600"
              />
              {/* leading-snug + texto inteiro: as alternativas do instrumento
                  real têm até 25 palavras — cortar com reticências esconderia
                  justamente a diferença entre uma e outra. */}
              <span className="text-sm leading-snug text-slate-700">{alternativa.descricao}</span>
            </label>
          );
        })}
      </div>

      {estado === 'erro' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
          <CloudOff size={14} aria-hidden />
          Sua escolha está na tela, mas ainda não foi salva. Toque de novo quando houver sinal.
        </p>
      )}
    </fieldset>
  );
}

function IndicadorDeSalvamento({ estado }: { estado?: EstadoDaResposta }) {
  if (!estado) return null;
  if (estado === 'salvando') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin" aria-hidden /> salvando
      </span>
    );
  }
  if (estado === 'salvo') {
    return (
      <span className="flex shrink-0 items-center gap-1 text-xs text-capul-600">
        <Check size={12} aria-hidden /> salvo
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1 text-xs text-amber-700">
      <CloudOff size={12} aria-hidden /> não salvo
    </span>
  );
}

function BarraDeEnvio({
  completo,
  faltam,
  comErro,
  onEnviar,
}: {
  completo: boolean;
  faltam: number;
  comErro: number;
  onEnviar: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto max-w-2xl px-4 py-3">
        {/* O botão desabilitado sozinho é silêncio: a pessoa toca e nada
            acontece, sem saber por quê. O texto acima diz o que falta. */}
        {!completo && (
          <p className="mb-2 text-center text-sm text-slate-600">
            Faltam <strong>{faltam}</strong> {faltam === 1 ? 'pergunta' : 'perguntas'} para poder enviar
          </p>
        )}
        {comErro > 0 && (
          <p className="mb-2 text-center text-sm text-amber-700">
            {comErro} {comErro === 1 ? 'resposta não foi salva' : 'respostas não foram salvas'} — toque nelas de novo
          </p>
        )}
        <button
          type="button"
          disabled={!completo}
          onClick={onEnviar}
          className="alvo-toque flex w-full items-center justify-center gap-2 rounded-xl bg-capul-600 px-4 py-3 font-semibold text-white transition active:bg-capul-700 disabled:bg-slate-200 disabled:text-slate-500"
        >
          <Send size={18} aria-hidden />
          Enviar avaliação
        </button>
      </div>
    </div>
  );
}

function DialogoDeEnvio({
  nome,
  enviando,
  erro,
  onCancelar,
  onConfirmar,
}: {
  nome: string;
  enviando: boolean;
  erro: string | null;
  onCancelar: () => void;
  onConfirmar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-envio"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5">
        <h2 id="titulo-envio" className="text-lg font-semibold text-slate-800">
          Enviar a avaliação de {nome}?
        </h2>
        {/* Dizer que é irreversível DEPOIS não serve para nada. */}
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Depois de enviar, <strong>você não consegue mais alterar as respostas</strong>. Se precisar
          corrigir alguma coisa, será necessário pedir ao RH que reabra a avaliação.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          A nota é calculada pelo sistema e não fica visível para você.
        </p>

        {erro && (
          <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">
            {erro}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancelar}
            disabled={enviando}
            className="alvo-toque rounded-xl border border-slate-300 px-4 font-medium text-slate-700 disabled:opacity-50"
          >
            Revisar antes
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={enviando}
            className="alvo-toque flex items-center justify-center gap-2 rounded-xl bg-capul-600 px-4 font-semibold text-white disabled:opacity-60"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Send size={16} aria-hidden />}
            {enviando ? 'Enviando…' : 'Enviar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Carregando() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
