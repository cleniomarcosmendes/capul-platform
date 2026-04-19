import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Inbox, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import type { AlertaEnviado, TipoSincronizacao } from '../types';

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  MOVIMENTO_MEIO_DIA: 'Meio-dia',
  MOVIMENTO_MANHA_SEGUINTE: 'Manhã seguinte',
  MANUAL: 'Manual',
  PONTUAL: 'Pontual',
};

export function AlertasHistoricoPage() {
  const { fiscalRole } = useAuth();
  const canReenviar = hasMinRole(fiscalRole, 'GESTOR_FISCAL');
  const toast = useToast();
  const [alertas, setAlertas] = useState<AlertaEnviado[]>([]);
  const [loading, setLoading] = useState(true);
  const [reenviando, setReenviando] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<AlertaEnviado[]>('/cruzamento/alertas/historico');
      setAlertas(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleReenviar(sincronizacaoId: string) {
    try {
      setReenviando(sincronizacaoId);
      await fiscalApi.post(`/cruzamento/alertas/${sincronizacaoId}/reenviar`);
      toast.success('Digest reenviado', 'O e-mail foi despachado para os destinatários configurados.');
      await load();
    } catch (err) {
      toast.error('Falha ao reenviar digest', extractApiError(err));
    } finally {
      setReenviando(null);
    }
  }

  const totalMudancasAcum = alertas.reduce((s, a) => s + a.totalMudancas, 0);
  const totalFallback = alertas.filter((a) => a.fallback).length;
  const totalErros = alertas.filter((a) => a.erro).length;

  return (
    <PageWrapper title="Histórico de Alertas">

      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Inbox className="h-4 w-4" /> Alertas enviados
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{alertas.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Mail className="h-4 w-4" /> Mudanças reportadas (total)
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900">
            {totalMudancasAcum.toLocaleString('pt-BR')}
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Fallback (sem GESTOR_FISCAL)
          </div>
          <div className="mt-1 text-2xl font-bold text-amber-700">{totalFallback}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/30 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle className="h-4 w-4 text-red-600" /> Erros SMTP
          </div>
          <div className="mt-1 text-2xl font-bold text-red-700">{totalErros}</div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Carregando…</div>
        ) : alertas.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            Nenhum alerta enviado até o momento. Os digests são disparados automaticamente ao final
            de cada execução de cruzamento.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {alertas.map((a) => (
              <li key={a.id} className="p-5 hover:bg-slate-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-slate-900">{a.assunto}</div>
                      {a.sincronizacao && (
                        <Badge variant="gray">{TIPO_LABEL[a.sincronizacao.tipo]}</Badge>
                      )}
                      {a.fallback && <Badge variant="yellow">Fallback</Badge>}
                      {a.erro ? (
                        <Badge variant="red">Falhou</Badge>
                      ) : (
                        <Badge variant="green">
                          <CheckCircle2 className="h-3 w-3" /> Enviado
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(a.enviadoEm).toLocaleString('pt-BR')} •{' '}
                      {a.totalDestinatarios} destinatário(s) • {a.totalMudancas} mudança(s) de
                      situação
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.destinatarios.slice(0, 6).map((d, i) => (
                        <span
                          key={i}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-700"
                        >
                          {d.email}
                        </span>
                      ))}
                      {a.destinatarios.length > 6 && (
                        <span className="text-[11px] text-slate-500">
                          +{a.destinatarios.length - 6} outros
                        </span>
                      )}
                    </div>
                    {a.erro && (
                      <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-800">{a.erro}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Link
                      to={`/execucoes/${a.sincronizacaoId}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Ver execução <ArrowRight className="h-3 w-3" />
                    </Link>
                    {canReenviar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReenviar(a.sincronizacaoId)}
                        loading={reenviando === a.sincronizacaoId}
                      >
                        Reenviar
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageWrapper>
  );
}
