import { useEffect, useState } from 'react';
import { varreduraMatriculaService } from '../../services/varredura-matricula.service';
import type { ResultadoVarredura, StatusVarredura, UsuarioVarredura } from '../../services/varredura-matricula.service';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

type Balde = 'verificados' | 'ativos' | 'desligados' | 'falhas' | 'semMatricula' | 'bloqueados';

function formatData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

/**
 * Varredura de matrículas — acompanhamento e configuração.
 *
 * Esta rotina DESATIVA usuários sozinha, então a tela não é conveniência: é onde
 * se confere a lista ANTES de ligar o bloqueio, e onde se vê o que a última
 * execução fez. Rotina que mexe em acesso e não aparece em lugar nenhum é a
 * definição de funcionalidade oculta.
 */
export function VarreduraMatriculaPage() {
  const confirm = useConfirm();
  const toast = useToast();

  const [status, setStatus] = useState<StatusVarredura | null>(null);
  const [resultado, setResultado] = useState<ResultadoVarredura | null>(null);
  const [loading, setLoading] = useState(true);
  const [rodando, setRodando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [teto, setTeto] = useState(20);
  /** Card aberto. `null` = nenhum — a lista só aparece quando se pede. */
  const [aberto, setAberto] = useState<Balde | null>(null);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const s = await varreduraMatriculaService.getStatus();
      setStatus(s);
      setTeto(s.tetoPct);
    } catch {
      toast.error('Falha ao carregar o status da varredura');
    } finally {
      setLoading(false);
    }
  }

  async function executar() {
    setRodando(true);
    try {
      const r = await varreduraMatriculaService.executar();
      setResultado(r);
      await refresh();
      if (r.abortada) toast.error('Varredura abortada pelo freio de segurança — nada foi bloqueado');
      else if (r.desligados.length > 0) toast.success(`${r.desligados.length} usuário(s) na lista`);
      else toast.success('Nenhum desligado encontrado');
    } catch {
      toast.error('Falha ao executar a varredura');
    } finally {
      setRodando(false);
    }
  }

  async function alternarModo() {
    const ligando = status?.modo !== 'BLOQUEIO';
    const ok = await confirm({
      title: ligando ? 'Ligar o bloqueio automático?' : 'Voltar para modo relatório?',
      description: ligando
        ? 'A partir daqui, a varredura vai DESATIVAR automaticamente os usuários cuja matrícula não estiver no Protheus. ' +
          'Confira a lista em modo relatório antes — e não ligue enquanto houver dúvida sobre o ambiente do endpoint infoFuncionario.'
        : 'A varredura volta a apenas listar quem seria desativado, sem alterar ninguém.',
      confirmLabel: ligando ? 'Ligar bloqueio' : 'Voltar para relatório',
      variant: ligando ? 'danger' : 'info',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const s = await varreduraMatriculaService.configurar({ bloquear: ligando });
      setStatus(s);
      toast.success(ligando ? 'Bloqueio automático LIGADO' : 'Modo relatório');
    } catch {
      toast.error('Falha ao alterar o modo');
    } finally {
      setSalvando(false);
    }
  }

  async function salvarTeto() {
    setSalvando(true);
    try {
      const s = await varreduraMatriculaService.configurar({ tetoPct: teto });
      setStatus(s);
      toast.success('Teto atualizado');
    } catch {
      toast.error('Falha ao salvar o teto');
    } finally {
      setSalvando(false);
    }
  }

  const ultima = status?.ultimaExecucao;
  const dados = resultado ?? ultima?.metadata ?? null;
  const modoBloqueio = status?.modo === 'BLOQUEIO';

  if (loading) return <p className="text-slate-500">Carregando…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Varredura de Matrículas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confere diariamente (04:00) se a matrícula de cada usuário ainda existe no cadastro de
          funcionários do Protheus. Quem não está mais lá foi desligado. Contas <strong>PADRÃO</strong>{' '}
          (login compartilhado) não têm matrícula e ficam fora.
        </p>
      </div>

      {/* MODO — o que decide se ela só olha ou se desativa gente */}
      <div className={`rounded-lg border p-4 ${modoBloqueio ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">
              Modo atual: {modoBloqueio ? '🔴 BLOQUEIO AUTOMÁTICO' : '🟡 SOMENTE RELATÓRIO'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {modoBloqueio
                ? 'Usuários sem matrícula válida no Protheus são DESATIVADOS automaticamente.'
                : 'A varredura apenas lista quem seria desativado. Ninguém é alterado.'}
            </p>
          </div>
          <button
            onClick={alternarModo}
            disabled={salvando}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              modoBloqueio ? 'bg-slate-600 hover:bg-slate-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {modoBloqueio ? 'Voltar para relatório' : 'Ligar bloqueio'}
          </button>
        </div>
      </div>

      {/* FREIO */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="block text-sm font-semibold text-slate-700">Freio de segurança</label>
        <p className="mt-1 text-sm text-slate-500">
          Se mais que este percentual das matrículas verificadas não for encontrado, a varredura{' '}
          <strong>aborta sem bloquear ninguém</strong>. Uma proporção alta quase sempre é problema de
          configuração ou credencial do Protheus — não uma leva de demissões.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number" min={1} max={100} value={teto}
            onChange={(e) => setTeto(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-600">%</span>
          <button
            onClick={salvarTeto} disabled={salvando || teto === status?.tetoPct}
            className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-semibold text-white hover:bg-capul-700 disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>

      {/* EXECUÇÃO */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">Última execução</p>
            <p className="text-sm text-slate-500">
              {ultima ? `${formatData(ultima.createdAt)} · modo ${ultima.action}` : 'Nunca executada'}
            </p>
          </div>
          <button
            onClick={executar} disabled={rodando}
            className="shrink-0 rounded-lg border border-capul-600 px-4 py-2 text-sm font-semibold text-capul-700 hover:bg-capul-50 disabled:opacity-50"
          >
            {rodando ? 'Verificando no Protheus…' : 'Executar agora'}
          </button>
        </div>

        {dados && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Indicador balde="verificados" rotulo="Verificados" valor={dados.verificados} aberto={aberto} onAbrir={setAberto} />
              <Indicador balde="ativos" rotulo="Ativos" valor={dados.ativos} cor="text-emerald-700" aberto={aberto} onAbrir={setAberto} />
              <Indicador balde="desligados" rotulo="Desligados" valor={dados.naoEncontrados} cor="text-red-700" aberto={aberto} onAbrir={setAberto} />
              <Indicador balde="falhas" rotulo="Falhas" valor={dados.falhas} cor="text-amber-700" aberto={aberto} onAbrir={setAberto} />
              <Indicador balde="semMatricula" rotulo="Sem matrícula" valor={dados.semMatricula} cor="text-slate-500" aberto={aberto} onAbrir={setAberto} />
              <Indicador balde="bloqueados" rotulo="Bloqueados" valor={dados.bloqueados} cor="text-red-700" aberto={aberto} onAbrir={setAberto} />
            </div>

            {dados.abortada && (
              <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
                <strong>Abortada pelo freio.</strong> {dados.motivoAborto}
              </p>
            )}

            {dados.falhas > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                <strong>{dados.falhas} matrícula(s) não puderam ser verificadas</strong> (Protheus fora do
                ar, credencial ou endpoint no ambiente errado). Elas <strong>não</strong> entram na conta
                nem são bloqueadas — falha nunca desativa ninguém.
              </p>
            )}

            {dados.semMatricula > 0 && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <strong>{dados.semMatricula} usuário(s) sem matrícula</strong> ficam fora da verificação —
                não há o que consultar. Enquanto o campo estiver vazio, um desligado com esse login
                <strong> não é alcançado</strong> por esta rotina. Preencha a matrícula no cadastro do usuário.
              </p>
            )}

            {aberto && (
              <TabelaBalde
                balde={aberto}
                dados={dados}
                onFechar={() => setAberto(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Card clicável. Vazio não abre — e fica sem cara de botão, para o operador não
 * tocar num número que não tem o que mostrar.
 */
function Indicador({
  balde, rotulo, valor, cor = 'text-slate-800', aberto, onAbrir,
}: {
  balde: Balde; rotulo: string; valor: number; cor?: string;
  aberto: Balde | null; onAbrir: (b: Balde | null) => void;
}) {
  const temLista = valor > 0;
  const selecionado = aberto === balde;
  return (
    <button
      type="button"
      disabled={!temLista}
      onClick={() => onAbrir(selecionado ? null : balde)}
      className={`rounded-lg border p-3 text-left transition ${
        selecionado ? 'border-capul-600 ring-2 ring-capul-600/20' : 'border-slate-200'
      } ${temLista ? 'cursor-pointer hover:border-capul-400 hover:bg-slate-50' : 'cursor-default opacity-70'}`}
    >
      <p className="text-xs text-slate-500">{rotulo}</p>
      <p className={`text-xl font-bold ${cor}`}>{valor}</p>
      {temLista && (
        <p className="mt-0.5 text-[11px] text-slate-400">{selecionado ? 'ocultar' : 'ver lista'}</p>
      )}
    </button>
  );
}

/** O que cada card mostra, e por que aquela lista importa. */
const BALDES: Record<Balde, { titulo: string; nota?: string }> = {
  verificados: {
    titulo: 'Usuários verificados no Protheus',
    nota: 'Todos os que têm matrícula e foram consultados — ativos, desligados e falhas.',
  },
  ativos: { titulo: 'Ativos no Protheus', nota: 'Matrícula encontrada. Nada a fazer com estes.' },
  desligados: {
    titulo: 'Sem matrícula no Protheus (desligados)',
    nota: 'O Protheus respondeu e não tem esta chapa. A desativação é reversível pelo cadastro de usuários.',
  },
  falhas: {
    titulo: 'Não foi possível verificar',
    nota: 'Protheus fora do ar, credencial ou endpoint no ambiente errado. NÃO entram na conta do freio e NUNCA são bloqueados.',
  },
  semMatricula: {
    titulo: 'Sem matrícula cadastrada',
    nota: 'Ficam FORA da varredura — não há o que consultar. Enquanto o campo estiver vazio, um desligado com esse login não é alcançado. Preencha no cadastro do usuário.',
  },
  bloqueados: {
    titulo: 'Usuários desativados nesta execução',
    nota: 'Reversível pelo cadastro de usuários.',
  },
};

function listaDoBalde(balde: Balde, dados: ResultadoVarredura): UsuarioVarredura[] {
  const l = dados.listas;
  switch (balde) {
    case 'verificados': return [...l.ativos, ...l.desligados, ...l.falhas];
    case 'ativos': return l.ativos;
    case 'desligados': return l.desligados;
    case 'falhas': return l.falhas;
    case 'semMatricula': return l.semMatricula;
    // Bloqueados são os desligados que a execução de fato desativou.
    case 'bloqueados': return dados.bloqueados > 0 ? l.desligados : [];
  }
}

function TabelaBalde({
  balde, dados, onFechar,
}: { balde: Balde; dados: ResultadoVarredura; onFechar: () => void }) {
  const lista = listaDoBalde(balde, dados);
  const info = BALDES[balde];
  return (
    <div className="mt-4 rounded-lg border border-slate-200">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {info.titulo} <span className="font-normal text-slate-500">({lista.length})</span>
          </p>
          {info.nota && <p className="mt-1 text-xs text-slate-500">{info.nota}</p>}
        </div>
        <button onClick={onFechar} className="shrink-0 text-sm text-slate-500 hover:text-slate-700">
          fechar
        </button>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-white text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Usuário</th>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Matrícula</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className="border-b border-slate-100">
                <td className="px-4 py-2 font-mono text-slate-800">{u.username}</td>
                <td className="px-4 py-2 text-slate-700">{u.nome}</td>
                <td className="px-4 py-2 font-mono text-slate-600">
                  {u.matricula ?? <span className="italic text-slate-400">não informada</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
