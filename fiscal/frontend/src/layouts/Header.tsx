import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fiscalApi } from '../services/api';
import { User, Radio, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { AmbienteStatus } from '../types';
import { useSefazCaStatus } from '../hooks/useSefazCaStatus';

export function Header({ title }: { title: string }) {
  const { usuario, fiscalRole } = useAuth();
  const navigate = useNavigate();
  const [ambiente, setAmbiente] = useState<string | null>(null);
  const { status: caStatus } = useSefazCaStatus();

  useEffect(() => {
    fiscalApi
      .get<AmbienteStatus>('/ambiente')
      .then(({ data }) => setAmbiente(data.ambienteAtivo))
      .catch(() => {});
  }, []);

  const isProd = ambiente === 'PRODUCAO';

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-4">
        <TlsBadge status={caStatus} onClick={() => navigate('/operacao/tls')} />
        {ambiente && (
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
              isProd
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <Radio className={`w-3 h-3 ${isProd ? 'text-red-500' : 'text-amber-500'}`} />
            SEFAZ-{isProd ? 'PRD' : 'HLG'}
          </div>
        )}
        {fiscalRole && (
          <span className="text-xs px-2 py-1 rounded-full bg-capul-100 text-capul-700 font-medium">
            {fiscalRole}
          </span>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {usuario?.nome}
        </div>
      </div>
    </header>
  );
}

/**
 * Badge do status da cadeia TLS SEFAZ sempre visível no header.
 * Clicável — leva para AdminPage (seção Cadeia TLS) para atualização manual.
 */
function TlsBadge({
  status,
  onClick,
}: {
  status: ReturnType<typeof useSefazCaStatus>['status'];
  onClick: () => void;
}) {
  if (!status) return null;

  const { severidade, modo, idadeDias } = status;

  let Icon = ShieldCheck;
  let bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let iconColor = 'text-emerald-500';
  let label = 'TLS-OK';
  let title = `Cadeia TLS SEFAZ validada${idadeDias !== null ? ` (${idadeDias}d)` : ''}`;

  if (modo === 'INSEGURO_SEM_CADEIA') {
    Icon = ShieldX;
    bg = 'bg-slate-100 text-slate-700 border-slate-300';
    iconColor = 'text-slate-500';
    label = 'TLS-OFF';
    title = 'Cadeia TLS SEFAZ não carregada — modo inseguro (dev)';
  } else if (severidade === 'CRITICO') {
    Icon = ShieldX;
    bg = 'bg-red-50 text-red-700 border-red-200';
    iconColor = 'text-red-500';
    label = idadeDias !== null ? `TLS-${idadeDias}d` : 'TLS-?';
    title = status.mensagem;
  } else if (severidade === 'ATENCAO') {
    Icon = ShieldAlert;
    bg = 'bg-amber-50 text-amber-700 border-amber-200';
    iconColor = 'text-amber-500';
    label = idadeDias !== null ? `TLS-${idadeDias}d` : 'TLS-?';
    title = status.mensagem;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-colors hover:brightness-95 ${bg}`}
      aria-label={`Status cadeia TLS: ${label}`}
    >
      <Icon className={`w-3 h-3 ${iconColor}`} />
      {label}
    </button>
  );
}
