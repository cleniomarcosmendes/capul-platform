import { useEffect, useState, useCallback } from 'react';
import { Wifi, RefreshCw, Megaphone, Trash2, Clock } from 'lucide-react';
import { authApi } from '../../services/api';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

interface UsuarioOnline {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  departamentoNome: string | null;
  filialPrincipalCodigo: string | null;
  filialPrincipalNome: string | null;
  ultimoLogin: string | null;
  ttlRestante: number;
}

interface AvisoAtivo {
  mensagem: string;
  criadoEm: string;
  ate: string;
}

const REFRESH_INTERVAL_MS = 15_000;
const TTL_INICIAL = 120;

function formatTempoAtividade(ttl: number): string {
  const idade = TTL_INICIAL - ttl;
  if (idade < 0) return 'agora';
  if (idade < 60) return `${idade}s atrás`;
  return `${Math.floor(idade / 60)}m ${idade % 60}s atrás`;
}

function formatHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function UsuariosOnlinePage() {
  const [usuarios, setUsuarios] = useState<UsuarioOnline[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<AvisoAtivo | null>(null);
  const [novaMsg, setNovaMsg] = useState('');
  const [ttlMin, setTtlMin] = useState(30);
  const [enviandoAviso, setEnviandoAviso] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const carregar = useCallback(async () => {
    try {
      const [online, avisoResp] = await Promise.all([
        authApi.get<{ total: number; usuarios: UsuarioOnline[] }>('/admin/usuarios-online'),
        authApi.get<{ aviso: AvisoAtivo | null }>('/admin/aviso-plataforma'),
      ]);
      setUsuarios(online.data.usuarios);
      setTotal(online.data.total);
      setAviso(avisoResp.data.aviso);
    } catch (err) {
      toast.error('Erro ao carregar usuários online', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [carregar]);

  async function enviarAviso() {
    if (!novaMsg.trim()) {
      toast.warning('Digite a mensagem do aviso');
      return;
    }
    setEnviandoAviso(true);
    try {
      await authApi.post('/admin/aviso-plataforma', {
        mensagem: novaMsg.trim(),
        ttlSegundos: ttlMin * 60,
      });
      toast.success('Aviso enviado', `Visível por ${ttlMin} min para ${total} usuário(s) online`);
      setNovaMsg('');
      carregar();
    } catch (err) {
      toast.error('Falha ao enviar aviso', (err as Error).message);
    } finally {
      setEnviandoAviso(false);
    }
  }

  async function limparAviso() {
    const ok = await confirm({
      title: 'Remover aviso atual?',
      description: 'O banner desaparecerá da tela de todos os usuários no próximo heartbeat (~60s).',
      confirmLabel: 'Remover',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await authApi.delete('/admin/aviso-plataforma');
      toast.success('Aviso removido');
      carregar();
    } catch (err) {
      toast.error('Falha ao remover aviso', (err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Wifi className="w-5 h-5 text-emerald-600" />
            Usuários Online
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Pessoas com aba aberta agora — atualizado a cada 15s. Heartbeat = 60s, expira em
            120s sem atividade.
          </p>
        </div>
        <Button variant="ghost" onClick={carregar}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de usuários */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-medium text-slate-800">
              {total} usuário{total !== 1 ? 's' : ''} online
            </h3>
            {loading && <span className="text-xs text-slate-400">carregando…</span>}
          </div>
          {usuarios.length === 0 && !loading ? (
            <div className="p-10 text-center text-slate-400">
              <Wifi className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Ninguém online no momento</p>
              <p className="text-xs mt-1">Apenas você precisa ter aba ativa pra contar</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Usuário</th>
                  <th className="px-4 py-2 text-left">Departamento</th>
                  <th className="px-4 py-2 text-left">Filial</th>
                  <th className="px-4 py-2 text-left">Último login</th>
                  <th className="px-4 py-2 text-left">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-slate-800">{u.nome}</div>
                      <div className="text-xs text-slate-400">@{u.username}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {u.departamentoNome ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {u.filialPrincipalCodigo ? (
                        <>
                          <span className="font-mono text-xs">
                            {u.filialPrincipalCodigo}
                          </span>{' '}
                          — {u.filialPrincipalNome}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">
                      {formatHora(u.ultimoLogin)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-700">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {formatTempoAtividade(u.ttlRestante)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Card aviso */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-amber-50 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-700" />
              <h3 className="font-medium text-slate-800">Avisar usuários online</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Envia um banner pra todos os usuários com aba aberta. Aparece no próximo
                heartbeat (~60s).
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={novaMsg}
                  onChange={(e) => setNovaMsg(e.target.value)}
                  rows={3}
                  placeholder="Ex: Sistema será reiniciado em 15 minutos para manutenção. Salve seu trabalho."
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Visível por (minutos)
                </label>
                <input
                  type="number"
                  value={ttlMin}
                  onChange={(e) => setTtlMin(Math.max(1, Math.min(180, Number(e.target.value) || 30)))}
                  min={1}
                  max={180}
                  className="w-24 rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="ml-2 text-xs text-slate-500">(1 a 180 min)</span>
              </div>
              <Button onClick={enviarAviso} loading={enviandoAviso} disabled={total === 0}>
                <Megaphone className="w-4 h-4 mr-1" />
                Enviar aviso
              </Button>
              {total === 0 && (
                <p className="text-xs text-amber-700">
                  Sem usuários online — aviso não terá destinatários.
                </p>
              )}
            </div>
          </div>

          {/* Aviso ativo */}
          {aviso && (
            <div className="bg-white rounded-lg border border-amber-300 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-amber-200 bg-amber-100 flex items-center justify-between">
                <h3 className="font-medium text-amber-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Aviso ativo
                </h3>
                <button
                  onClick={limparAviso}
                  className="text-amber-700 hover:text-red-600 transition-colors"
                  title="Remover aviso"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-2">
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{aviso.mensagem}</p>
                <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
                  Criado em {formatHora(aviso.criadoEm)} · expira{' '}
                  {formatHora(aviso.ate)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
