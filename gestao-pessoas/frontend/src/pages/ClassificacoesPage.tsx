/**
 * ⭐ CADASTRO DAS CLASSIFICAÇÕES — Etapa 5 do editor.
 *
 * A classificação é a peça que carrega o PESO no arranjo de cada perfil: a
 * questão herda dela quanto vale. Mexer aqui é mexer na estrutura da nota — mas
 * só potencialmente, porque nada chega a um ciclo enquanto uma versão não for
 * publicada.
 *
 * ⚠️ **Todo botão que pode recusar é desabilitado COM o motivo**, e o motivo é
 * a frase que a API devolveria: `efeitoDeApagar`, `efeitoDeDesativar` e
 * `efeitoDeReativar` vêm prontos do backend. A tela não reimplementa nenhuma
 * das três regras — se reimplementasse, ela liberaria o que a API recusa.
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Info, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { classificacoes as api, ehFaltaDePermissao, mensagemDoErro } from '../services/api';
import type { ClassificacaoDoCadastro } from '../services/api';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { Modal } from '../components/Modal';
import { contagem } from '../lib/formato';

export default function ClassificacoesPage() {
  const [lista, setLista] = useState<ClassificacaoDoCadastro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [editando, setEditando] = useState<{ id: string; nome: string } | null>(null);
  const [confirmando, setConfirmando] = useState<ClassificacaoDoCadastro | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(() => {
    api
      .listar()
      .then(setLista)
      .catch((e) => {
        if (ehFaltaDePermissao(e)) setSemPermissao(true);
        else setErro(mensagemDoErro(e, 'Não foi possível carregar as classificações.'));
      });
  }, []);

  useEffect(carregar, [carregar]);

  async function agir(f: () => Promise<unknown>) {
    setErro(null);
    setOcupado(true);
    try {
      await f();
      carregar();
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível concluir.'));
    } finally {
      setOcupado(false);
    }
  }

  /**
   * ⚠️ Reordenar manda a lista INTEIRA, mesmo quando o gesto é "sobe um". Um
   * PATCH por item deixaria duas na mesma posição se falhasse no meio — e a
   * lista continuaria com todos os itens, então ninguém veria.
   */
  function mover(i: number, direcao: -1 | 1) {
    if (!lista) return;
    const alvo = i + direcao;
    if (alvo < 0 || alvo >= lista.length) return;
    const ids = lista.map((c) => c.id);
    [ids[i], ids[alvo]] = [ids[alvo], ids[i]];
    void agir(() => api.reordenar(ids));
  }

  if (semPermissao) {
    return (
      <div className="px-4 pt-5">
        <Vazio
          titulo="Sem permissão para o cadastro de classificações"
          detalhe="Mexer nas classificações é do RH_ADMIN ou do RH_MODELO — quem monta o instrumento."
        />
      </div>
    );
  }
  if (!lista) return <Carregando />;

  return (
    <div className="px-4 pb-24 pt-5">
      <header>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
          <Tags size={20} className="text-slate-400" aria-hidden />
          Classificações
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Toda questão do acervo pertence a uma classificação, e é a classificação que carrega o{' '}
          <strong>peso</strong> dentro de cada perfil. A questão herda esse peso dividido entre as
          questões da mesma classificação naquele perfil.
        </p>
      </header>

      {/* ⭐ O que esta tela NÃO faz. Sem isto, quem cria uma classificação aqui
          espera vê-la valendo alguma coisa — e ela não vale nada até alguém
          declarar o peso dela num perfil, que é outra tela. */}
      <div className="mt-3 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Info size={16} className="mt-0.5 shrink-0 text-slate-500" aria-hidden />
        <p className="text-sm text-slate-700">
          Criar uma classificação aqui <strong>não a coloca em nenhum perfil</strong>. Ela só passa
          a valer quando um perfil declarar quanto ela pesa — e isso muda a nota apenas depois de a
          versão ser publicada.
        </p>
      </div>

      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro} />
        </div>
      )}

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!novoNome.trim()) return;
          void agir(() => api.criar(novoNome)).then(() => setNovoNome(''));
        }}
      >
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nova classificação"
          className="alvo-toque min-w-[14rem] flex-1 rounded-xl border border-slate-300 px-3 text-slate-800"
        />
        <button
          type="submit"
          disabled={ocupado || novoNome.trim().length < 2}
          className="alvo-toque inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus size={15} aria-hidden /> Criar
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {lista.map((c, i) => (
          <li
            key={c.id}
            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800">{c.nome}</span>
                  {!c.ativa && <Etiqueta tom="ambar">Inativa</Etiqueta>}
                </div>
                {/* ⚠️ Os dois números que dizem se mexer nela é barato: quantas
                    questões estão nela, e em quantos perfis ela pesa. */}
                <p className="mt-1 text-sm text-slate-500">
                  {contagem(c.questoes, 'questão', 'questões')} no acervo ·{' '}
                  {c.arranjos === 0
                    ? 'nenhum perfil declara peso para ela'
                    : `${contagem(c.arranjos, 'perfil', 'perfis')} ${
                        c.arranjosPublicados > 0
                          ? `(${c.arranjosPublicados} publicado${c.arranjosPublicados === 1 ? '' : 's'})`
                          : '(nenhum publicado)'
                      }`}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Botao
                  titulo="Subir"
                  aoClicar={() => mover(i, -1)}
                  desabilitado={ocupado || i === 0}
                >
                  <ArrowUp size={15} aria-hidden />
                </Botao>
                <Botao
                  titulo="Descer"
                  aoClicar={() => mover(i, 1)}
                  desabilitado={ocupado || i === lista.length - 1}
                >
                  <ArrowDown size={15} aria-hidden />
                </Botao>
                <Botao
                  titulo="Renomear"
                  aoClicar={() => setEditando({ id: c.id, nome: c.nome })}
                  desabilitado={ocupado}
                >
                  <Pencil size={15} aria-hidden />
                </Botao>
                {c.ativa ? (
                  <BotaoDeEfeito
                    rotulo="Desativar"
                    efeito={c.efeitoDeDesativar}
                    ocupado={ocupado}
                    aoClicar={() => agir(() => api.desativar(c.id))}
                  />
                ) : (
                  <BotaoDeEfeito
                    rotulo="Reativar"
                    efeito={c.efeitoDeReativar}
                    ocupado={ocupado}
                    aoClicar={() => agir(() => api.reativar(c.id))}
                  />
                )}
                <BotaoDeEfeito
                  rotulo="Apagar"
                  icone={<Trash2 size={15} aria-hidden />}
                  tom="perigo"
                  efeito={c.efeitoDeApagar}
                  ocupado={ocupado}
                  aoClicar={() => setConfirmando(c)}
                />
              </div>
            </div>

            {/* ⭐ O motivo fica VISÍVEL, não só no title: botão cinza sem
                explicação manda a pessoa procurar o que ela fez de errado. */}
            {c.efeitoDeApagar.acao === 'RECUSAR' && (
              <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
                Não dá para apagar: {c.efeitoDeApagar.frase}
              </p>
            )}
          </li>
        ))}
      </ul>

      {lista.length === 0 && (
        <div className="mt-4">
          <Vazio titulo="Nenhuma classificação cadastrada" />
        </div>
      )}

      {editando && (
        <Modal titulo="Renomear classificação" aoFechar={() => setEditando(null)}>
          <input
            autoFocus
            value={editando.nome}
            onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
          />
          <p className="mt-2 text-sm text-slate-500">
            O nome aparece no acervo e no questionário impresso. Renomear não muda peso nenhum.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(null)}
              className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
            >
              <X size={15} className="mr-1 inline" aria-hidden /> Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || editando.nome.trim().length < 2}
              onClick={() =>
                void agir(() => api.renomear(editando.id, editando.nome)).then(() =>
                  setEditando(null),
                )
              }
              className="alvo-toque rounded-xl bg-slate-800 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              <Check size={15} className="mr-1 inline" aria-hidden /> Salvar
            </button>
          </div>
        </Modal>
      )}

      {confirmando && (
        <Modal titulo={`Apagar "${confirmando.nome}"?`} aoFechar={() => setConfirmando(null)}>
          <p className="text-sm text-slate-700">{confirmando.efeitoDeApagar.frase}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(null)}
              className="alvo-toque rounded-xl border border-slate-300 px-4 text-sm text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                void agir(() => api.apagar(confirmando.id)).then(() => setConfirmando(null))
              }
              className="alvo-toque rounded-xl bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Apagar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Botao({
  titulo,
  aoClicar,
  desabilitado,
  children,
}: {
  titulo: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={aoClicar}
      disabled={desabilitado}
      className="alvo-toque inline-flex items-center justify-center rounded-lg border border-slate-300 px-2 text-slate-600 hover:bg-slate-50 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * ⭐⭐ Botão cujo estado vem do CLASSIFICADOR do backend, não de uma regra
 * escrita aqui. Desabilitado, o motivo é o `title` **e** o texto abaixo do
 * cartão — esconder o botão faria a capacidade sumir sem explicação.
 */
function BotaoDeEfeito({
  rotulo,
  icone,
  tom = 'neutro',
  efeito,
  ocupado,
  aoClicar,
}: {
  rotulo: string;
  icone?: React.ReactNode;
  tom?: 'neutro' | 'perigo';
  efeito: { acao: 'PERMITIR' | 'RECUSAR'; frase: string };
  ocupado: boolean;
  aoClicar: () => void;
}) {
  const bloqueado = efeito.acao === 'RECUSAR';
  return (
    <button
      type="button"
      title={bloqueado ? efeito.frase : efeito.frase}
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
