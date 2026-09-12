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
 * ⭐ **Deixou de ser leitura pura em 12/09 (Etapa 6):** criar, editar,
 * desativar e apagar questão são daqui. O rótulo do menu não mudou — ele nomeia
 * o OBJETO, e era essa a razão de tê-lo escolhido assim.
 *
 * ⚠️ Cada botão que pode recusar é desabilitado **com o motivo**, e o motivo é a
 * frase que a API devolveria (`GET /acervo/questoes/:id/efeitos`). As duas
 * recusas duras têm causas diferentes e não se confundem: **resposta gravada**
 * trava o TEXTO (reescrever muda o que a pessoa respondeu), **estar em arranjo**
 * trava a CLASSIFICAÇÃO (o peso é derivado dela).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Ban, Check, FileStack, Info, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { acervo, ehFaltaDePermissao, mensagemDoErro, questoes as apiQuestoes } from '../services/api';
import type {
  AcervoCompleto,
  ClassificacaoDoAcervo,
  QuestaoDoAcervo,
} from '../services/api';
import { Modal } from '../components/Modal';
import { FormularioDeQuestao } from './FormularioDeQuestao';
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
  /** `undefined` = fechado · `null` = criando · questão = editando. */
  const [editando, setEditando] = useState<QuestaoDoAcervo | null | undefined>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);
  /** `false` quando a conta LÊ o acervo mas não pode escrever nele (RH_CICLO). */
  const [podeEditar, setPodeEditar] = useState(false);

  const carregar = useCallback(() => {
    acervo
      .listar()
      .then(setDados)
      .catch((e) => {
        if (ehFaltaDePermissao(e)) setSemPermissao(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar o acervo.'));
      });
  }, []);

  useEffect(carregar, [carregar]);

  /**
   * ⚠️ Quem pode ESCREVER é pergunta separada de quem pode LER — `/acervo`
   * aceita os três papéis de RH e o editor só dois. Descubro perguntando ao
   * backend (a escala é a rota mais barata do editor), em vez de reimplementar
   * a tabela de papéis aqui: uma segunda cópia do RBAC mostraria botão que a
   * API recusa, que é a §3.1.33 outra vez.
   */
  useEffect(() => {
    apiQuestoes
      .escala()
      .then(() => setPodeEditar(true))
      .catch(() => setPodeEditar(false));
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <FileStack size={20} className="text-slate-400" aria-hidden />
          Acervo de questões
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Cada questão existe <strong>uma vez</strong> e os perfis a usam. A mesma questão pode
          pesar diferente em cada um — é o peso do grupo naquele perfil, repartido entre as questões
          dele pela mesma regra que a avaliação usa para calcular a nota.
        </p>
        </div>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setEditando(null)}
            className="alvo-toque inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-medium text-white"
          >
            <Plus size={15} aria-hidden /> Nova questão
          </button>
        )}
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
            {/* ⚠️ "fora de todo perfil" conta quem não está em arranjo NENHUM —
                rascunho inclusive. O cartão de uma questão só em rascunho diz
                "usada em 1 perfil — só em rascunho", e os dois pareciam
                discordar. Não discordam: são recortes diferentes, e agora o
                termo que os concilia está escrito. */}
            <span className="text-amber-800">
              <strong className="tabular-nums">{dados.foraDeTodoPerfil}</strong> fora de todo perfil
              <span className="ml-1 text-slate-500">(nem em rascunho)</span>
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

      {/* ⚠️ O aviso sobrevive só para quem NÃO pode escrever. Mantê-lo para
          quem tem o botão ao lado seria a tela se contradizendo. */}
      {!podeEditar && (
        <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <Info size={15} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
          <span>
            Para você esta tela é de <strong>leitura</strong>. Criar e editar questão é de quem
            monta o instrumento (RH_ADMIN ou RH_MODELO).
          </span>
        </p>
      )}

      {/* ⭐⭐ O aviso da criação — "criada" e "criada, e ainda não está em
          nenhum perfil" são frases diferentes. Vem do BACKEND, junto com a
          questão, para ser a mesma frase em qualquer cliente. */}
      {aviso && (
        <p className="mt-4 flex items-start gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span className="flex-1">{aviso}</span>
          <button type="button" onClick={() => setAviso(null)} className="shrink-0 underline">
            ok
          </button>
        </p>
      )}

      <ol className="mt-3 space-y-3">
        {visiveis.map((q) => (
          <li key={q.id}>
            <CartaoDaQuestao
              questao={q}
              podeEditar={podeEditar}
              aoEditar={() => setEditando(q)}
              aoMudar={carregar}
            />
          </li>
        ))}
        {visiveis.length === 0 && (
          <li>
            <Vazio titulo="Nada aqui" detalhe="Nenhuma questão corresponde ao filtro." />
          </li>
        )}
      </ol>

      {editando !== undefined && (
        <FormularioDeQuestao
          questao={editando}
          classificacoes={dados.classificacoes.filter(
            (c): c is ClassificacaoDoAcervo => c.ativa || c.id === editando?.classificacaoId,
          )}
          aoFechar={() => setEditando(undefined)}
          aoSalvar={(a) => {
            setEditando(undefined);
            if (a) setAviso(a);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function CartaoDaQuestao({
  questao: q,
  podeEditar,
  aoEditar,
  aoMudar,
}: {
  questao: QuestaoDoAcervo;
  podeEditar: boolean;
  aoEditar: () => void;
  aoMudar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * ⭐⭐ O BLOQUEIO VEM COM A LISTA — `q.efeitos`, do próprio `GET /acervo`.
   *
   * ⚠️ Até 12/09 ele era buscado no primeiro hover do cartão, "para não fazer
   * 15 consultas na abertura". O resultado é que a `005` (19 respostas) e a
   * `016` (em 1 perfil) **nasciam com Editar e Apagar habilitados e sem
   * aviso**, e só desabilitavam depois de uma interação. Tela que decide
   * habilitar com dado que chega depois do primeiro render mostra, no
   * intervalo, exatamente o oposto da verdade — e o intervalo é onde a pessoa
   * clica. Ver §3.1.104.
   */
  const efeitos = q.efeitos;

  async function agir(f: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await f();
      aoMudar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível concluir.'));
    } finally {
      setOcupado(false);
      setConfirmando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{q.enunciado}</h3>
            <Etiqueta tom="neutro">{q.classificacaoNome}</Etiqueta>
            {!q.ativa && <Etiqueta tom="ambar">Inativa</Etiqueta>}
          </div>
          {/* ⚠️ "RD8010" era verdade quando todas vinham do Protheus. Questão
              criada aqui recebe código com prefixo `C` — dizer RD8010 nela
              seria atribuir ao Protheus uma decisão do RH. */}
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            {/^\d+$/.test(q.codigo) ? `RD8010 ${q.codigo}` : `criada aqui · ${q.codigo}`} · vale até{' '}
            {num(q.maiorValor)} por questão
          </p>
        </div>

        {podeEditar && (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <BotaoDoCartao
              rotulo="Editar"
              icone={<Pencil size={15} aria-hidden />}
              efeito={efeitos.editarTexto}
              ocupado={ocupado}
              aoClicar={aoEditar}
            />
            {q.ativa ? (
              <BotaoDoCartao
                rotulo="Desativar"
                icone={<Ban size={15} aria-hidden />}
                efeito={efeitos.desativar}
                ocupado={ocupado}
                aoClicar={() => void agir(() => apiQuestoes.desativar(q.id))}
              />
            ) : (
              <BotaoDoCartao
                rotulo="Reativar"
                icone={<Check size={15} aria-hidden />}
                efeito={efeitos.reativar}
                ocupado={ocupado}
                aoClicar={() => void agir(() => apiQuestoes.reativar(q.id))}
              />
            )}
            <BotaoDoCartao
              rotulo="Apagar"
              icone={<Trash2 size={15} aria-hidden />}
              tom="perigo"
              efeito={efeitos.apagar}
              ocupado={ocupado}
              aoClicar={() => setConfirmando(true)}
            />
          </div>
        )}
      </div>

      {erro && (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-sm text-red-800">{erro}</p>
      )}

      {/* ⭐ O motivo da recusa fica VISÍVEL quando é o texto que está travado —
          é a recusa que mais surpreende, porque "corrigir um acento" parece
          inofensivo e não é depois que alguém respondeu. */}
      {podeEditar && efeitos.editarTexto.acao === 'RECUSAR' && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          {efeitos.editarTexto.frase}
        </p>
      )}

      {/* ⚠️ BLOQUEADA: o diálogo mostra o MOTIVO e uma saída, nunca a ação
          destrutiva. Até 12/09 ele renderizava o texto da recusa no lugar do
          texto de confirmação — com o botão vermelho "Apagar" ATIVO ao lado.
          Quem lesse rápido clicaria; quem lesse devagar entenderia que o
          sistema está pedindo confirmação de algo que ele mesmo recusa. */}
      {confirmando && efeitos.apagar.acao === 'RECUSAR' && (
        <Modal titulo={`Não dá para apagar a ${q.codigo}`} aoFechar={() => setConfirmando(false)}>
          <p className="text-sm text-slate-700">{efeitos.apagar.frase}</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="alvo-toque rounded-xl bg-slate-800 px-4 text-sm font-medium text-white"
            >
              Entendi
            </button>
          </div>
        </Modal>
      )}

      {confirmando && efeitos.apagar.acao === 'PERMITIR' && (
        <Modal titulo={`Apagar a questão ${q.codigo}?`} aoFechar={() => setConfirmando(false)}>
          <p className="text-sm text-slate-700">{efeitos.apagar.frase}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void agir(() => apiQuestoes.apagar(q.id))}
              className="alvo-toque rounded-xl bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Apagar
            </button>
          </div>
        </Modal>
      )}

      {/* ⭐⭐ ONDE ELA É USADA — o campo que dá sentido à lista. Responde
          "mexer nesta questão afeta quem?", que é o que se pergunta antes de
          mexer. E o peso é o EFETIVO de cada perfil, não o do grupo. */}
      {q.usos.length > 0 ? (
        <div className="mt-2">
          {/* ⚠️ "usada em 1 perfil" e "usada em 1 perfil, só em rascunho" são
              fatos diferentes: o segundo quer dizer que NINGUÉM responde esta
              questão ainda. Antes o rascunho aparecia só como uma etiqueta
              pequena ao lado do peso, e o fato se perdia entre os outros usos. */}
          {/* ⚠️ PERFIS, não versões. Dizia "usada em 7 perfis" para uma questão
              que está em 5 perfis e 7 versões — contava versão e chamava de
              perfil, inflando justamente o número que responde "mexer nisto
              afeta quem?". As versões continuam listadas abaixo, uma a uma. */}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Usada em {contagem(q.perfisDistintos, 'perfil', 'perfis')}
            {q.usos.length !== q.perfisDistintos && (
              <span className="ml-1 normal-case text-slate-500">
                ({contagem(q.usos.length, 'versão', 'versões')})
              </span>
            )}
            {q.usosPublicados === 0 && (
              <span className="ml-1 text-amber-700">
                — só em rascunho, ninguém responde ainda
              </span>
            )}
            {q.usosPublicados > 0 && q.perfisPublicados < q.perfisDistintos && (
              <span className="ml-1 normal-case text-slate-500">
                · {q.perfisPublicados} com versão publicada
              </span>
            )}
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

/**
 * ⭐ Botão cujo estado vem do CLASSIFICADOR do backend.
 *
 * ⚠️ `efeito` é OBRIGATÓRIO desde 12/09. Ele era opcional, com a justificativa
 * de que "indefinido = ainda não perguntei, e aí o botão fica habilitado
 * porque quem decide é a API". A justificativa está errada pelo meio: a API
 * decide o que ACONTECE, mas a tela decide o que a pessoa TENTA — e um botão
 * habilitado sobre uma questão com 19 respostas convida a um clique que só vai
 * ser recusado depois. O tipo não-opcional é o que garante que o dado venha
 * com a lista. Ver §3.1.104.
 */
function BotaoDoCartao({
  rotulo,
  icone,
  tom = 'neutro',
  efeito,
  ocupado,
  aoClicar,
}: {
  rotulo: string;
  icone: React.ReactNode;
  tom?: 'neutro' | 'perigo';
  efeito: { acao: 'PERMITIR' | 'RECUSAR'; frase: string };
  ocupado: boolean;
  aoClicar: () => void;
}) {
  const bloqueado = efeito.acao === 'RECUSAR';
  return (
    <button
      type="button"
      title={efeito.frase}
      onClick={aoClicar}
      disabled={ocupado || bloqueado}
      className={`alvo-toque inline-flex items-center gap-1.5 rounded-lg border px-2.5 text-sm disabled:opacity-30 ${
        tom === 'perigo'
          ? 'border-red-200 text-red-700 hover:bg-red-50'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {icone}
      {rotulo}
    </button>
  );
}
