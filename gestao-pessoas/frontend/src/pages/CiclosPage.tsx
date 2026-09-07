import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, ChevronRight, Lock, Plus, Unlock } from 'lucide-react';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { EtiquetaDeCiclo } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { data } from '../lib/formato';
import { ciclos, ehFaltaDePermissao, mensagemDoErro, type CicloDaLista, type NovoCiclo } from '../services/api';
import { Modal } from '../components/Modal';

/**
 * CICLOS — a lista de ciclos e a criação de um novo.
 *
 * ⭐ ABRIR é o ponto sem volta do módulo: a partir dele começam a nascer notas.
 * Por isso a tela não esconde a recusa do backend atrás de "erro ao abrir": a
 * validação de abertura devolve a LISTA de problemas (conceitos com buraco,
 * critério sem resolver, modelo de demonstração) e cada um deles vira uma linha
 * aqui. Recusa que não diz o que fazer só transfere o trabalho de descobrir.
 */
export default function CiclosPage() {
  const { tem } = useAuth();
  const [lista, setLista] = useState<CicloDaLista[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    void carregar();
  }, []);

  async function carregar() {
    setErro(null);
    try {
      setLista(await ciclos.listar());
    } catch (e) {
      setSemPermissao(ehFaltaDePermissao(e));
      setErro(mensagemDoErro(e, 'Não foi possível carregar os ciclos.'));
    }
  }

  return (
    <div className="px-4 pb-24 pt-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Ciclos de avaliação</h2>
          <p className="text-sm text-slate-500">Período, data-base e régua de conceitos.</p>
        </div>
        {tem(ROLES.RH_ADMIN, ROLES.RH_CICLO) && (
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="alvo-toque inline-flex shrink-0 items-center gap-2 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-capul-700"
          >
            <Plus size={16} aria-hidden /> Novo ciclo
          </button>
        )}
      </div>

      {erro && (
        <Erro
          mensagem={erro}
          aoTentarDeNovo={semPermissao ? undefined : carregar}
          dica={semPermissao ? 'Este quadro é do RH — peça acesso à gestora.' : undefined}
        />
      )}

      {!erro && !lista && <Carregando />}

      {lista?.length === 0 && (
        <Vazio
          titulo="Nenhum ciclo criado"
          detalhe="O ciclo é o contêiner: define o período avaliado, a data-base que congela todo cálculo temporal e a régua de conceitos."
        />
      )}

      {lista && lista.length > 0 && (
        <ul className="space-y-2">
          {lista.map((c) => (
            <li key={c.id}>
              <CartaoDeCiclo ciclo={c} aoMudar={carregar} />
            </li>
          ))}
        </ul>
      )}

      {criando && (
        <DialogoNovoCiclo
          aoFechar={() => setCriando(false)}
          aoCriar={async (dados) => {
            await ciclos.criar(dados);
            setCriando(false);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

function CartaoDeCiclo({ ciclo, aoMudar }: { ciclo: CicloDaLista; aoMudar: () => Promise<void> }) {
  const { tem } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [problemas, setProblemas] = useState<string[] | null>(null);
  const [confirmandoAbrir, setConfirmandoAbrir] = useState(false);

  async function agir(acao: 'abrir' | 'encerrar') {
    setConfirmandoAbrir(false);
    setProblemas(null);
    setOcupado(true);
    try {
      await (acao === 'abrir' ? ciclos.abrir(ciclo.id) : ciclos.encerrar(ciclo.id));
      await aoMudar();
    } catch (e) {
      // A validação de abertura devolve um ARRAY de problemas. Juntar tudo numa
      // frase só faria a gestora ler seis pendências como se fossem uma.
      const bruto = (e as { response?: { data?: { message?: string | string[] } } }).response?.data
        ?.message;
      setProblemas(Array.isArray(bruto) ? bruto : [mensagemDoErro(e)]);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{ciclo.nome}</h3>
            <EtiquetaDeCiclo status={ciclo.status} />
            {ciclo.valeParaMerito && (
              <span className="text-xs font-medium text-amber-700">vale para mérito</span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange size={14} aria-hidden />
              {data(ciclo.periodoInicio)} a {data(ciclo.periodoFim)}
            </span>
            <span>
              data-base <strong className="font-medium text-slate-700">{data(ciclo.dataBase)}</strong>
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {ciclo._count.aplicacoes} aplicação(ões) · {ciclo._count.avaliacoes} avaliação(ões)
            {ciclo.incluirAfastados && ' · inclui afastados'}
          </p>
        </div>
        <Link
          to={`/ciclos/${ciclo.id}`}
          className="alvo-toque inline-flex shrink-0 items-center gap-1 self-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:border-capul-300"
        >
          Abrir <ChevronRight size={15} aria-hidden />
        </Link>
      </div>

      {tem(ROLES.RH_ADMIN) && (ciclo.status === 'RASCUNHO' || ciclo.status === 'ABERTO') && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            /**
             * ⚠️ ENCERRAR É A AÇÃO IRREVERSÍVEL DO MÓDULO, e estava clicável com
             * 892 de 894 avaliações por enviar — a única barreira era a frase
             * cinza abaixo. O servidor recusa (e diz quantas faltam), mas
             * descobrir a regra clicando no botão que fecha o ciclo é o tipo de
             * aprendizado que só se quer ter uma vez.
             */
            disabled={ocupado || (ciclo.status !== 'RASCUNHO' && ciclo.avaliacoesPendentes > 0)}
            title={
              ciclo.status !== 'RASCUNHO' && ciclo.avaliacoesPendentes > 0
                ? `${ciclo.avaliacoesPendentes} avaliação(ões) ainda não foram enviadas`
                : undefined
            }
            onClick={() =>
              ciclo.status === 'RASCUNHO' ? setConfirmandoAbrir(true) : agir('encerrar')
            }
            className="alvo-toque inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {ciclo.status === 'RASCUNHO' ? <Unlock size={15} aria-hidden /> : <Lock size={15} aria-hidden />}
            {ocupado ? 'Aguarde…' : ciclo.status === 'RASCUNHO' ? 'Abrir ciclo' : 'Encerrar ciclo'}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            {ciclo.status === 'RASCUNHO'
              ? 'Abrir gera as avaliações e trava a montagem: aplicações e critérios só mudam enquanto é rascunho.'
              : ciclo.avaliacoesPendentes > 0
                ? `Faltam ${ciclo.avaliacoesPendentes} avaliação(ões) por enviar — encerrar só depois que todas entrarem.`
                : 'Todas as avaliações foram enviadas: o ciclo pode ser encerrado.'}
          </p>
        </div>
      )}

      {/* ⭐⭐ CONFIRMAÇÃO DE ABRIR — no molde da do Apurar (§3.1.8): diz o que
          FECHA e o que NÃO VOLTA, antes do clique valer.
          ⚠️ Abrir é a porta mais definitiva do módulo: não existe rota de ABERTO
          para RASCUNHO. Até 07/09 nada avisava — a única frase era a cinza
          embaixo do botão, que se lê depois de clicar. */}
      {confirmandoAbrir && (
        <Modal titulo={`Abrir "${ciclo.nome}"`} aoFechar={() => setConfirmandoAbrir(false)}>
          <p className="text-sm text-slate-700">
            Abrir <strong>libera os avaliadores para responder</strong> — e{' '}
            <strong className="text-amber-800">não tem volta: não existe voltar para rascunho.</strong>
          </p>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-medium">A abertura FECHA:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>criar aplicação e mudar o peso da avaliação ou dos critérios</li>
            </ul>
            <p className="mt-2 font-medium">CONTINUA valendo depois de abrir:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>montar público, designar e apurar</li>
              <li>
                mudar o período do ciclo — a <strong>data-base</strong>, não: ela congela o cálculo
              </li>
            </ul>
          </div>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmandoAbrir(false)}
              className="alvo-toque flex-1 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void agir('abrir')}
              className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ocupado ? 'Abrindo…' : 'Abrir o ciclo'}
            </button>
          </div>
        </Modal>
      )}

      {problemas && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">
            {problemas.length === 1 ? 'Falta resolver:' : `Faltam resolver ${problemas.length} pontos:`}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Régua padrão — contígua por construção (fim de uma = início da próxima). */
const CONCEITOS_PADRAO = [
  { descricao: 'Insuficiente', limiteInferior: 0, limiteSuperior: 25, cor: '#C0392B', ordem: 1 },
  { descricao: 'Abaixo do esperado', limiteInferior: 25, limiteSuperior: 50, cor: '#E67E22', ordem: 2 },
  { descricao: 'Atende', limiteInferior: 50, limiteSuperior: 75, cor: '#F1C40F', ordem: 3 },
  { descricao: 'Supera', limiteInferior: 75, limiteSuperior: 90, cor: '#72BF44', ordem: 4 },
  { descricao: 'Excelente', limiteInferior: 90, limiteSuperior: 100, cor: '#006838', ordem: 5 },
];

function DialogoNovoCiclo({
  aoFechar,
  aoCriar,
}: {
  aoFechar: () => void;
  aoCriar: (dados: NovoCiclo) => Promise<void>;
}) {
  const hoje = new Date();
  const [nome, setNome] = useState(`Avaliação de Desempenho ${hoje.getFullYear()}`);
  const [periodoInicio, setInicio] = useState(`${hoje.getFullYear()}-01-01`);
  const [periodoFim, setFim] = useState(`${hoje.getFullYear()}-12-31`);
  const [dataBase, setDataBase] = useState(iso(hoje));
  const [janela, setJanela] = useState(12);
  const [incluirAfastados, setIncluirAfastados] = useState(false);
  const [valeParaMerito, setMerito] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      await aoCriar({
        nome: nome.trim(),
        periodoInicio,
        periodoFim,
        dataBase,
        janelaTreinamentoMeses: janela,
        incluirAfastados,
        valeParaMerito,
        conceitos: CONCEITOS_PADRAO,
      });
    } catch (e) {
      setErro(mensagemDoErro(e, 'Não foi possível criar o ciclo.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="titulo-novo-ciclo"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
      >
        <h3 id="titulo-novo-ciclo" className="text-lg font-semibold text-slate-800">
          Novo ciclo
        </h3>

        <div className="mt-4 space-y-4">
          <Campo rotulo="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Início do período">
              <input
                type="date"
                value={periodoInicio}
                onChange={(e) => setInicio(e.target.value)}
                className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </Campo>
            <Campo rotulo="Fim do período">
              <input
                type="date"
                value={periodoFim}
                onChange={(e) => setFim(e.target.value)}
                className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
              />
            </Campo>
          </div>

          <Campo
            rotulo="Data-base"
            ajuda="Congela todo cálculo temporal do ciclo — tempo de casa, tempo na função e a janela de treinamento são medidos NESTA data, não em 'hoje'. Reapurar um ciclo antigo tem de devolver o mesmo número de sempre."
          >
            <input
              type="date"
              value={dataBase}
              onChange={(e) => setDataBase(e.target.value)}
              className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <Campo rotulo="Janela de treinamento (meses)" ajuda="Quanto tempo para trás contam os cursos concluídos.">
            <input
              type="number"
              min={1}
              value={janela}
              onChange={(e) => setJanela(Number(e.target.value))}
              className="alvo-toque w-32 rounded-xl border border-slate-300 px-3 text-slate-800"
            />
          </Campo>

          <Opcao
            marcado={incluirAfastados}
            aoMudar={setIncluirAfastados}
            rotulo="Incluir afastados"
            ajuda="Decisão do ciclo, medida pela situação na data-base. Férias sempre entram; afastamento é a escolha aqui."
          />
          <Opcao
            marcado={valeParaMerito}
            aoMudar={setMerito}
            rotulo="Vale para mérito"
            ajuda="Marca o ciclo como base de decisão salarial. Não muda o cálculo — muda o que ele significa."
          />

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Régua de conceitos</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Contígua por construção — o fim de uma faixa é o começo da próxima, então nota 24,5 tem
              conceito. Ajuste fino do texto e das cores fica na tela do ciclo.
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {CONCEITOS_PADRAO.map((c) => (
                <li
                  key={c.descricao}
                  className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: c.cor }}
                >
                  {c.descricao} {c.limiteInferior}–{c.limiteSuperior}
                </li>
              ))}
            </ul>
          </div>

          {erro && <Erro mensagem={erro} />}
        </div>

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
            disabled={salvando || !nome.trim()}
            onClick={salvar}
            className="alvo-toque flex-1 rounded-xl bg-capul-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {salvando ? 'Criando…' : 'Criar ciclo'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  rotulo,
  ajuda,
  children,
}: {
  rotulo: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{rotulo}</span>
      {ajuda && <span className="mt-0.5 block text-xs text-slate-500">{ajuda}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Opcao({
  marcado,
  aoMudar,
  rotulo,
  ajuda,
}: {
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  rotulo: string;
  ajuda: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 size-4 accent-capul-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{rotulo}</span>
        <span className="block text-xs text-slate-500">{ajuda}</span>
      </span>
    </label>
  );
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
