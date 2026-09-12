/**
 * ⭐⭐ O FORMULÁRIO DA QUESTÃO — Etapa 6.
 *
 * ⚠️ **A primeira coisa que a tela diz é QUANTO trabalho é.** Uma questão não é
 * um campo de texto: são **cinco** — o enunciado e as quatro âncoras, uma para
 * cada nível. Quem chega esperando um campo e encontra cinco desiste no meio,
 * e o que fica no banco é uma questão com duas âncoras escritas e duas
 * abandonadas.
 *
 * ⭐ **A pontuação NÃO se digita.** Medido no acervo: as 15 questões usam
 * `0,3 · 0,6 · 0,9 · 1,2`, sem exceção — um único conjunto de valores em 15 —,
 * enquanto os 60 textos de âncora são todos diferentes. Então o valor vem
 * pronto e o texto é o trabalho. Não é comodidade: a pontuação máxima de um
 * perfil é `Σ(peso × MAIOR valor)`, e uma questão com maior ≠ 1,2 deslocaria
 * toda nota daquele perfil sem nada acusar erro.
 *
 * A escala vem do BACKEND (`/acervo/questoes/escala`), medida do acervo — não
 * escrita aqui. Duas cópias de uma escala envelhecem diferente, e esta decide
 * denominador de nota.
 */
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Info, ListOrdered } from 'lucide-react';
import { questoes as api, mensagemDoErro } from '../services/api';
import type { ClassificacaoDoAcervo, EscalaDoAcervo, QuestaoDoAcervo } from '../services/api';
import { Modal } from '../components/Modal';

/** Número com vírgula: 1.2 -> "1,2". */
const num = (v: number) => Number(v.toFixed(2)).toString().replace('.', ',');

/**
 * Os rótulos de nível. São ORIENTAÇÃO, não texto gravado: o que vai para o
 * banco é o que a pessoa escreve. Estão aqui porque "1ª alternativa" não diz
 * nada, e "a pior situação" diz.
 */
const NIVEIS = [
  { titulo: 'A pior situação', dica: 'o comportamento que não atende — ex.: "Falta muito ao trabalho, com ou sem justificativa."' },
  { titulo: 'Abaixo do esperado', dica: 'atende em parte' },
  { titulo: 'O esperado', dica: 'o que se espera de quem faz bem o trabalho' },
  { titulo: 'A melhor situação', dica: 'o padrão que se quer premiar' },
];

export function FormularioDeQuestao({
  questao,
  classificacoes,
  aoFechar,
  aoSalvar,
}: {
  /** `null` = criar. */
  questao: QuestaoDoAcervo | null;
  classificacoes: ClassificacaoDoAcervo[];
  aoFechar: () => void;
  aoSalvar: (aviso?: string) => void;
}) {
  const [escala, setEscala] = useState<EscalaDoAcervo | null>(null);
  const [enunciado, setEnunciado] = useState(questao?.enunciado ?? '');
  const [classificacaoId, setClassificacaoId] = useState(
    questao?.classificacaoId ?? classificacoes[0]?.id ?? '',
  );
  const [textos, setTextos] = useState<string[]>(
    questao?.alternativas.map((a) => a.descricao) ?? [],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .escala()
      .then((e) => {
        setEscala(e);
        setTextos((t) => (t.length === e.valores.length ? t : Array(e.valores.length).fill('')));
      })
      .catch((e) => setErro(mensagemDoErro(e, 'Não foi possível ler a escala do acervo.')));
  }, []);

  const faltando = useMemo(
    () => (enunciado.trim().length < 3 ? 1 : 0) + textos.filter((t) => t.trim().length < 3).length,
    [enunciado, textos],
  );

  async function salvar() {
    if (!escala) return;
    setErro(null);
    setSalvando(true);
    try {
      const dados = {
        enunciado,
        classificacaoId,
        ancoras: textos.map((descricao, i) => ({ descricao, valor: escala.valores[i] })),
      };
      if (questao) {
        await api.editar(questao.id, dados);
        aoSalvar();
      } else {
        const r = await api.criar(dados);
        aoSalvar(r.aviso);
      }
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível salvar a questão.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={questao ? `Editar a questão ${questao.codigo}` : 'Nova questão'} aoFechar={aoFechar} largura="ampla">
      {/* ⭐⭐ O AVISO DE TAMANHO, ANTES DE QUALQUER CAMPO. */}
      <div className="flex gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
        <ListOrdered size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
        <div className="text-sm text-slate-700">
          <p>
            <strong>Uma questão são cinco textos:</strong> o enunciado e as{' '}
            {escala ? escala.valores.length : 4} alternativas — uma para cada nível, do pior ao
            melhor. É por elas que o avaliador escolhe, então cada uma descreve um{' '}
            <strong>comportamento observável</strong>, não um adjetivo.
          </p>
          <p className="mt-1 text-slate-600">
            A <strong>pontuação já vem pronta</strong> (
            {escala ? escala.valores.map(num).join(' · ') : '…'}) e é a mesma de todas as questões
            do acervo — não há o que decidir aí.
          </p>
        </div>
      </div>

      {escala?.doFallback && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          O acervo está vazio: esta será a primeira questão, e a escala dela vira o padrão das
          próximas.
        </p>
      )}
      {escala && !escala.uniforme && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          O acervo tem mais de uma escala ({escala.divergentes.join(', ')}). Não dá para criar
          questão enquanto isso não for resolvido — a nova congelaria a escala errada.
        </p>
      )}

      <label className="mt-4 block">
        <span className="text-sm font-medium text-slate-700">
          Enunciado <span className="font-normal text-slate-400">— o que está sendo avaliado</span>
        </span>
        <input
          autoFocus
          value={enunciado}
          onChange={(e) => setEnunciado(e.target.value)}
          placeholder="Assiduidade"
          className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
        />
      </label>

      <label className="mt-3 block">
        <span className="text-sm font-medium text-slate-700">Classificação</span>
        <select
          value={classificacaoId}
          onChange={(e) => setClassificacaoId(e.target.value)}
          className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
        >
          {classificacoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        {/* ⚠️ A consequência escrita: a classificação é quem carrega o peso. */}
        <span className="mt-1 block text-xs text-slate-500">
          É a classificação que carrega o peso dentro de cada perfil — a questão herda esse peso
          repartido com as outras da mesma classificação.
        </span>
      </label>

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-slate-700">
          As alternativas, do pior ao melhor
        </legend>
        <ul className="mt-1.5 space-y-2">
          {(escala?.valores ?? []).map((valor, i) => (
            <li key={i} className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
              <span className="mt-2 w-full shrink-0 text-sm text-slate-500 sm:w-44">
                <strong className="block text-slate-700">{NIVEIS[i]?.titulo ?? `Nível ${i + 1}`}</strong>
                <span className="font-mono tabular-nums text-slate-400">vale {num(valor)}</span>
              </span>
              <input
                value={textos[i] ?? ''}
                onChange={(e) =>
                  setTextos((t) => t.map((x, j) => (j === i ? e.target.value : x)))
                }
                placeholder={NIVEIS[i]?.dica ?? ''}
                className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </li>
          ))}
        </ul>
      </fieldset>

      {erro && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {/* ⭐ Quantos textos faltam, não "preencha os campos obrigatórios":
            o número diz de quanto é o resto do trabalho. */}
        {faltando > 0 && (
          <span className="mr-auto text-sm text-slate-500">
            {faltando === 1 ? 'Falta 1 texto' : `Faltam ${faltando} textos`}
          </span>
        )}
        <button
          type="button"
          onClick={aoFechar}
          className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={salvando || faltando > 0 || !escala || !escala.uniforme || !classificacaoId}
          onClick={() => void salvar()}
          className="alvo-toque rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {questao ? 'Salvar' : 'Criar questão'}
        </button>
      </div>
    </Modal>
  );
}
