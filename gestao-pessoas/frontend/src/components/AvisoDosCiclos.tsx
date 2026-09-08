import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { SituacaoDoVinculoNoCiclo, SituacaoNoCiclo } from '../services/api';
import { contagem } from '../lib/formato';

/**
 * ⭐⭐ O QUE O VÍNCULO MUDA — E O QUE NÃO MUDA — NO CICLO ABERTO.
 *
 * O cadastro é permanente; o ciclo é uma CÓPIA dele, feita quando alguém roda
 * "Designar pelo cadastro". Definir o vínculo **não cria avaliação em ciclo já
 * aberto**, e sem dizer isso na hora o nome bom da tela piora o problema: a
 * pessoa vincula, sai convencida de que resolveu, e a avaliação não existe.
 *
 * ⚠️ **Aviso genérico não serve.** O estado que ele esconderia é
 * `JA_RESPONDIDA`: o lote RECUSA trocar o avaliador de uma avaliação que já tem
 * resposta, e o motivo ficaria enterrado no relatório do lote. A frase aqui é a
 * mesma que o backend usa na recusa — o sistema fala com uma voz só.
 *
 * ⚠️ **Uma linha por ciclo aberto, sempre**, inclusive as que dizem "nada a
 * fazer". Com dois ciclos abertos (o caso de hoje), omitir aquele em que nada
 * muda faz o silêncio ser lido como "não se aplica". E cada linha **nomeia o
 * ciclo**: "o ciclo aberto" é ambíguo exatamente onde a ambiguidade custa caro.
 *
 * ⚠️ **Inline, e fica.** Não é toast: toast some antes de ser lido, e o custo
 * aqui é uma avaliação que não existe.
 */

const ICONE = {
  acao: <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />,
  info: <Info size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />,
  ok: <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />,
};

function frase(l: SituacaoDoVinculoNoCiclo, nome: string) {
  const ciclo = <strong className="font-semibold">{l.cicloNome}</strong>;
  const designar = (
    <Link to={`/ciclos/${l.cicloId}/designacao`} className="font-medium text-capul-700 underline">
      Designar pelo cadastro
    </Link>
  );

  switch (l.situacao) {
    case 'JA_REFLETE':
      return <>O ciclo {ciclo} já reflete este vínculo — nada a fazer.</>;

    case 'SEM_AVALIACAO':
      return (
        <>
          {nome} ainda <strong>não tem avaliação</strong> no ciclo {ciclo} — rode {designar} para
          criá-la.
        </>
      );

    case 'FORA_DO_PUBLICO':
      return (
        <>
          {nome} <strong>não entra</strong> no ciclo {ciclo}: não está no público de nenhuma
          aplicação. Ponha no público em{' '}
          <Link
            to={`/ciclos/${l.cicloId}/aplicacoes`}
            className="font-medium text-capul-700 underline"
          >
            Aplicações
          </Link>{' '}
          e depois rode {designar}.
        </>
      );

    case 'FORA_PELA_REGUA':
      return (
        <>
          {nome} está fora do ciclo {ciclo} <strong>pela régua</strong>
          {l.justificativa ? <>: “{l.justificativa}”</> : '.'} Enquanto estiver fora, o vínculo não
          gera avaliação.
        </>
      );

    case 'FORA_POR_DECISAO_RH':
      return (
        <>
          {/* Voz ativa: "foi tirado" concorda com a PESSOA e erra metade das
              vezes — o cadastro não tem gênero (§3.1.7). */}
          <strong>O RH tirou</strong> {nome} do ciclo {ciclo}
          {l.justificativa ? <>: “{l.justificativa}”</> : '.'} Enquanto a decisão valer, o vínculo
          não gera avaliação — ela se desfaz na{' '}
          <Link
            to={`/ciclos/${l.cicloId}/designacao`}
            className="font-medium text-capul-700 underline"
          >
            Designação
          </Link>
          .
        </>
      );

    case 'OUTRO_AVALIADOR':
      return (
        <>
          No ciclo {ciclo} a avaliação de {nome} é com{' '}
          <strong>{l.avaliadorAtual ?? 'outro avaliador'}</strong> — o cadastro não troca sozinho;
          rode {designar} para atualizar.
        </>
      );

    case 'OUTRO_AVALIADOR_MANUAL':
      return (
        <>
          No ciclo {ciclo} a avaliação de {nome} é com{' '}
          <strong>{l.avaliadorAtual ?? 'outro avaliador'}</strong>, e foi designada{' '}
          <strong>à mão dentro do ciclo</strong>: o lote só a substitui com “substituir os ajustes
          manuais” marcado, em {designar}.
        </>
      );

    case 'JA_RESPONDIDA':
      return (
        <>
          No ciclo {ciclo} <strong>nada muda</strong>:{' '}
          <strong>{l.avaliadorAtual ?? 'o avaliador atual'}</strong>{' '}
          {l.statusAvaliacao === 'ENVIADA'
            ? 'já enviou a avaliação'
            : `já respondeu ${contagem(l.respostas, 'pergunta', 'perguntas')}`}
          . Trocar o avaliador agora atribuiria o julgamento de uma pessoa a outra.
        </>
      );
  }
}

function icone(l: SituacaoDoVinculoNoCiclo) {
  if (l.pedeAcao) return ICONE.acao;
  return l.situacao === 'JA_REFLETE' ? ICONE.ok : ICONE.info;
}

/** O que pede ação primeiro; o resto depois, na ordem em que veio. */
function ordenar(linhas: SituacaoDoVinculoNoCiclo[]) {
  return [...linhas].sort((a, b) => Number(b.pedeAcao) - Number(a.pedeAcao));
}

export function AvisoDosCiclos({
  nome,
  ciclos,
}: {
  /** Primeiro nome de quem foi vinculado — a frase fica mais curta e mais clara. */
  nome: string;
  ciclos: SituacaoDoVinculoNoCiclo[];
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">Vínculo definido.</p>
      {ciclos.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          Não há ciclo aberto — ele vale a partir do próximo.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {ordenar(ciclos).map((l) => (
            <li key={l.cicloId} className="flex gap-2 text-sm text-slate-700">
              {icone(l)}
              <span className="min-w-0">{frase(l, nome)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Rótulo curto, para quando o vínculo foi definido para um GRUPO de pessoas. */
const ROTULO: Record<SituacaoNoCiclo, string> = {
  JA_REFLETE: 'já refletem o vínculo',
  SEM_AVALIACAO: 'sem avaliação — falta rodar “Designar pelo cadastro”',
  FORA_DO_PUBLICO: 'fora do público de todas as aplicações',
  FORA_PELA_REGUA: 'fora do ciclo pela régua',
  FORA_POR_DECISAO_RH: 'fora do ciclo por decisão do RH',
  OUTRO_AVALIADOR: 'com outro avaliador — o lote atualiza',
  OUTRO_AVALIADOR_MANUAL: 'designadas à mão no ciclo — o lote não substitui sozinho',
  JA_RESPONDIDA: 'já respondidas com outro avaliador — não mudam',
};

/**
 * ⚠️ No lote, uma linha por PESSOA seria ilegível (o maior grupo tem 61). Some
 * por situação, dentro de cada ciclo — e mantém a regra: o ciclo é nomeado, e o
 * que pede ação vem primeiro.
 */
export function AvisoDosCiclosEmLote({
  quantidade,
  porCiclo,
}: {
  quantidade: number;
  porCiclo: { cicloId: string; cicloNome: string; contagem: { situacao: SituacaoNoCiclo; pedeAcao: boolean; total: number }[] }[];
}) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-800">
        {contagem(quantidade, 'vínculo definido', 'vínculos definidos')}.
      </p>
      {porCiclo.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">
          Não há ciclo aberto — eles valem a partir do próximo.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {porCiclo.map((c) => (
            <li key={c.cicloId} className="text-sm text-slate-700">
              <p className="font-semibold text-slate-800">{c.cicloNome}</p>
              <ul className="mt-0.5 space-y-0.5">
                {[...c.contagem]
                  .sort((a, b) => Number(b.pedeAcao) - Number(a.pedeAcao))
                  .map((x) => (
                    <li key={x.situacao} className="flex gap-2">
                      {x.pedeAcao ? ICONE.acao : ICONE.info}
                      <span>
                        <strong className="tabular-nums">{x.total}</strong> {ROTULO[x.situacao]}
                      </span>
                    </li>
                  ))}
              </ul>
              {c.contagem.some((x) => x.situacao === 'SEM_AVALIACAO' || x.situacao === 'OUTRO_AVALIADOR') && (
                <Link
                  to={`/ciclos/${c.cicloId}/designacao`}
                  className="mt-1 inline-block font-medium text-capul-700 underline"
                >
                  Ir para a Designação deste ciclo
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
