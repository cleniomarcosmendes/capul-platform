/**
 * ⭐⭐ CADASTRO DE CRITÉRIOS E FAIXAS — o catálogo deixa de ser só leitura.
 *
 * Até aqui `rh.criterio` e `rh.criterio_faixa` só nasciam pelo seed. O efeito
 * prático era que *"cadastre a faixa no critério e reapure"*, que o painel manda
 * quando um valor não cai em faixa nenhuma, **não tinha para onde mandar**: a
 * saída era pedir T.I. no banco.
 *
 * ⭐ O que esta tela destrava, e é por que ela vem antes do editor: o critério
 * **INFORMADO**. Ele não precisa de código nenhum — o valor vem de planilha ou
 * digitação. Com o cadastro de pé, o RH compõe a nota com qualquer coisa que
 * caiba numa planilha, sem esperar deploy.
 *
 * ⚠️ **A regra da tela é a MESMA função do backend.** A conferência das faixas
 * (buraco, sobreposição, fronteira) não foi reimplementada aqui: a tela chama
 * `POST /criterios/:id/faixas/conferir`, que roda o mesmo
 * `validarFaixasDoCriterio` do `PUT`. Cem linhas de regra em dois lugares
 * envelhecem diferente, e o sintoma é mudo — a tela libera o que a API recusa,
 * ou recusa o que ela aceita.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  Plus,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  criterios as apiCriterios,
  ehFaltaDePermissao,
  mensagemDoErro,
} from '../services/api';
import type {
  CriterioDoCadastro,
  CriterioEntrada,
  DistribuicaoDoCriterio,
  FaixaDeCriterio,
  ResolverDisponivel,
} from '../services/api';
import { Carregando, Erro, Vazio } from '../components/Estado';
import { Etiqueta } from '../components/Etiqueta';
import { Modal } from '../components/Modal';
import { contagem } from '../lib/formato';

/**
 * ⚠️ O `id` FICA no estado editável — é como a linha se casa com a distribuição
 * (quantas pessoas ela cobre hoje). Ele é retirado no envio: o backend
 * substitui o conjunto inteiro e não aceita id de volta.
 */
type FaixaEditavel = Omit<FaixaDeCriterio, 'tipo'>;

const FAIXA_NOVA: FaixaEditavel = {
  limiteInferior: null,
  limiteSuperior: null,
  inclusivoInf: false,
  inclusivoSup: true,
  valorDominio: null,
  pontuacao: 0,
  rotulo: null,
  ordem: 0,
};

export default function CriteriosPage() {
  const [lista, setLista] = useState<CriterioDoCadastro[] | null>(null);
  const [resolvers, setResolvers] = useState<ResolverDisponivel[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<CriterioDoCadastro | 'novo' | null>(null);
  const [faixasDe, setFaixasDe] = useState<CriterioDoCadastro | null>(null);
  const [params, setParams] = useSearchParams();
  const [destacado, setDestacado] = useState<string | null>(null);
  const jaAbriu = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([apiCriterios.listar(), apiCriterios.resolvers()]);
      setLista(c);
      setResolvers(r);
      setErro(null);
    } catch (e) {
      if (ehFaltaDePermissao(e)) setSemPermissao(true);
      else setErro(mensagemDoErro(e, 'Não foi possível carregar os critérios.'));
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * ⭐⭐ CHEGAR, e não só navegar. O painel manda *"cadastre a faixa no critério"*
   * e linka para cá com `?faixas=<codigo>`.
   *
   * ⚠️ A primeira versão usava `#âncora` — e **não funcionava**: o React Router
   * não rola para hash, e mesmo o comportamento nativo do browser não pegaria,
   * porque no instante da navegação a lista ainda é `null` e o elemento não
   * existe. A pessoa caía no TOPO da lista, sem nada destacado, e tinha de
   * procurar o critério a olho — que é o mesmo trabalho que o link deveria ter
   * poupado. Link que navega mas não chega é pior que texto sem link: promete
   * ter levado.
   *
   * Aqui o parâmetro é lido DEPOIS de a lista carregar, rola até o cartão,
   * destaca por alguns segundos e **abre direto o editor de faixas** — que é o
   * ato que o aviso nomeia. `jaAbriu` impede que voltar do diálogo reabra.
   */
  useEffect(() => {
    const codigo = params.get('faixas');
    if (!codigo || !lista || jaAbriu.current) return;
    const alvo = lista.find((c) => c.codigo === codigo);
    jaAbriu.current = true;
    // Some da URL: recarregar a página não deve reabrir o diálogo, e o link
    // colado num chat não deve levar alguém a um estado que ele não pediu.
    setParams({}, { replace: true });
    if (!alvo) return;
    setDestacado(alvo.id);
    document.getElementById(`criterio-${codigo}`)?.scrollIntoView({ block: 'center' });
    setFaixasDe(alvo);
  }, [params, lista, setParams]);

  if (semPermissao) {
    return (
      <Vazio
        titulo="Sem acesso ao cadastro de critérios"
        detalhe="Mexer num critério muda a régua de todos os ciclos que o usarem — é permissão de RH_ADMIN. Falar com quem administra o módulo."
      />
    );
  }
  if (erro) return <Erro mensagem={erro} aoTentarDeNovo={() => void carregar()} />;
  if (!lista) return <Carregando />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800">
            <SlidersHorizontal size={20} className="text-slate-400" aria-hidden />
            Critérios da nota
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            O que entra na nota <strong>além do questionário</strong> — escolaridade, tempo de
            empresa, e o que mais o RH quiser compor. O peso de cada um é escolhido{' '}
            <strong>por perfil</strong>, na montagem da aplicação; aqui se define o critério e as
            faixas de pontuação dele.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando('novo')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          <Plus size={15} aria-hidden /> Novo critério
        </button>
      </header>

      <ExplicacaoDasOrigens />

      {/* ⭐ A AUSÊNCIA EXPLICADA. Não existe apagar critério, e o comportamento
          está certo: ele pode estar referenciado por resultados já apurados, e
          apagá-lo deixaria a memória de cálculo sem o nome do que foi medido.
          O que não estava certo era a tela calar — quem cria errado procura o
          botão, não acha, e conclui que o sistema está incompleto. */}
      <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <strong className="font-medium text-slate-700">Critério não se apaga.</strong> Ele fica
        referenciado nos resultados já apurados — apagá-lo deixaria a memória de cálculo sem o nome
        do que foi medido. Para tirar de uso, <strong>desative</strong>: ele para de poder entrar
        em novas aplicações, some das que ainda não abriram, e os resultados antigos continuam
        explicáveis. Ciclos que já o usam não mudam.
      </p>

      <ol className="mt-4 space-y-3">
        {lista.map((c) => (
          <li key={c.id} id={`criterio-${c.codigo}`} className="scroll-mt-20">
            <CartaoDoCriterio
              criterio={c}
              destacado={destacado === c.id}
              aoEditar={() => setEditando(c)}
              aoAbrirFaixas={() => setFaixasDe(c)}
            />
          </li>
        ))}
      </ol>

      {editando && (
        <DialogoCriterio
          criterio={editando === 'novo' ? null : editando}
          resolvers={resolvers}
          aoFechar={() => setEditando(null)}
          aoSalvar={async () => {
            setEditando(null);
            await carregar();
          }}
        />
      )}

      {faixasDe && (
        <DialogoFaixas
          criterio={faixasDe}
          aoFechar={() => setFaixasDe(null)}
          aoSalvar={async () => {
            setFaixasDe(null);
            await carregar();
          }}
        />
      )}
    </div>
  );
}

/**
 * ⭐ A diferença entre as duas origens é a única coisa que o RH precisa entender
 * para usar a tela sozinho — e é a resposta para "posso criar isso sem T.I.?".
 */
function ExplicacaoDasOrigens() {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
        <p className="text-sm font-semibold text-emerald-900">
          INFORMADO — você cria sozinho, do começo ao fim
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          O valor de cada pessoa vem de <strong>planilha ou digitação</strong>, por ciclo. Serve
          para qualquer coisa que caiba numa planilha: meta batida, nota de segurança, avaliação de
          cliente oculto. Não depende de programação.
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">
          CALCULADO — o sistema lê do cadastro
        </p>
        <p className="mt-1 text-sm text-slate-600">
          O valor sai do cadastro do Protheus por um <strong>cálculo já programado</strong>. Você
          escolhe qual, de uma lista — <strong>criar um cálculo novo exige T.I.</strong>, mas nome,
          faixas e peso são seus.
        </p>
      </div>
    </div>
  );
}

function CartaoDoCriterio({
  criterio: c,
  destacado,
  aoEditar,
  aoAbrirFaixas,
}: {
  criterio: CriterioDoCadastro;
  destacado: boolean;
  aoEditar: () => void;
  aoAbrirFaixas: () => void;
}) {
  const semFaixa = c.faixas.length === 0;
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        // O destaque fica: quem veio do painel precisa reconhecer o cartão
        // DEPOIS de fechar o diálogo, para conferir que mexeu no certo.
        destacado ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-800">{c.nome}</h3>
            <Etiqueta tom={c.origem === 'CALCULADO' ? 'neutro' : 'verde'}>{c.origem}</Etiqueta>
            {!c.ativo && <Etiqueta tom="ambar">Inativo</Etiqueta>}
          </div>
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            {c.codigo}
            {c.codigoCalculo && ` · cálculo ${c.codigoCalculo}`}
            {c.unidade && ` · em ${c.unidade}`}
          </p>
          {/* ⚠️ SÓ QUANDO ATIVO. No inativo a mesma `descricao` é o motivo da
              desativação, e o bloco "Desativado" abaixo já a mostra COM o
              contexto que ela precisa. Sem esta condição o texto saía duas
              vezes no mesmo cartão — e no QTDE_TREINAMENTO, cuja descrição é a
              justificativa inteira, era um parágrafo longo repetido. */}
          {c.ativo && c.descricao && (
            <p className="mt-1 text-sm text-slate-600">{c.descricao}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={aoEditar}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={aoAbrirFaixas}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Faixas ({c.faixas.length})
          </button>
        </div>
      </div>

      {/* ⚠️ Critério sem faixa não pontua NINGUÉM — e o silêncio é o problema:
          ele sai da nota pela renormalização, sem erro. O aviso é aqui, na
          lista, porque é aqui que se percebe olhando. */}
      {semFaixa && c.ativo && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          Sem faixa cadastrada: nenhum valor pontua, e o critério sai da nota sem acusar erro.
        </p>
      )}

      {/* ⚠️⚠️ A METADE QUE AINDA NÃO EXISTE, dita em voz alta.
          Cadastrar um INFORMADO é só metade do caminho: sem o VALOR de cada
          pessoa ele não pontua ninguém — a apuração o marca "sem valor
          informado" e o tira da nota pela renormalização, sem erro. A tela de
          importar/digitar valor é a próxima frente, e enquanto ela não existe
          esta aqui estaria prometendo uma capacidade pela metade se ficasse
          calada. Dizer é mais barato que o vaivém de descobrir depois. */}
      {c.origem === 'INFORMADO' && c.ativo && c.valoresInformados === 0 && !semFaixa && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50 px-2.5 py-1.5 text-sm text-sky-900">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
          {/* ⚠️ Reescrito em 12/09: a frase antiga dizia "ainda não há como
              informar o valor", e quem lesse concluiria que o cadastro inteiro
              não serve. O que falta é só a ENTRADA do valor — o critério, as
              faixas e o peso já se cadastram nesta tela e na de Aplicações. */}
          As faixas deste critério estão cadastradas, mas <strong>ninguém tem valor
          informado ainda</strong> — a tela de importar planilha é a próxima entrega. Até lá
          ele entra na apuração como "sem valor" e sai da nota pela renormalização.
        </p>
      )}

      {/* ⭐ POR QUE ESTÁ INATIVO — na tela, não só no ESTADO.
          Um critério desligado sem motivo visível convida quem não conhece a
          história a religá-lo achando que foi lapso. A descrição é onde o motivo
          mora (o diálogo de edição pede isso ao desativar). */}
      {!c.ativo && (
        <div className="mt-2 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm">
          <p className="font-medium text-slate-700">Desativado — não entra em nenhuma aplicação.</p>
          {c.descricao ? (
            <p className="mt-0.5 text-slate-600">{c.descricao}</p>
          ) : (
            <p className="mt-0.5 text-slate-500">
              Sem motivo registrado. Quem desativar deve escrever o porquê na descrição — senão o
              próximo a olhar religa achando que foi esquecimento.
            </p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          {c.aplicacoesQueUsam === 0
            ? 'não está em nenhuma aplicação'
            : contagem(c.aplicacoesQueUsam, 'aplicação usa', 'aplicações usam')}
        </span>
        {c.origem === 'INFORMADO' && (
          <span>
            {c.valoresInformados === 0
              ? 'nenhum valor informado ainda'
              : contagem(c.valoresInformados, 'valor informado', 'valores informados')}
          </span>
        )}
      </div>
    </div>
  );
}

function DialogoCriterio({
  criterio,
  resolvers,
  aoFechar,
  aoSalvar,
}: {
  criterio: CriterioDoCadastro | null;
  resolvers: ResolverDisponivel[];
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const novo = criterio === null;
  const [f, setF] = useState<CriterioEntrada>({
    codigo: criterio?.codigo ?? '',
    nome: criterio?.nome ?? '',
    descricao: criterio?.descricao ?? '',
    origem: criterio?.origem ?? 'INFORMADO',
    tipoValor: criterio?.tipoValor ?? 'NUMERICO',
    codigoCalculo: criterio?.codigoCalculo ?? '',
    unidade: criterio?.unidade ?? '',
    ativo: criterio?.ativo ?? true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);

  /**
   * As MESMAS regras de `assertCriterioSalvavel` — mas só as três baratas, que
   * dão para checar sem o servidor. A conferência de verdade continua sendo a
   * do backend, que roda de qualquer jeito no submit.
   */
  const impedimento = !f.codigo.trim()
    ? 'O código identifica o critério e é obrigatório.'
    : !/^[A-Za-z0-9_]+$/.test(f.codigo.trim())
      ? 'O código aceita apenas letras, números e "_" — é identificador, não texto livre.'
      : f.nome.trim().length < 2
        ? 'Informe o nome do critério.'
        : f.origem === 'CALCULADO' && !f.codigoCalculo
          ? 'Critério CALCULADO precisa de um cálculo. Escolha um da lista.'
          : null;

  const trocouTipoComFaixas =
    criterio !== null && f.tipoValor !== criterio.tipoValor && criterio.faixas.length > 0;

  async function salvar() {
    setSalvando(true);
    setErros([]);
    try {
      const dto: CriterioEntrada = {
        ...f,
        codigoCalculo: f.origem === 'CALCULADO' ? f.codigoCalculo : null,
      };
      if (novo) await apiCriterios.criar(dto);
      else await apiCriterios.atualizar(criterio.id, dto);
      aoSalvar();
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } }).response?.data
        ?.message;
      setErros(Array.isArray(m) ? m : [mensagemDoErro(e, 'Não foi possível salvar o critério.')]);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={novo ? 'Novo critério' : `Editar ${criterio.nome}`} aoFechar={aoFechar}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Código">
            <input
              value={f.codigo}
              onChange={(e) => setF({ ...f, codigo: e.target.value.toUpperCase() })}
              disabled={!novo}
              placeholder="META_MENSAL"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm disabled:bg-slate-100 disabled:text-slate-500"
            />
            {/* ⚠️ Travado na edição: o código é a solda com o seed e com qualquer
                script que já o referencie. Renomear em lugar quebraria essas
                pontas em silêncio — e o campo diz isso, em vez de sumir. */}
            {!novo && (
              <p className="mt-1 text-xs text-slate-500">
                O código não muda depois de criado — é por ele que o restante do sistema encontra
                este critério.
              </p>
            )}
          </Campo>
          <Campo rotulo="Nome">
            <input
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              placeholder="Meta mensal"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
        </div>

        <Campo rotulo="Descrição (opcional)">
          <textarea
            value={f.descricao ?? ''}
            onChange={(e) => setF({ ...f, descricao: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Campo>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="De onde vem o valor">
            <select
              value={f.origem}
              onChange={(e) =>
                setF({ ...f, origem: e.target.value as CriterioEntrada['origem'], codigoCalculo: '' })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="INFORMADO">INFORMADO — planilha ou digitação</option>
              <option value="CALCULADO">CALCULADO — lido do cadastro</option>
            </select>
          </Campo>
          <Campo rotulo="Tipo do valor">
            <select
              value={f.tipoValor}
              onChange={(e) =>
                setF({ ...f, tipoValor: e.target.value as CriterioEntrada['tipoValor'] })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="NUMERICO">NUMÉRICO — faixas por intervalo</option>
              <option value="DOMINIO">DOMÍNIO — faixas por código exato</option>
            </select>
          </Campo>
        </div>

        {/* ⭐⭐ `<select>`, NUNCA campo de texto. Um caractere a mais e o critério
            devolveria vazio, em silêncio, para o ciclo inteiro: o grupo viraria
            "sem dado", sairia da renormalização, e a nota final de todo mundo
            mudaria sem um erro sequer. A lista vem de `codigosRegistrados()`. */}
        {f.origem === 'CALCULADO' && (
          <Campo rotulo="Qual cálculo">
            <select
              value={f.codigoCalculo ?? ''}
              onChange={(e) => setF({ ...f, codigoCalculo: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            >
              <option value="">— escolha —</option>
              {resolvers.map((r) => (
                <option key={r.codigo} value={r.codigo}>
                  {r.codigo}
                  {r.emUsoPor.length > 0 && ` (já usado por: ${r.emUsoPor.join(', ')})`}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Só aparecem cálculos que existem no sistema. Um cálculo novo — por exemplo, sobre um
              dado do Protheus que ainda não é lido — precisa da T.I.
            </p>
          </Campo>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Unidade (opcional)">
            <input
              value={f.unidade ?? ''}
              onChange={(e) => setF({ ...f, unidade: e.target.value })}
              placeholder="anos, cursos, %"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </Campo>
          <Campo rotulo="Situação">
            <label className="flex items-center gap-2 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={f.ativo ?? true}
                onChange={(e) => setF({ ...f, ativo: e.target.checked })}
                className="h-4 w-4"
              />
              Ativo — pode entrar em aplicações
            </label>
            {/* Desativar sem dizer por quê é o que faz o próximo religar
                achando que foi lapso. Pedido, não exigido: há casos óbvios. */}
            {f.ativo === false && !(f.descricao ?? '').trim() && (
              <p className="text-xs text-amber-800">
                Escreva na descrição <strong>por que</strong> está desativado — é o que a lista
                mostra, e é o que evita alguém religar sem conhecer o motivo.
              </p>
            )}
          </Campo>
        </div>

        {trocouTipoComFaixas && (
          <Aviso tom="alerta">
            Este critério tem {contagem(criterio.faixas.length, 'faixa cadastrada', 'faixas cadastradas')} do tipo{' '}
            {criterio.tipoValor}. Mudar o tipo deixaria essas faixas sem casar com nenhum valor — o
            servidor vai recusar. Apague as faixas primeiro.
          </Aviso>
        )}
        {impedimento && <Aviso tom="alerta">{impedimento}</Aviso>}
        {erros.map((e, i) => (
          <Aviso key={i} tom="erro">
            {e}
          </Aviso>
        ))}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || impedimento !== null || trocouTipoComFaixas}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DialogoFaixas({
  criterio,
  aoFechar,
  aoSalvar,
}: {
  criterio: CriterioDoCadastro;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const dominio = criterio.tipoValor === 'DOMINIO';
  const [faixas, setFaixas] = useState<FaixaEditavel[]>(
    criterio.faixas.map(({ tipo: _tipo, ...f }) => f),
  );
  const [problemas, setProblemas] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [dist, setDist] = useState<DistribuicaoDoCriterio | null>(null);
  const pedido = useRef(0);

  /**
   * ⭐ O TAMANHO, antes de mexer. Apagar a faixa do código 45 de ESCOLARIDADE
   * tira 480 pessoas da conta — elas caem em "sem faixa", o critério sai da nota
   * delas pela renormalização, e nada avisa até a apuração.
   *
   * ⚠️ Carrega UMA vez, na abertura: a distribuição é do que está GRAVADO, não
   * do que está sendo digitado. Recalcular a cada tecla mostraria o efeito de
   * uma edição que ainda não existe — e a conta varre ~1.000 pessoas.
   */
  useEffect(() => {
    apiCriterios
      .distribuicao(criterio.id)
      .then(setDist)
      .catch(() => setDist(null));
  }, [criterio.id]);

  // O que VAI para a API: sem `id`, com a ordem da tela.
  const comOrdem = useMemo(
    () => faixas.map(({ id: _id, ...f }, i) => ({ ...f, ordem: i })),
    [faixas],
  );

  /**
   * ⭐ A recusa aparece ANTES do clique — e vem do SERVIDOR, não de uma segunda
   * implementação da regra. `debounce` de 400ms porque o usuário digita limite
   * a limite e a lista passa por estados inválidos no caminho.
   */
  useEffect(() => {
    const meu = ++pedido.current;
    setConferindo(true);
    const t = setTimeout(() => {
      apiCriterios
        .conferirFaixas(criterio.id, comOrdem)
        .then((r) => {
          if (pedido.current !== meu) return;
          setProblemas(r.problemas);
          setAvisos(r.avisos);
        })
        .catch(() => {
          // Falha de rede na conferência não pode virar "está tudo certo": some
          // com a lista antiga em vez de afirmar o contrário do que se sabe.
          if (pedido.current === meu) {
            setProblemas([]);
            setAvisos([]);
          }
        })
        .finally(() => {
          if (pedido.current === meu) setConferindo(false);
        });
    }, 400);
    return () => clearTimeout(t);
  }, [criterio.id, comOrdem]);

  function mexer(i: number, campo: keyof FaixaEditavel, valor: unknown) {
    setFaixas((atual) => atual.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }
  function mover(i: number, delta: number) {
    setFaixas((atual) => {
      const alvo = i + delta;
      if (alvo < 0 || alvo >= atual.length) return atual;
      const copia = [...atual];
      [copia[i], copia[alvo]] = [copia[alvo], copia[i]];
      return copia;
    });
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      // ⭐ O `true` só chega aqui depois de a pessoa ler o que se perde: a API
      // recusa a primeira tentativa COM O DADO (quantas faixas, quantas
      // aplicações), e é esse texto que o diálogo mostra.
      await apiCriterios.salvarFaixas(criterio.id, comOrdem, confirmado);
      aoSalvar();
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } }).response?.data
        ?.message;
      setErro(Array.isArray(m) ? m.join(' · ') : mensagemDoErro(e, 'Não foi possível salvar.'));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={`Faixas de ${criterio.nome}`} aoFechar={aoFechar} largura="ampla">
      <p className="text-sm text-slate-600">
        A faixa diz <strong>quantos pontos</strong> cada valor vale, de 0 a 100. O peso do critério
        na nota é outra coisa — é escolhido por perfil, na montagem da aplicação.
      </p>

      {dominio ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          Critério de <strong>domínio</strong>: cada faixa casa com um código exato do cadastro. O
          rótulo é o que aparece na memória de cálculo — escreva o texto que o avaliado entenderia.
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          Deixe o limite <strong>em branco</strong> para "sem limite": a última faixa costuma ser
          "mais de X". O fim de uma faixa é o começo da próxima, e o valor da fronteira precisa
          pertencer a <strong>exatamente uma</strong> das duas.
        </p>
      )}

      {/* ⭐⭐ O QUE A RÉGUA MEDE, ao lado da régua. Sem isto o cadastro mostrava
          os limites e escondia o tamanho: dá para apagar a faixa de 480 pessoas
          sem que nada na tela diga que são 480. */}
      {dist && (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm">
          {!dist.aplicavel ? (
            <p className="text-sky-900">{dist.motivo}</p>
          ) : (
            <>
              <p className="text-sky-900">
                Hoje, entre <strong className="tabular-nums">{dist.populacao}</strong> pessoas
                ativas: <strong className="tabular-nums">{dist.populacao - dist.semFaixa - dist.semDado}</strong>{' '}
                caem em alguma faixa
                {dist.semDado > 0 && (
                  <>
                    , <strong className="tabular-nums">{dist.semDado}</strong> sem o dado no
                    cadastro
                  </>
                )}
                {dist.semFaixa > 0 && (
                  <>
                    , e <strong className="tabular-nums text-amber-800">{dist.semFaixa}</strong>{' '}
                    <span className="text-amber-800">fora de qualquer faixa</span>
                  </>
                )}
                .
              </p>
              {/* ⚠️ A DATA que ancora: tempo de empresa e de função mudam com
                  ela, e número sem a data envelhece calado. */}
              <p className="mt-0.5 text-xs text-sky-800">
                Contado com a data de hoje ({dist.dataBase.slice(6, 8)}/{dist.dataBase.slice(4, 6)}/
                {dist.dataBase.slice(0, 4)}). Num ciclo, quem ancora é a data-base dele.
              </p>
              {dist.valoresSemFaixa.length > 0 && (
                <p className="mt-1.5 text-amber-900">
                  Valores sem faixa:{' '}
                  {dist.valoresSemFaixa
                    .slice(0, 8)
                    .map((v) => `${v.valor} (${v.pessoas})`)
                    .join(' · ')}
                  {dist.valoresSemFaixa.length > 8 && ' …'}
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {faixas.map((f, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-25"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === faixas.length - 1}
                  aria-label="Descer"
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 disabled:opacity-25"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <div className="grid flex-1 gap-2 sm:grid-cols-12">
                {dominio ? (
                  <div className="sm:col-span-3">
                    <MiniRotulo>Código</MiniRotulo>
                    <input
                      value={f.valorDominio ?? ''}
                      onChange={(e) => mexer(i, 'valorDominio', e.target.value)}
                      placeholder="45"
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <div className="sm:col-span-3">
                      <MiniRotulo>De</MiniRotulo>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={f.limiteInferior ?? ''}
                          onChange={(e) =>
                            mexer(i, 'limiteInferior', e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="—"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={f.inclusivoInf}
                            onChange={(e) => mexer(i, 'inclusivoInf', e.target.checked)}
                            className="h-3.5 w-3.5"
                          />
                          inclui
                        </label>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <MiniRotulo>Até</MiniRotulo>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          value={f.limiteSuperior ?? ''}
                          onChange={(e) =>
                            mexer(i, 'limiteSuperior', e.target.value === '' ? null : Number(e.target.value))
                          }
                          placeholder="—"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                        <label className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={f.inclusivoSup}
                            onChange={(e) => mexer(i, 'inclusivoSup', e.target.checked)}
                            className="h-3.5 w-3.5"
                          />
                          inclui
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className={dominio ? 'sm:col-span-6' : 'sm:col-span-4'}>
                  <MiniRotulo>Rótulo (aparece na memória de cálculo)</MiniRotulo>
                  <input
                    value={f.rotulo ?? ''}
                    onChange={(e) => mexer(i, 'rotulo', e.target.value)}
                    placeholder={dominio ? 'Superior completo' : 'De 3 a 5 anos'}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>

                <div className="sm:col-span-2">
                  <MiniRotulo>
                    Pontos
                    {/* O tamanho da faixa GRAVADA, ao lado do campo que a apaga. */}
                    {f.id && dist?.aplicavel && (
                      <span className="ml-1 text-sky-700">
                        · {dist.porFaixa.find((x) => x.faixaId === f.id)?.pessoas ?? 0} hoje
                      </span>
                    )}
                  </MiniRotulo>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={f.pontuacao}
                    onChange={(e) => mexer(i, 'pontuacao', Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm tabular-nums"
                  />
                </div>

                <div className="flex items-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => setFaixas((a) => a.filter((_, j) => j !== i))}
                    aria-label="Remover faixa"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setFaixas((a) => [...a, { ...FAIXA_NOVA, ordem: a.length }])}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Plus size={15} aria-hidden /> Acrescentar faixa
        </button>
      </div>

      {/* ⭐ A conferência do SERVIDOR, mostrada antes do clique. Enquanto ela não
          responde, o botão não diz "pode salvar" — dizer isso sem saber é pior
          do que esperar. */}
      <div className="mt-4 min-h-[2.5rem]">
        {conferindo ? (
          <p className="text-sm text-slate-400">Conferindo as faixas…</p>
        ) : problemas.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <AlertTriangle size={15} aria-hidden />
              {contagem(problemas.length, 'problema impede', 'problemas impedem')} salvar
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-amber-800">
              {problemas.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        ) : avisos.length > 0 ? (
          /* ⚠️ AVISO não é PROBLEMA: não impede salvar, diz o que vai acontecer.
             Antes a conferência respondia "sem problema" para apagar as 13
             faixas de um critério em uso — afirmava que estava tudo certo. */
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
            {avisos.map((a, i) => (
              <p key={i} className="flex items-start gap-1.5 text-sm text-amber-900">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}
            <label className="mt-2 flex items-start gap-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              Entendi, e quero deixar este critério sem nenhuma faixa.
            </label>
          </div>
        ) : faixas.length > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-emerald-700">
            <Check size={15} aria-hidden />
            As faixas cobrem os valores sem buraco nem sobreposição.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Sem faixa nenhuma, este critério não pontua ninguém.
          </p>
        )}
      </div>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || conferindo || problemas.length > 0 || (avisos.length > 0 && !confirmado)}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {salvando ? 'Salvando…' : 'Salvar faixas'}
        </button>
      </div>
    </Modal>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{rotulo}</span>
      {children}
    </label>
  );
}

function MiniRotulo({ children }: { children: React.ReactNode }) {
  return <span className="mb-0.5 block text-[11px] text-slate-500">{children}</span>;
}

function Aviso({ tom, children }: { tom: 'alerta' | 'erro'; children: React.ReactNode }) {
  const cor =
    tom === 'erro'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-800';
  return (
    <p className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-sm ${cor}`}>
      <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
