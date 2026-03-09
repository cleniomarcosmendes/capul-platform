import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { ordemServicoService } from '../../services/ordem-servico.service';
import { chamadoService } from '../../services/chamado.service';
import { coreService } from '../../services/core.service';
import { exportService } from '../../services/export.service';
import { useToast } from '../../components/Toast';
import {
  Plus, X, ArrowLeft, Play, Square, Ban, UserPlus, Link2, Unlink,
  Clock, CheckCircle, Users, FileText, Download,
} from 'lucide-react';
import type { OrdemServico, StatusOS, UsuarioCore, Chamado, StatusChamado, FilialResumo } from '../../types';

const statusLabels: Record<StatusOS, string> = {
  ABERTA: 'Aberta', EM_EXECUCAO: 'Em Execucao', CONCLUIDA: 'Concluida', CANCELADA: 'Cancelada',
};
const statusColors: Record<StatusOS, string> = {
  ABERTA: 'bg-blue-100 text-blue-700', EM_EXECUCAO: 'bg-yellow-100 text-yellow-700',
  CONCLUIDA: 'bg-green-100 text-green-700', CANCELADA: 'bg-red-100 text-red-600',
};
const statusChamadoLabel: Record<string, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em Atendimento', PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
};
const statusChamadoCores: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700', EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700', RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600', CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
};

function formatDuracao(inicio: string, fim: string | null): string {
  const ms = (fim ? new Date(fim).getTime() : Date.now()) - new Date(inicio).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function OrdensServicoPage() {
  const navigate = useNavigate();
  const { usuario, gestaoTiRole } = useAuth();
  const { toast, confirm } = useToast();
  const isTecnico = ['ADMIN', 'GESTOR_TI', 'TECNICO'].includes(gestaoTiRole || '');

  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusOS | ''>('');

  // Detail view
  const [osDetalhe, setOsDetalhe] = useState<OrdemServico | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [tecnicos, setTecnicos] = useState<UsuarioCore[]>([]);
  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [filialId, setFilialId] = useState(usuario?.filialAtual?.id || '');
  const [tecnicoId, setTecnicoId] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Modal vincular chamados
  const [showModalChamados, setShowModalChamados] = useState(false);
  const [chamadosDisponiveis, setChamadosDisponiveis] = useState<Chamado[]>([]);
  const [chamadosSelecionados, setChamadosSelecionados] = useState<Set<string>>(new Set());
  const [chamadoFilterText, setChamadoFilterText] = useState('');
  const [chamadoFilterStatus, setChamadoFilterStatus] = useState<StatusChamado | ''>('');
  const [loadingChamados, setLoadingChamados] = useState(false);

  // Add tecnico
  const [showAddTecnico, setShowAddTecnico] = useState(false);
  const [novoTecnicoId, setNovoTecnicoId] = useState('');

  // Encerrar
  const [showEncerrar, setShowEncerrar] = useState(false);
  const [encerrarObs, setEncerrarObs] = useState('');

  function loadOrdens() {
    setLoading(true);
    ordemServicoService.listar(filterStatus || undefined)
      .then(setOrdens).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadOrdens(); }, [filterStatus]);

  useEffect(() => {
    if ((showForm || showAddTecnico) && tecnicos.length === 0) {
      coreService.listarUsuarios().then(setTecnicos).catch(() => {});
    }
    if (showForm && filiais.length === 0) {
      coreService.listarFiliais().then(setFiliais).catch(() => {});
    }
  }, [showForm, showAddTecnico, tecnicos.length, filiais.length]);

  function openDetalhe(os: OrdemServico) {
    setOsDetalhe(os);
  }

  async function reloadDetalhe(id: string) {
    const updated = await ordemServicoService.buscar(id);
    setOsDetalhe(updated);
    loadOrdens();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const created = await ordemServicoService.criar({
        titulo,
        descricao: descricao || undefined,
        filialId,
        tecnicoId: tecnicoId || undefined,
        dataAgendamento: dataAgendamento || undefined,
        observacoes: observacoes || undefined,
      });
      setShowForm(false);
      setTitulo(''); setDescricao(''); setFilialId(usuario?.filialAtual?.id || ''); setTecnicoId(''); setDataAgendamento(''); setObservacoes('');
      loadOrdens();
      openDetalhe(created);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao criar OS');
    } finally { setSaving(false); }
  }

  // Workflow actions
  async function handleIniciar() {
    if (!osDetalhe) return;
    setActionLoading(true);
    try {
      await ordemServicoService.iniciar(osDetalhe.id);
      await reloadDetalhe(osDetalhe.id);
      toast('success', 'OS iniciada');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao iniciar OS');
    } finally { setActionLoading(false); }
  }

  async function handleEncerrar() {
    if (!osDetalhe) return;
    setActionLoading(true);
    try {
      await ordemServicoService.encerrar(osDetalhe.id, encerrarObs || undefined);
      await reloadDetalhe(osDetalhe.id);
      setShowEncerrar(false); setEncerrarObs('');
      toast('success', 'OS encerrada');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao encerrar OS');
    } finally { setActionLoading(false); }
  }

  async function handleCancelar() {
    if (!osDetalhe || !await confirm('Cancelar OS', 'Tem certeza que deseja cancelar esta OS?', { variant: 'danger' })) return;
    setActionLoading(true);
    try {
      await ordemServicoService.cancelar(osDetalhe.id);
      await reloadDetalhe(osDetalhe.id);
      toast('success', 'OS cancelada');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro');
    } finally { setActionLoading(false); }
  }

  async function handleDownloadRelatorio() {
    if (!osDetalhe) return;
    try {
      await ordemServicoService.downloadRelatorio(osDetalhe.id, osDetalhe.numero);
      toast('success', 'Relatorio gerado');
    } catch {
      toast('error', 'Erro ao gerar relatorio');
    }
  }

  // Chamados
  async function openModalChamados() {
    setShowModalChamados(true);
    setLoadingChamados(true);
    setChamadosSelecionados(new Set());
    try {
      const all = await chamadoService.listar({ filialId: osDetalhe?.filialId });
      const jaVinculados = new Set(osDetalhe?.chamados.map((c) => c.chamadoId) || []);
      setChamadosDisponiveis(all.filter((c) => !jaVinculados.has(c.id)));
    } catch { setChamadosDisponiveis([]); }
    finally { setLoadingChamados(false); }
  }

  async function handleVincularChamados() {
    if (!osDetalhe || chamadosSelecionados.size === 0) return;
    setActionLoading(true);
    try {
      for (const chamadoId of chamadosSelecionados) {
        await ordemServicoService.vincularChamado(osDetalhe.id, chamadoId);
      }
      await reloadDetalhe(osDetalhe.id);
      setShowModalChamados(false);
      toast('success', `${chamadosSelecionados.size} chamado(s) vinculado(s)`);
    } catch { toast('error', 'Erro ao vincular'); }
    finally { setActionLoading(false); }
  }

  async function handleDesvincularChamado(chamadoId: string) {
    if (!osDetalhe || !await confirm('Desvincular', 'Remover este chamado da OS?')) return;
    try {
      await ordemServicoService.desvincularChamado(osDetalhe.id, chamadoId);
      await reloadDetalhe(osDetalhe.id);
    } catch { toast('error', 'Erro ao desvincular'); }
  }

  // Tecnicos
  async function handleAddTecnico() {
    if (!osDetalhe || !novoTecnicoId) return;
    try {
      await ordemServicoService.adicionarTecnico(osDetalhe.id, novoTecnicoId);
      await reloadDetalhe(osDetalhe.id);
      setShowAddTecnico(false); setNovoTecnicoId('');
    } catch { toast('error', 'Erro ao adicionar tecnico'); }
  }

  async function handleRemoveTecnico(tecId: string) {
    if (!osDetalhe || !await confirm('Remover Tecnico', 'Deseja remover este tecnico da OS?')) return;
    try {
      await ordemServicoService.removerTecnico(osDetalhe.id, tecId);
      await reloadDetalhe(osDetalhe.id);
    } catch { toast('error', 'Erro ao remover'); }
  }

  // Chamado filter for modal
  const chamadosFiltrados = chamadosDisponiveis.filter((c) => {
    if (chamadoFilterStatus && c.status !== chamadoFilterStatus) return false;
    if (chamadoFilterText) {
      const t = chamadoFilterText.toLowerCase();
      return c.titulo.toLowerCase().includes(t) || String(c.numero).includes(t);
    }
    return true;
  });

  // ============ DETAIL VIEW ============
  if (osDetalhe) {
    const os = osDetalhe;
    const encerrada = ['CONCLUIDA', 'CANCELADA'].includes(os.status);
    const canIniciar = isTecnico && os.status === 'ABERTA';
    const canEncerrar = isTecnico && os.status === 'EM_EXECUCAO';
    const canCancelar2 = isTecnico && !encerrada;
    const canEdit = isTecnico && !encerrada;

    return (
      <>
        <Header title={`OS #${os.numero}`} />
        <div className="p-6 max-w-5xl">
          <button onClick={() => setOsDetalhe(null)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          {/* Header card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{os.titulo}</h2>
                {os.descricao && <p className="text-sm text-slate-600 mt-1">{os.descricao}</p>}
              </div>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${statusColors[os.status]}`}>
                {statusLabels[os.status]}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-3">
              <span>Filial: <strong>{os.filial.codigo} — {os.filial.nomeFantasia}</strong></span>
              <span>Solicitante: <strong>{os.solicitante.nome}</strong></span>
              {os.dataAgendamento && <span>Agendamento: <strong>{new Date(os.dataAgendamento).toLocaleString('pt-BR')}</strong></span>}
              {os.dataInicio && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Inicio: <strong>{new Date(os.dataInicio).toLocaleString('pt-BR')}</strong>
                </span>
              )}
              {os.dataFim && (
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Fim: <strong>{new Date(os.dataFim).toLocaleString('pt-BR')}</strong>
                </span>
              )}
              {os.dataInicio && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Duracao: <strong>{formatDuracao(os.dataInicio, os.dataFim)}</strong>
                </span>
              )}
            </div>

            {os.observacoes && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                <strong>Observacoes:</strong> {os.observacoes}
              </div>
            )}

            {/* Action buttons */}
            {isTecnico && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {canIniciar && (
                  <button onClick={handleIniciar} disabled={actionLoading}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                    <Play className="w-4 h-4" /> Iniciar Execucao
                  </button>
                )}
                {canEncerrar && (
                  <button onClick={() => setShowEncerrar(true)} disabled={actionLoading}
                    className="flex items-center gap-1.5 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                    <Square className="w-4 h-4" /> Encerrar OS
                  </button>
                )}
                {canCancelar2 && (
                  <button onClick={handleCancelar} disabled={actionLoading}
                    className="flex items-center gap-1.5 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50">
                    <Ban className="w-4 h-4" /> Cancelar
                  </button>
                )}
                <button onClick={handleDownloadRelatorio}
                  className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm hover:bg-indigo-100 ml-auto">
                  <Download className="w-4 h-4" /> Gerar Relatorio
                </button>
              </div>
            )}

            {/* Encerrar panel */}
            {showEncerrar && (
              <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg space-y-3">
                <h4 className="text-sm font-medium text-teal-800">Encerrar Ordem de Servico</h4>
                <textarea value={encerrarObs} onChange={(e) => setEncerrarObs(e.target.value)}
                  placeholder="Observacoes finais (opcional)..." rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleEncerrar} disabled={actionLoading}
                    className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                    Confirmar Encerramento
                  </button>
                  <button onClick={() => setShowEncerrar(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                </div>
              </div>
            )}
          </div>

          {/* Tecnicos */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Tecnicos ({os.tecnicos.length})
              </h3>
              {canEdit && (
                <button onClick={() => setShowAddTecnico(!showAddTecnico)}
                  className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700">
                  {showAddTecnico ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {showAddTecnico ? 'Fechar' : 'Adicionar'}
                </button>
              )}
            </div>

            {showAddTecnico && (
              <div className="flex items-center gap-2 mb-3 p-3 bg-teal-50 rounded-lg">
                <select value={novoTecnicoId} onChange={(e) => setNovoTecnicoId(e.target.value)}
                  className="flex-1 border border-slate-200 rounded px-2 py-1.5 text-sm">
                  <option value="">Selecione o tecnico...</option>
                  {tecnicos
                    .filter((u) => !os.tecnicos.some((t) => t.tecnicoId === u.id))
                    .map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <button onClick={handleAddTecnico} disabled={!novoTecnicoId}
                  className="bg-teal-600 text-white px-3 py-1.5 rounded text-sm hover:bg-teal-700 disabled:opacity-50">Adicionar</button>
              </div>
            )}

            {os.tecnicos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum tecnico atribuido</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {os.tecnicos.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="text-sm text-slate-700">{t.tecnico.nome}</span>
                    {canEdit && (
                      <button onClick={() => handleRemoveTecnico(t.tecnicoId)} className="text-slate-400 hover:text-red-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chamados vinculados */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Chamados Vinculados ({os.chamados.length})
              </h3>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={openModalChamados}
                    className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700">
                    <Link2 className="w-4 h-4" /> Vincular Existentes
                  </button>
                  <button onClick={() => navigate(`/gestao-ti/chamados/novo?osId=${os.id}`)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                    <Plus className="w-4 h-4" /> Novo Chamado
                  </button>
                </div>
              )}
            </div>

            {os.chamados.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum chamado vinculado</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Titulo</th>
                    <th className="px-3 py-2">Status</th>
                    {canEdit && <th className="px-3 py-2 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {os.chamados.map((oc) => (
                    <tr key={oc.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-slate-500">#{oc.chamado.numero}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => navigate(`/gestao-ti/chamados/${oc.chamadoId}`)}
                          className="text-teal-600 hover:underline text-left">{oc.chamado.titulo}</button>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusChamadoCores[oc.chamado.status] || ''}`}>
                          {statusChamadoLabel[oc.chamado.status] || oc.chamado.status}
                        </span>
                      </td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <button onClick={() => handleDesvincularChamado(oc.chamadoId)}
                            className="text-slate-400 hover:text-red-500"><Unlink className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal vincular chamados */}
          {showModalChamados && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModalChamados(false)}>
              <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Vincular Chamados</h3>
                  <button onClick={() => setShowModalChamados(false)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>

                <div className="px-6 py-3 border-b border-slate-100 flex gap-3">
                  <input value={chamadoFilterText} onChange={(e) => setChamadoFilterText(e.target.value)}
                    placeholder="Buscar por numero ou titulo..." className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <select value={chamadoFilterStatus} onChange={(e) => setChamadoFilterStatus(e.target.value as StatusChamado | '')}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todos status</option>
                    {Object.entries(statusChamadoLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>

                <div className="flex-1 overflow-auto px-6 py-2">
                  {loadingChamados ? (
                    <p className="text-slate-500 text-center py-8">Carregando...</p>
                  ) : chamadosFiltrados.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">Nenhum chamado disponivel</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs text-slate-500 uppercase sticky top-0 bg-white">
                        <tr>
                          <th className="px-3 py-2 w-10"></th>
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Titulo</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Equipe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {chamadosFiltrados.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50 cursor-pointer"
                            onClick={() => {
                              const next = new Set(chamadosSelecionados);
                              next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                              setChamadosSelecionados(next);
                            }}>
                            <td className="px-3 py-2">
                              <input type="checkbox" checked={chamadosSelecionados.has(c.id)} readOnly
                                className="rounded border-slate-300 text-teal-600" />
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500">#{c.numero}</td>
                            <td className="px-3 py-2 text-slate-700 max-w-[250px] truncate">{c.titulo}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${statusChamadoCores[c.status] || ''}`}>
                                {statusChamadoLabel[c.status] || c.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-500">{c.equipeAtual?.sigla || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">{chamadosSelecionados.size} selecionado(s)</span>
                  <div className="flex gap-2">
                    <button onClick={() => setShowModalChamados(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
                    <button onClick={handleVincularChamados} disabled={chamadosSelecionados.size === 0 || actionLoading}
                      className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50">
                      Vincular ({chamadosSelecionados.size})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ============ LIST VIEW ============
  return (
    <>
      <Header title="Ordens de Servico" />
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as StatusOS | '')}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">Todos os Status</option>
            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>

          <div className="flex items-center gap-2">
            <button onClick={() => exportService.exportar('ordens-servico')}
              className="flex items-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors">
              <Download className="w-4 h-4" /> Exportar Excel
            </button>
            {isTecnico && (
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors">
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancelar' : 'Nova OS'}
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 mb-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filial *</label>
                <select value={filialId} onChange={(e) => setFilialId(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione a filial...</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nomeFantasia}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tecnico Responsavel</label>
                <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Selecione (adicionar depois)</option>
                  {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
              <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Agendamento</label>
                <input type="datetime-local" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
                <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="(opcional)" />
              </div>
            </div>

            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar OS'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : ordens.length === 0 ? (
          <div className="text-center py-12 text-slate-400">Nenhuma ordem de servico encontrada</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tecnicos</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Chamados</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Agendamento</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Duracao</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordens.map((os) => (
                  <tr key={os.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => openDetalhe(os)}>
                    <td className="px-4 py-3 text-slate-500 font-mono">#{os.numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{os.titulo}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[os.status]}`}>
                        {statusLabels[os.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {os.tecnicos.length > 0 ? os.tecnicos.map((t) => t.tecnico.nome).join(', ') : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{os._count.chamados || '-'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {os.dataAgendamento ? new Date(os.dataAgendamento).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {os.dataInicio ? formatDuracao(os.dataInicio, os.dataFim) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(os.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
