import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { paradaService } from '../../services/parada.service';
import { Activity, ArrowLeft, Clock, AlertTriangle, Building2, User, Wrench } from 'lucide-react';
import type { RegistroParada } from '../../types';

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
  const canManage = ['ADMIN', 'GESTOR_TI', 'TECNICO'].includes(gestaoTiRole || '');
  const canCancel = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [parada, setParada] = useState<RegistroParada | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [fimInput, setFimInput] = useState('');
  const [obsInput, setObsInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      paradaService.buscar(id).then(setParada).catch(() => {}).finally(() => setLoading(false));
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
    if (!id || !confirm('Confirma o cancelamento desta parada?')) return;
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
                      className="text-xs border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                    >
                      Editar
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
                <Link to={`/gestao-ti/softwares/${parada.softwareId}`} className="text-capul-600 hover:underline">
                  {parada.software.nome}
                </Link>
              </div>
              {parada.softwareModulo && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Modulo</span>
                  <span className="text-slate-700">{parada.softwareModulo.nome}</span>
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
              {parada.chamado && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Chamado</span>
                  <Link to={`/gestao-ti/chamados/${parada.chamado.id}`} className="text-capul-600 hover:underline">
                    #{parada.chamado.numero} - {parada.chamado.titulo}
                  </Link>
                </div>
              )}
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
