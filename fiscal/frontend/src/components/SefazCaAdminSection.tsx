import { useState } from 'react';
import {
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  FlaskConical,
  Calendar,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { useSefazCaStatus } from '../hooks/useSefazCaStatus';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import { fmtDataHora } from '../utils/format';
import { Badge } from './Badge';
import type { SefazRefreshResult, SefazCertificadoInfo, SefazRefreshLog } from '../types';

/**
 * Seção detalhada da cadeia TLS SEFAZ para a AdminPage.
 * Mostra status, lista completa de certificados, histórico de refresh
 * e botão de refresh manual (só para ADMIN_TI).
 */
export function SefazCaAdminSection() {
  const { status, loading, reload } = useSefazCaStatus();
  const { fiscalRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);
  const isAdmin = hasMinRole(fiscalRole, 'ADMIN_TI');

  async function handleRefresh() {
    const ok = await confirm({
      title: 'Atualizar cadeia TLS SEFAZ?',
      description:
        'Vai conectar aos servidores da SEFAZ (MG, AN, SVRS) e extrair os certificados ' +
        'da cadeia ICP-Brasil, substituindo os atuais. Os antigos só são removidos após ' +
        'a extração bem-sucedida — se falhar, a cadeia atual é preservada.',
      variant: 'info',
      confirmLabel: 'Atualizar agora',
    });
    if (!ok) return;

    setRefreshing(true);
    try {
      const { data } = await fiscalApi.post<SefazRefreshResult>('/sefaz/ca/refresh');
      if (data.sucesso) {
        toast.success(
          'Cadeia TLS atualizada',
          `${data.certificadosExtraidos} certificado(s) extraído(s) e salvos.`,
        );
      } else {
        toast.warning('Refresh parcial ou falha', data.mensagem);
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
        <div className="text-sm text-slate-500">Carregando cadeia TLS…</div>
      </div>
    );
  }

  const scheme = schemeFromSeveridade(status.severidade, status.modo);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <scheme.Icon className={`h-4 w-4 ${scheme.iconColor}`} />
              Cadeia TLS SEFAZ
              <Badge variant={scheme.badgeVariant}>{scheme.label}</Badge>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{status.mensagem}</p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando…' : 'Atualizar cadeia agora'}
            </button>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 border-b border-slate-100 px-5 py-4 text-xs md:grid-cols-4">
        <Metric label="Certificados" value={String(status.totalCertificados)} />
        <Metric
          label="Idade"
          value={status.idadeDias !== null ? `${status.idadeDias} dias` : '—'}
        />
        <Metric label="Último refresh" value={fmtDataHora(status.ultimoRefresh)} />
        <Metric
          label="Auto-refresh"
          value={status.autoRefreshAtivo ? 'Ativo (03:00)' : 'Desativado'}
        />
        <Metric label="Modo" value={status.modo} mono />
        <Metric label="TLS Strict" value={status.tlsStrict ? 'Sim' : 'Não'} />
        <Metric label="Caminho" value={status.caPath} mono wide />
      </div>

      {/* Lista de certificados */}
      <div className="border-b border-slate-100 px-5 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Certificados carregados ({status.certificados.length})
        </h4>
        {status.certificados.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600 flex items-start gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-slate-400" />
            <span>
              Nenhum certificado carregado. {isAdmin ? 'Clique em "Atualizar cadeia agora" para extrair dos endpoints SEFAZ.' : 'Peça ao ADMIN_TI para atualizar.'}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {status.certificados.map((cert, idx) => (
              <CertificadoRow key={`${cert.arquivo}-${idx}`} cert={cert} />
            ))}
          </div>
        )}
      </div>

      {/* Histórico de refresh */}
      {status.ultimasAtualizacoes.length > 0 && (
        <div className="px-5 py-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Histórico das últimas atualizações
          </h4>
          <div className="space-y-1.5">
            {status.ultimasAtualizacoes.map((log, idx) => (
              <RefreshLogRow key={idx} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 md:col-span-4' : ''}>
      <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`text-xs text-slate-900 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}

function CertificadoRow({ cert }: { cert: SefazCertificadoInfo }) {
  const pertoVencer = cert.diasParaVencer < 30;
  const vencido = cert.diasParaVencer < 0;
  return (
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="flex-shrink-0 mt-0.5">
        {vencido ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : pertoVencer ? (
          <ShieldAlert className="h-4 w-4 text-amber-500" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 truncate">
          {cert.commonName ?? cert.arquivo}
        </div>
        {cert.issuer && cert.issuer !== cert.commonName && (
          <div className="text-slate-500 truncate">
            Emitido por: <span className="font-mono">{cert.issuer}</span>
          </div>
        )}
        <div className="flex items-center gap-4 mt-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Válido até {new Date(cert.validoAte).toLocaleDateString('pt-BR')}
          </span>
          <span
            className={
              vencido
                ? 'text-red-600 font-semibold'
                : pertoVencer
                  ? 'text-amber-600 font-semibold'
                  : ''
            }
          >
            {vencido
              ? `Vencido há ${Math.abs(cert.diasParaVencer)}d`
              : `${cert.diasParaVencer} dias restantes`}
          </span>
          <span className="font-mono text-slate-400 truncate">SN: {cert.serial.slice(0, 16)}…</span>
        </div>
      </div>
    </div>
  );
}

function RefreshLogRow({ log }: { log: SefazRefreshLog }) {
  return (
    <div className="flex items-start gap-2 text-xs border-l-2 border-slate-200 pl-3 py-1">
      {log.sucesso ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-slate-700">
          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
            {log.origem}
          </span>{' '}
          {log.mensagem}
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          {fmtDataHora(log.timestamp)}
          {log.usuarioEmail && ` · ${log.usuarioEmail}`}
        </div>
      </div>
    </div>
  );
}

function schemeFromSeveridade(severidade: string, modo: string) {
  if (modo === 'INSEGURO_SEM_CADEIA') {
    return {
      Icon: FlaskConical,
      iconColor: 'text-slate-500',
      badgeVariant: 'gray' as const,
      label: 'INSEGURO',
    };
  }
  if (severidade === 'CRITICO') {
    return { Icon: ShieldX, iconColor: 'text-red-600', badgeVariant: 'red' as const, label: 'CRÍTICO' };
  }
  if (severidade === 'ATENCAO') {
    return {
      Icon: ShieldAlert,
      iconColor: 'text-amber-600',
      badgeVariant: 'yellow' as const,
      label: 'ATENÇÃO',
    };
  }
  return {
    Icon: ShieldCheck,
    iconColor: 'text-emerald-600',
    badgeVariant: 'green' as const,
    label: 'VALIDADA',
  };
}
