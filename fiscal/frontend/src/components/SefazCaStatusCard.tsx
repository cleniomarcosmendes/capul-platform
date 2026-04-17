import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RotateCw,
  ArrowRight,
  FlaskConical,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { useSefazCaStatus } from '../hooks/useSefazCaStatus';
import { useToast } from './Toast';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import { fmtDataHora } from '../utils/format';
import type { SefazRefreshResult } from '../types';

/**
 * Card de status da cadeia TLS SEFAZ para o Dashboard.
 * Mostra severidade, total, idade, último refresh e botão de atualização.
 */
export function SefazCaStatusCard() {
  const { status, loading, reload } = useSefazCaStatus();
  const { fiscalRole } = useAuth();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = hasMinRole(fiscalRole, 'ADMIN_TI');

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { data } = await fiscalApi.post<SefazRefreshResult>('/sefaz/ca/refresh');
      if (data.sucesso) {
        toast.success(
          'Cadeia TLS atualizada',
          `${data.certificadosExtraidos} certificado(s) extraído(s) dos endpoints SEFAZ.`,
        );
      } else {
        toast.warning('Refresh parcial', data.mensagem);
      }
      await reload();
    } catch (err) {
      toast.error('Falha no refresh', extractApiError(err));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading || !status) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs text-slate-400">Carregando status TLS…</div>
      </div>
    );
  }

  const scheme = schemeFromStatus(status);

  return (
    <div className={`rounded-lg border ${scheme.border} bg-white shadow-sm overflow-hidden`}>
      <div className={`${scheme.headerBg} border-b ${scheme.border} px-5 py-4`}>
        <div className="flex items-center gap-3">
          <scheme.Icon className={`h-5 w-5 ${scheme.iconColor}`} />
          <div className="flex-1">
            <div className={`text-sm font-semibold ${scheme.titleColor}`}>
              Cadeia TLS SEFAZ — {scheme.label}
            </div>
            <div className={`text-xs ${scheme.bodyColor} mt-0.5`}>{status.mensagem}</div>
          </div>
        </div>
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <Metric label="Certificados carregados" value={String(status.totalCertificados)} />
          <Metric
            label="Idade"
            value={status.idadeDias !== null ? `${status.idadeDias} dias` : '—'}
          />
          <Metric label="Último refresh" value={fmtDataHora(status.ultimoRefresh)} />
          <Metric
            label="Auto-refresh"
            value={status.autoRefreshAtivo ? 'Ativo' : 'Desativado'}
          />
        </div>

        {status.modo === 'INSEGURO_SEM_CADEIA' && (
          <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <FlaskConical className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-400" />
            <span>
              Modo inseguro: <code className="font-mono">rejectUnauthorized: false</code>. Use
              "Atualizar agora" para extrair a cadeia dos endpoints SEFAZ.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          {isAdmin && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando…' : 'Atualizar agora'}
            </button>
          )}
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            Ver detalhes <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400 uppercase tracking-wide text-[10px]">{label}</dt>
      <dd className="text-slate-900 font-medium">{value}</dd>
    </div>
  );
}

function schemeFromStatus(status: { severidade: string; modo: string }) {
  if (status.modo === 'INSEGURO_SEM_CADEIA') {
    return {
      Icon: FlaskConical,
      iconColor: 'text-slate-500',
      border: 'border-slate-200',
      headerBg: 'bg-slate-50',
      titleColor: 'text-slate-800',
      bodyColor: 'text-slate-600',
      label: 'INSEGURO',
    };
  }
  if (status.severidade === 'CRITICO') {
    return {
      Icon: ShieldX,
      iconColor: 'text-red-600',
      border: 'border-red-200',
      headerBg: 'bg-red-50',
      titleColor: 'text-red-900',
      bodyColor: 'text-red-700',
      label: 'CRÍTICO',
    };
  }
  if (status.severidade === 'ATENCAO') {
    return {
      Icon: ShieldAlert,
      iconColor: 'text-amber-600',
      border: 'border-amber-200',
      headerBg: 'bg-amber-50',
      titleColor: 'text-amber-900',
      bodyColor: 'text-amber-800',
      label: 'ATENÇÃO',
    };
  }
  return {
    Icon: ShieldCheck,
    iconColor: 'text-emerald-600',
    border: 'border-emerald-200',
    headerBg: 'bg-emerald-50',
    titleColor: 'text-emerald-900',
    bodyColor: 'text-emerald-800',
    label: 'VALIDADA',
  };
}
