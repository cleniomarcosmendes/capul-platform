/**
 * ⭐⭐ O ACERVO — as questões que existem, e onde cada uma é usada.
 *
 * Até aqui a única tela que mostrava questão era a do INSTRUMENTO
 * (`/questionarios`), que lê **um perfil por vez** — e ali as 15 questões
 * aparecem como 39 linhas, repetidas em cada perfil que as usa. A pergunta
 * *"quais questões existem?"* não tinha tela.
 *
 * ⭐ O campo que dá sentido à lista não é o enunciado — é **onde cada questão é
 * usada, e com que peso**. Sem ele isto é um catálogo sem consequência; com
 * ele, responde *"mexer nesta questão afeta quem?"*, que é o que se pergunta
 * antes de mexer.
 *
 * ⚠️ **LEITURA PURA**, como a `/questionarios` quando nasceu — e pelo mesmo
 * motivo: tela que parece editável e não é seria promessa de capacidade. Aqui
 * não há botão de salvar, nem campo; há o aviso dizendo por onde a mudança
 * passa hoje. Editar é a Etapa 6 deste plano; quando existir, o rótulo do menu
 * não muda — a tela é que ganha o que fazer.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, FileStack, Info, Search } from 'lucide-react';
import { acervo, ehFaltaDePermissao, mensagemDoErro } from '../services/api';
import type { AcervoCompleto, QuestaoDoAcervo } from '../services/api';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { contagem, flexao } from '../lib/formato';

/** Número com até 2 casas e vírgula: 5.33 -> "5,33", 6 -> "6". */
function num(v: number): string {
  return Number(v.toFixed(2)).toString().replace('.', ',');
}

export default function AcervoPage() {
  const [dados, setDados] = useState<AcervoCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [classificacao, setClassificacao] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    acervo
      .listar()
      .then(setDados)
      .catch((e) => {
        if (ehFaltaDePermissao(e)) setSemPermissao(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar o acervo.'));
      });
  }, []);

  if (semPermissao) {
    return (
      <Vazio
        titulo="Sem acesso ao acervo"
        detalhe="Ler o instrumento é de quem monta modelo ou ciclo. Falar com quem administra o módulo."
      />
    );
  }
  if (erro) return <Erro mensagem={erro} />;
  if (!dados) return <Carregando />;

  const visiveis = dados.questoes
    .filter((q) => !classificacao || q.classificacaoId === classificacao)
    .filter((q) => {
      const t = busca.trim().toLowerCase();
      return !t || q.enunciado.toLowerCase().includes(t) || q.codigo.includes(t);
    });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <FileStack size={20} className="text-slate-400" aria-hidden />
          Acervo de questões
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Cada questão existe <strong>uma vez</strong> e os perfis a usam. A mesma questão pode
          pesar diferente em cada um — é o peso do grupo naquele perfil, repartido entre as questões
          dele pela mesma regra que a avaliação usa para calcular a nota.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <span>
          <strong className="tabular-nums text-slate-800">{dados.totalQuestoes}</strong>{' '}
          {flexao(dados.totalQuestoes, 'questão', 'questões')}
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong className="tabular-nums text-slate-800">{dados.classificacoes.length}</strong>{' '}
          {flexao(dados.classificacoes.length, 'classificação', 'classificações')}
        </span>
        {/* ⚠️ SÓ APARECE QUANDO EXISTE — é termo de conciliação, como o "fora do
            ciclo" da linha de estado. "0 fora de perfil" é ruído numa linha que
            se lê de relance. */}
        {dados.foraDeTodoPerfil > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="text-amber-800">
              <strong className="tabular-nums">{dados.foraDeTodoPerfil}</strong> fora de todo perfil
            </span>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-52 flex-1">
          <span className="text-sm font-medium text-slate-700">Classificação</span>
          <select
            value={classificacao}
            onChange={(e) => setClassificacao(e.target.value)}
            className="alvo-toque mt-1.5 w-full rounded-xl border border-slate-300 px-3 text-slate-800"
          >
            <option value="">Todas ({dados.totalQuestoes})</option>
            {dados.classificacoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.questoes})
              </option>
            ))}
          </select>
        </label>
        <div className="relative min-w-52 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Enunciado ou código"
            aria-label="Buscar questão"
            className="alvo-toque w-full rounded-xl border border-slate-300 pl-9 pr-3 text-slate-800"
          />
        </div>
      </div>

      <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <Info size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
        <span>
          Esta tela é de <strong>leitura</strong>. Hoje a mudança no acervo passa pela T.I. — o
          editor está em construção, e quando existir ele aparece aqui.
        </span>
      </p>

      <ol className="mt-3 space-y-3">
        {visiveis.map((q) => (
          <li key={q.id}>
            <CartaoDaQuestao questao={q} />
          </li>
        ))}
        {visiveis.length === 0 && (
          <li>
            <Vazio titulo="Nada aqui" detalhe="Nenhuma questão corresponde ao filtro." />
          </li>
        )}
      </ol>
    </div>
  );
}

function CartaoDaQuestao({ questao: q }: { questao: QuestaoDoAcervo }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{q.enunciado}</h3>
            <Etiqueta tom="neutro">{q.classificacaoNome}</Etiqueta>
            {!q.ativa && <Etiqueta tom="ambar">Inativa</Etiqueta>}
          </div>
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            RD8010 {q.codigo} · vale até {num(q.maiorValor)} por questão
          </p>
        </div>
      </div>

      {/* ⭐⭐ ONDE ELA É USADA — o campo que dá sentido à lista. Responde
          "mexer nesta questão afeta quem?", que é o que se pergunta antes de
          mexer. E o peso é o EFETIVO de cada perfil, não o do grupo. */}
      {q.usos.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Usada em {contagem(q.usos.length, 'perfil', 'perfis')}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
            {q.usos.map((u) => (
              <li key={u.modeloVersaoId}>
                {u.modeloNome} <span className="text-slate-400">v{u.versao}</span> ·{' '}
                {/* ⚠️ `null` é arranjo INCOMPLETO (classificação sem peso naquele
                    perfil), não peso zero. Escrever "peso 0" diria que a questão
                    não conta; ela conta, e ninguém sabe quanto ainda. */}
                {u.peso === null ? (
                  <strong className="text-amber-700">sem peso</strong>
                ) : (
                  <strong className="tabular-nums">peso {num(u.peso)}</strong>
                )}
                {!u.publicado && <span className="ml-1 text-amber-700">(rascunho)</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /* ⚠️ "criada" e "criada, e ainda não está em nenhum perfil" são frases
           diferentes — a primeira deixa quem criou achando que já vale. Questão
           fora de arranjo é invisível para avaliação, contagem e apuração:
           nenhuma consulta do módulo lê `pergunta` direto. */
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Não está em <strong>nenhum perfil</strong> — existe no acervo e não entra em avaliação
          nenhuma. Para valer, precisa ser incluída no questionário de um perfil.
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-capul-700">
          As {contagem(q.alternativas.length, 'alternativa', 'alternativas')}
        </summary>
        <ul className="mt-1.5 space-y-1">
          {q.alternativas.map((a) => (
            <li key={a.id} className="flex gap-2 text-sm text-slate-600">
              <span className="w-10 shrink-0 text-right font-mono tabular-nums text-slate-400">
                {num(a.valor)}
              </span>
              <span>{a.descricao}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
