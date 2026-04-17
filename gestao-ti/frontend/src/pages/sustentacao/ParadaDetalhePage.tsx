import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { paradaService } from '../../services/parada.service';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { Activity, ArrowLeft, Clock, AlertTriangle, Building2, User, Wrench, Unlink, Plus, Ticket, X, Filter, CheckSquare, Users, Trash2, Search, Pencil, Paperclip, Download } from 'lucide-react';
import type { RegistroParada, Chamado, EquipeTI } from '../../types';
import { useToast } from '../../components/Toast';

const tipoLabel: Record<string, string> = {
  PARADA_PROGRAMADA: 'Programada',
  PARADA_NAO_PROGRAMADA: 'Nao Programada',
  MANUTENCAO_PREVENTIVA: 'Manut. Preventiva',
};

const impactoLabel: Record<string, string> = {
  TOTAL: 'Total',
  PARCIAL: 'Parcial',
};

const statusLabel: Record<string, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const statusCores: Record<string, string> = {
  EM_ANDAMENTO: 'bg-red-100 text-red-700',
  FINALIZADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-slate-100 text-slate-600',
};

const impactoCores: Record<string, string> = {
  TOTAL: 'bg-red-100 text-red-700',
  PARCIAL: 'bg-amber-100 text-amber-700',
};

function formatDuracao(minutos: number | null): string {
  if (minutos == null) return '-';
  if (minutos < 1) return '< 1m';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ParadaDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const { toast, confirm } = useToast();
  const canCancel = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [parada, setParada] = useState<RegistroParada | null>(null);
  const [loading, setLoading] = useState(true);

  // Anexos
  type AnexoParada = { id: string; nomeOriginal: string; mimeType: string; tamanho: number; createdAt: string; usuario: { id: string; nome: string } };
  const [anexos, setAnexos] = useState<AnexoParada[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [fimInput, setFimInput] = useState('');
  const [obsInput, setObsInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      paradaService.buscar(id).then(setParada).catch(() => {}).finally(() => setLoading(false));
      paradaService.listarAnexos(id).then(setAnexos).catch(() => {});
    }
  }, [id]);

  async function handleFinalizar() {
    if (!id) return;
    setActionLoading(true);
    try {
      const updated = await paradaService.finalizar(id, {
        fim: fimInput ? new Date(fimInput).toISOString() : undefined,
        observacoes: obsInput || undefined,
      });
      setParada(updated);
      setShowFinalizar(false);
    } catch { /* empty */ }
    setActionLoading(false);
  }

  async function handleCancelar() {
    if (!id || !await confirm('Cancelar Parada', 'Confirma o cancelamento desta parada?', { variant: 'danger', confirmLabel: 'Sim, cancelar' })) return;
    setActionLoading(true);
    try {
      const updated = await paradaService.cancelar(id);
      setParada(updated);
    } catch { /* empty */ }
    setActionLoading(false);
  }

  if (loading) {
    return (
      <>
        <Header title="Parada" />
        <div className="p-6 text-slate-500">Carregando...</div>
      </>
    );
  }

  if (!parada) {
    return (
      <>
        <Header title="Parada" />
        <div className="p-6 text-slate-500">Parada nao encontrada</div>
      </>
    );
  }

  return (
    <>
      <Header title="Detalhe da Parada" />
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Activity className="w-5 h-5 text-red-500" />
                <h3 className="text-lg font-semibold text-slate-800">{parada.titulo}</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusCores[parada.status]}`}>
                  {statusLabel[parada.status]}
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
                  {tipoLabel[parada.tipo]}
                </span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${impactoCores[parada.impacto]}`}>
                  Impacto {impactoLabel[parada.impacto]}
                </span>
              </div>
            </div>
            {parada.status === 'EM_ANDAMENTO' && (
              <div className="flex gap-2">
                {canManage && (
                  <>
                    <Link
                      to={`/gestao-ti/paradas/${parada.id}/editar`}
                      className="flex items-center gap-1 text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Link>
                    <button
                      onClick={() => setShowFinalizar(true)}
                      className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
                    >
                      Finalizar
                    </button>
                  </>
                )}
                {canCancel && (
                  <button
                    onClick={handleCancelar}
                    disabled={actionLoading}
                    className="text-xs border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            )}
          </div>

          {parada.descricao && (
            <p className="text-sm text-slate-600 mt-4">{parada.descricao}</p>
          )}
        </div>

        {/* Finalizar modal */}
        {showFinalizar && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="font-medium text-slate-700 mb-3">Finalizar Parada</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Data/Hora Fim</label>
                <input
                  type="datetime-local"
                  value={fimInput}
                  onChange={(e) => setFimInput(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full max-w-xs"
                />
                <p className="text-xs text-slate-400 mt-1">Se vazio, usa a data/hora atual</p>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Observacoes</label>
                <textarea
                  value={obsInput}
                  onChange={(e) => setObsInput(e.target.value)}
                  rows={2}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFinalizar}
                  disabled={actionLoading}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Finalizando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setShowFinalizar(false)}
                  className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Informacoes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Informacoes
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Software</span>
                <a href={`/gestao-ti/softwares/${parada.softwareId}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline">
                  {parada.software.nome}
                </a>
              </div>
              {parada.softwareModulo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Modulo</span>
                  <span className="text-slate-700">{parada.softwareModulo.nome}</span>
                </div>
              )}
              {parada.motivoParada && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Motivo</span>
                  <span className="text-slate-700 font-medium">{parada.motivoParada.nome}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Inicio</span>
                <span className="text-slate-700">{formatDateTime(parada.inicio)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fim</span>
                <span className="text-slate-700">
                  {parada.fim ? formatDateTime(parada.fim) : (
                    <span className="text-red-500 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Em curso
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duracao</span>
                <span className="text-slate-700 font-medium">{formatDuracao(parada.duracaoMinutos)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chamados</span>
                <span className="text-slate-700">{parada.chamados.length} vinculado(s)</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h4 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Responsaveis
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Registrado por</span>
                <span className="text-slate-700">{parada.registradoPor.nome}</span>
              </div>
              {parada.finalizadoPor && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Finalizado por</span>
                  <span className="text-slate-700">{parada.finalizadoPor.nome}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Criado em</span>
                <span className="text-slate-700">{formatDateTime(parada.createdAt)}</span>
              </div>
            </div>

            {parada.observacoes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Observacoes</p>
                <p className="text-sm text-slate-600">{parada.observacoes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chamados Vinculados */}
        <div className="mb-6">
          <TabChamados parada={parada} canManage={canManage} onUpdate={setParada} />
        </div>

        {/* Tecnicos Colaboradores */}
        <div className="mb-6">
          <TabColaboradores parada={parada} canManage={canManage} onUpdate={setParada} />
        </div>

        {/* Anexos */}
        <div className="bg-white rounded-xl border border-slate-200 mb-6">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h4 className="font-medium text-slate-700 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Anexos ({anexos.length})
            </h4>
            {canManage && parada.status !== 'CANCELADA' && (
              <label className="flex items-center gap-2 text-xs text-emerald-600 hover:text-emerald-800 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                {uploadingAnexo ? 'Enviando...' : 'Anexar arquivo'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingAnexo}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !id) return;
                    e.target.value = '';
                    setUploadingAnexo(true);
                    try {
                      await paradaService.uploadAnexo(id, file);
                      const updated = await paradaService.listarAnexos(id);
                      setAnexos(updated);
                      toast('success', 'Anexo enviado');
                    } catch { toast('error', 'Erro ao enviar anexo'); }
                    setUploadingAnexo(false);
                  }}
                />
              </label>
            )}
          </div>
          {anexos.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-400">Nenhum anexo</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {anexos.map((a) => (
                <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => {
                        const viewable = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
                        if (viewable.includes(a.mimeType)) {
                          paradaService.abrirAnexo(id!, a.id, a.mimeType).catch(() => {
                            paradaService.downloadAnexo(id!, a.id, a.nomeOriginal);
                          });
                        } else {
                          paradaService.downloadAnexo(id!, a.id, a.nomeOriginal);
                        }
                      }}
                      className="text-sm text-capul-700 hover:underline truncate text-left"
                    >
                      {a.nomeOriginal}
                    </button>
                    <p className="text-xs text-slate-400">{(a.tamanho / 1024).toFixed(0)} KB — {a.usuario.nome} — {new Date(a.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => paradaService.downloadAnexo(id!, a.id, a.nomeOriginal)} className="p-1 text-slate-400 hover:text-capul-600" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                  {canManage && parada.status !== 'CANCELADA' && (
                    <button
                      onClick={async () => {
                        if (!await confirm('Remover Anexo', `Remover "${a.nomeOriginal}"?`, { variant: 'danger' })) return;
                        try {
                          await paradaService.removerAnexo(id!, a.id);
                          setAnexos((prev) => prev.filter((x) => x.id !== a.id));
                          toast('success', 'Anexo removido');
                        } catch { toast('error', 'Erro ao remover'); }
                      }}
                      className="p-1 text-slate-400 hover:text-red-500"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filiais Afetadas */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h4 className="font-medium text-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Filiais Afetadas ({parada.filiaisAfetadas.length})
            </h4>
          </div>
          {parada.filiaisAfetadas.length === 0 ? (
            <p className="px-6 py-4 text-sm text-slate-400">Nenhuma filial registrada</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {parada.filiaisAfetadas.map((fa) => (
                <div key={fa.id} className="px-6 py-3 flex items-center gap-3">
                  <Wrench className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    {fa.filial.codigo} - {fa.filial.nomeFantasia}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const statusChamadoCores: Record<string, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  EM_ATENDIMENTO: 'bg-amber-100 text-amber-700',
  AGUARDANDO_USUARIO: 'bg-purple-100 text-purple-700',
  RESOLVIDO: 'bg-green-100 text-green-700',
  REABERTO: 'bg-orange-100 text-orange-700',
  FECHADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-700',
};

const statusChamadoLabel: Record<string, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em Atendimento',
  AGUARDANDO_USUARIO: 'Aguardando',
  RESOLVIDO: 'Resolvido',
  REABERTO: 'Reaberto',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
};

function TabChamados({ parada, canManage, onUpdate }: { parada: RegistroParada; canManage: boolean; onUpdate: (p: RegistroParada) => void }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  async function handleDesvincular(chamadoId: string) {
    try {
      const updated = await paradaService.desvincularChamado(parada.id, chamadoId);
      onUpdate(updated);
      toast('success', 'Chamado desvinculado');
    } catch {
      toast('error', 'Erro ao desvincular chamado');
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-medium text-slate-700 flex items-center gap-2">
            <Ticket className="w-4 h-4" /> Chamados Vinculados ({parada.chamados.length})
          </h4>
          {canManage && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1 text-xs text-capul-600 hover:text-capul-700 font-medium"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Vincular Existentes
              </button>
              <a
                href={`/gestao-ti/chamados/novo?paradaId=${parada.id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Chamado
              </a>
            </div>
          )}
        </div>

        {parada.chamados.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-400 text-center">Nenhum chamado vinculado a esta parada</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {parada.chamados.map((pc) => (
              <div key={pc.id} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4 text-slate-400" />
                  <a href={`/gestao-ti/chamados/${pc.chamado.id}`} target="_blank" rel="noopener noreferrer" className="text-sm text-capul-600 hover:underline font-medium">
                    #{pc.chamado.numero}
                  </a>
                  <span className="text-sm text-slate-600">{pc.chamado.titulo}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${statusChamadoCores[pc.chamado.status] || 'bg-slate-100 text-slate-600'}`}>
                    {pc.chamado.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDesvincular(pc.chamadoId)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Desvincular"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ModalVincularChamados
          parada={parada}
          onUpdate={onUpdate}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ModalVincularChamados({ parada, onUpdate, onClose }: { parada: RegistroParada; onUpdate: (p: RegistroParada) => void; onClose: () => void }) {
  const { toast } = useToast();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [vinculando, setVinculando] = useState(false);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [filtroEquipe, setFiltroEquipe] = useState<string>('');

  const idsVinculados = parada.chamados.map((c) => c.chamadoId);

  useEffect(() => {
    Promise.all([
      chamadoService.listar(),
      equipeService.listar('ATIVO'),
    ]).then(([ch, eq]) => {
      const statusTerminais = ['RESOLVIDO', 'FECHADO', 'CANCELADO'];
      setChamados(ch.filter((c) => !idsVinculados.includes(c.id) && !statusTerminais.includes(c.status)));
      setEquipes(eq);
    }).catch(() => {
      toast('error', 'Erro ao carregar chamados');
    }).finally(() => setLoading(false));
  }, []);

  const filtrados = chamados.filter((c) => {
    if (filtroStatus && c.status !== filtroStatus) return false;
    if (filtroEquipe && c.equipeAtual?.id !== filtroEquipe) return false;
    if (filtroTexto) {
      const termo = filtroTexto.toLowerCase();
      const matchNumero = String(c.numero).includes(termo);
      const matchTitulo = c.titulo.toLowerCase().includes(termo);
      if (!matchNumero && !matchTitulo) return false;
    }
    return true;
  });

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((c) => c.id)));
    }
  }

  async function handleVincular() {
    if (selecionados.size === 0) return;
    setVinculando(true);
    let lastUpdated: RegistroParada | null = null;
    let count = 0;
    for (const chamadoId of selecionados) {
      try {
        lastUpdated = await paradaService.vincularChamado(parada.id, chamadoId);
        count++;
      } catch { /* continue with next */ }
    }
    if (lastUpdated) onUpdate(lastUpdated);
    toast('success', `${count} chamado(s) vinculado(s)`);
    setVinculando(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Vincular Chamados</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por numero ou titulo..."
              className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Todos os Status</option>
              {Object.entries(statusChamadoLabel).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={filtroEquipe}
              onChange={(e) => setFiltroEquipe(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">Todas as Equipes</option>
              {equipes.map((eq) => (
                <option key={eq.id} value={eq.id}>{eq.sigla} - {eq.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Carregando chamados...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Nenhum chamado encontrado</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selecionados.size > 0 && selecionados.size === filtrados.length}
                      onChange={toggleTodos}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Titulo</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Equipe</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => toggleSelecionado(c.id)}
                    className={`cursor-pointer transition-colors ${selecionados.has(c.id) ? 'bg-capul-50' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => toggleSelecionado(c.id)}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-700">{c.numero}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-[250px] truncate">{c.titulo}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${statusChamadoCores[c.status] || 'bg-slate-100 text-slate-600'}`}>
                        {statusChamadoLabel[c.status] || c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.equipeAtual?.sigla || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <span className="text-sm text-slate-500">
            {filtrados.length} chamado(s) encontrado(s)
            {selecionados.size > 0 && (
              <span className="ml-2 font-medium text-capul-600">{selecionados.size} selecionado(s)</span>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="border border-slate-300 text-slate-600 px-4 py-2 rounded-lg text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={handleVincular}
              disabled={selecionados.size === 0 || vinculando}
              className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50"
            >
              {vinculando ? 'Vinculando...' : `Vincular ${selecionados.size > 0 ? `(${selecionados.size})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabColaboradores({ parada, canManage, onUpdate }: { parada: RegistroParada; canManage: boolean; onUpdate: (p: RegistroParada) => void }) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [membros, setMembros] = useState<{ id: string; nome: string; username: string }[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  async function loadMembros() {
    setLoadingMembros(true);
    try {
      const equipes = await equipeService.listar('ATIVO');
      const todosSet = new Map<string, { id: string; nome: string; username: string }>();
      for (const eq of equipes) {
        if (eq.membros) {
          for (const m of eq.membros) {
            todosSet.set(m.usuario.id, m.usuario);
          }
        }
      }
      // Excluir quem ja e colaborador e quem registrou a parada
      const idsColabs = new Set(parada.colaboradores.map((c) => c.usuarioId));
      idsColabs.add(parada.registradoPorId);
      setMembros(Array.from(todosSet.values()).filter((u) => !idsColabs.has(u.id)));
    } catch { setMembros([]); }
    setLoadingMembros(false);
  }

  function handleOpenAdd() {
    setShowAdd(true);
    setSearchTerm('');
    loadMembros();
  }

  async function handleAdd(usuarioId: string) {
    try {
      const updated = await paradaService.adicionarColaborador(parada.id, usuarioId);
      onUpdate(updated);
      setMembros((prev) => prev.filter((m) => m.id !== usuarioId));
      toast('success', 'Colaborador adicionado');
    } catch {
      toast('error', 'Erro ao adicionar colaborador');
    }
  }

  async function handleRemove(colaboradorId: string) {
    try {
      const updated = await paradaService.removerColaborador(parada.id, colaboradorId);
      onUpdate(updated);
      toast('success', 'Colaborador removido');
    } catch {
      toast('error', 'Erro ao remover colaborador');
    }
  }

  const filteredMembros = searchTerm
    ? membros.filter((m) => m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || m.username.toLowerCase().includes(searchTerm.toLowerCase()))
    : membros;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-medium text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4" /> Tecnicos Colaboradores ({parada.colaboradores.length})
        </h4>
        {canManage && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1 text-xs text-capul-600 hover:text-capul-700 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        )}
      </div>

      {showAdd && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar tecnico por nome ou username..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          {loadingMembros ? (
            <p className="text-sm text-slate-400">Carregando...</p>
          ) : filteredMembros.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum tecnico disponivel</p>
          ) : (
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white max-h-48 overflow-y-auto">
              {filteredMembros.map((m) => (
                <div key={m.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">{m.nome}</span>
                    <span className="text-xs text-slate-400">({m.username})</span>
                  </div>
                  <button
                    onClick={() => handleAdd(m.id)}
                    className="text-xs px-3 py-1 bg-capul-600 text-white rounded hover:bg-capul-700"
                  >
                    Adicionar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {parada.colaboradores.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-400 text-center">Nenhum tecnico colaborador</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {parada.colaboradores.map((c) => (
            <div key={c.id} className="px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-700">{c.usuario.nome}</span>
                <span className="text-xs text-slate-400">({c.usuario.username})</span>
              </div>
              {canManage && (
                <button
                  onClick={() => handleRemove(c.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  title="Remover colaborador"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
