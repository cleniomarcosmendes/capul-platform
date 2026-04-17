import { useEffect, useState, useCallback } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { integracaoService, type IntegracaoApi, type IntegracaoEndpoint, type TesteConexaoResult } from '../../services/integracao.service';
import { Plus, Plug, Pencil, Trash2, TestTube2, Check, X, ArrowRightLeft, Loader2, AlertTriangle, Shield, Server } from 'lucide-react';

const AMBIENTES = ['PRODUCAO', 'HOMOLOGACAO'] as const;
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const TIPOS_AUTH = ['BASIC', 'BEARER', 'API_KEY', 'NONE'] as const;

function StatusBadge({ result }: { result: TesteConexaoResult }) {
  if (result.sucesso) {
    const isHttpOk = result.status >= 200 && result.status < 400;
    return isHttpOk ? (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700"><Check className="w-3 h-3" /> {result.status}</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Check className="w-3 h-3" /> {result.status}</span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700"><X className="w-3 h-3" /> Falha</span>
  );
}

function AmbienteBadge({ ambiente, size = 'sm' }: { ambiente: string; size?: 'sm' | 'lg' }) {
  const base = ambiente === 'PRODUCAO'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';
  const sizeClass = size === 'lg' ? 'text-sm px-3 py-1 font-semibold' : 'text-xs px-2 py-0.5 font-medium';
  return <span className={`${sizeClass} rounded-full border ${base}`}>{ambiente}</span>;
}

function MetodoBadge({ metodo }: { metodo: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-amber-100 text-amber-700',
    PATCH: 'bg-purple-100 text-purple-700',
    DELETE: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${colors[metodo] || 'bg-slate-100 text-slate-700'}`}>{metodo}</span>;
}

// --- Modal de troca de ambiente ---
function ModalTrocaAmbiente({
  integ,
  onConfirm,
  onCancel,
  switching,
}: {
  integ: IntegracaoApi;
  onConfirm: () => void;
  onCancel: () => void;
  switching: boolean;
}) {
  const novoAmbiente = integ.ambiente === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
  const isProd = novoAmbiente === 'PRODUCAO';
  const endpointsNovo = integ.endpoints.filter((ep) => ep.ambiente === novoAmbiente);
  const endpointsAtual = integ.endpoints.filter((ep) => ep.ambiente === integ.ambiente);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className={`px-6 py-5 ${isProd ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">Trocar Ambiente</h3>
              <p className="text-white/80 text-sm">{integ.nome}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Transicao visual */}
          <div className="flex items-center justify-center gap-4 mb-5">
            <div className="flex-1 text-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 ${
                integ.ambiente === 'PRODUCAO'
                  ? 'border-red-200 bg-red-50'
                  : 'border-amber-200 bg-amber-50'
              }`}>
                <Server className={`w-4 h-4 ${integ.ambiente === 'PRODUCAO' ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Atual</p>
                  <p className={`text-sm font-bold ${integ.ambiente === 'PRODUCAO' ? 'text-red-700' : 'text-amber-700'}`}>
                    {integ.ambiente}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{endpointsAtual.length} endpoint{endpointsAtual.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex flex-col items-center">
              <ArrowRightLeft className="w-5 h-5 text-slate-400" />
            </div>

            <div className="flex-1 text-center">
              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed ${
                isProd
                  ? 'border-red-300 bg-red-50/50'
                  : 'border-amber-300 bg-amber-50/50'
              }`}>
                <Shield className={`w-4 h-4 ${isProd ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Novo</p>
                  <p className={`text-sm font-bold ${isProd ? 'text-red-700' : 'text-amber-700'}`}>
                    {novoAmbiente}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{endpointsNovo.length} endpoint{endpointsNovo.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {/* Aviso */}
          {isProd && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 leading-relaxed">
                Voce esta trocando para <strong>PRODUCAO</strong>. Todos os modulos da plataforma passarao a usar os endpoints de producao imediatamente.
              </p>
            </div>
          )}

          {/* Endpoints que serao ativados */}
          {endpointsNovo.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Endpoints que serao ativados</p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {endpointsNovo.map((ep) => (
                  <div key={ep.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2">
                    <MetodoBadge metodo={ep.metodo} />
                    <span className="font-medium text-slate-700">{ep.operacao}</span>
                    <span className="text-slate-400 font-mono truncate flex-1 text-right text-[11px]">{ep.url}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpointsNovo.length === 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                Nenhum endpoint cadastrado para o ambiente <strong>{novoAmbiente}</strong>. Cadastre os endpoints antes de trocar.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={switching}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={switching || endpointsNovo.length === 0}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isProd
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200 shadow-md'
                : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 shadow-md'
            }`}
          >
            {switching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Trocando...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Confirmar Troca
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function IntegracoesPage() {
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN';

  const [integracoes, setIntegracoes] = useState<IntegracaoApi[]>([]);
  const [loading, setLoading] = useState(true);
  // Form integracao
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formAmbiente, setFormAmbiente] = useState<'PRODUCAO' | 'HOMOLOGACAO'>('HOMOLOGACAO');
  const [formTipoAuth, setFormTipoAuth] = useState<'BASIC' | 'BEARER' | 'API_KEY' | 'NONE'>('BASIC');
  const [formAuthConfig, setFormAuthConfig] = useState('');
  const [saving, setSaving] = useState(false);

  // Form endpoint
  const [showEpForm, setShowEpForm] = useState<string | null>(null); // integracaoId
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epAmbiente, setEpAmbiente] = useState<'PRODUCAO' | 'HOMOLOGACAO'>('PRODUCAO');
  const [epOperacao, setEpOperacao] = useState('');
  const [epDescricao, setEpDescricao] = useState('');
  const [epUrl, setEpUrl] = useState('');
  const [epMetodo, setEpMetodo] = useState<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>('GET');
  const [epTimeout, setEpTimeout] = useState('30000');
  const [savingEp, setSavingEp] = useState(false);

  // Teste
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TesteConexaoResult>>({});

  // Modal troca ambiente
  const [ambienteModal, setAmbienteModal] = useState<IntegracaoApi | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await integracaoService.listar();
      setIntegracoes(data);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }

  // --- Integracao CRUD ---

  function iniciarNovo() {
    setEditingId(null);
    setFormCodigo('');
    setFormNome('');
    setFormDescricao('');
    setFormAmbiente('HOMOLOGACAO');
    setFormTipoAuth('BASIC');
    setFormAuthConfig('');
    setShowForm(true);
  }

  function iniciarEdicao(integ: IntegracaoApi) {
    setEditingId(integ.id);
    setFormCodigo(integ.codigo);
    setFormNome(integ.nome);
    setFormDescricao(integ.descricao || '');
    setFormAmbiente(integ.ambiente);
    setFormTipoAuth(integ.tipoAuth);
    setFormAuthConfig(integ.authConfig || '');
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await integracaoService.atualizar(editingId, {
          nome: formNome,
          descricao: formDescricao || undefined,
          ambiente: formAmbiente,
          tipoAuth: formTipoAuth,
          authConfig: formAuthConfig || undefined,
        } as any);
      } else {
        await integracaoService.criar({
          codigo: formCodigo.toUpperCase(),
          nome: formNome,
          descricao: formDescricao || undefined,
          ambiente: formAmbiente,
          tipoAuth: formTipoAuth,
          authConfig: formAuthConfig || undefined,
        } as any);
      }
      setShowForm(false);
      carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar integracao');
    } finally { setSaving(false); }
  }

  const confirmarTrocaAmbiente = useCallback(async () => {
    if (!ambienteModal) return;
    const novoAmbiente = ambienteModal.ambiente === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    setSwitching(true);
    try {
      await integracaoService.atualizar(ambienteModal.id, { ambiente: novoAmbiente } as any);
      setAmbienteModal(null);
      carregar();
    } catch {
      alert('Erro ao trocar ambiente');
    } finally { setSwitching(false); }
  }, [ambienteModal]);

  // --- Endpoint CRUD ---

  function iniciarNovoEndpoint(integracaoId: string) {
    setShowEpForm(integracaoId);
    setEditingEpId(null);
    setEpAmbiente('PRODUCAO');
    setEpOperacao('');
    setEpDescricao('');
    setEpUrl('');
    setEpMetodo('GET');
    setEpTimeout('30000');
  }

  function iniciarEdicaoEndpoint(ep: IntegracaoEndpoint) {
    setShowEpForm(ep.integracaoId);
    setEditingEpId(ep.id);
    setEpAmbiente(ep.ambiente);
    setEpOperacao(ep.operacao);
    setEpDescricao(ep.descricao || '');
    setEpUrl(ep.url);
    setEpMetodo(ep.metodo);
    setEpTimeout(String(ep.timeoutMs));
  }

  async function handleEndpointSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!showEpForm) return;
    setSavingEp(true);
    try {
      if (editingEpId) {
        await integracaoService.atualizarEndpoint(editingEpId, {
          ambiente: epAmbiente,
          descricao: epDescricao || undefined,
          url: epUrl,
          metodo: epMetodo,
          timeoutMs: parseInt(epTimeout),
        } as any);
      } else {
        await integracaoService.adicionarEndpoint(showEpForm, {
          ambiente: epAmbiente,
          operacao: epOperacao.toUpperCase(),
          descricao: epDescricao || undefined,
          url: epUrl,
          metodo: epMetodo,
          timeoutMs: parseInt(epTimeout),
        } as any);
      }
      setShowEpForm(null);
      setEditingEpId(null);
      carregar();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao salvar endpoint');
    } finally { setSavingEp(false); }
  }

  // --- Testar conexao ---

  async function testarEndpoint(ep: IntegracaoEndpoint, integ: IntegracaoApi) {
    setTestingId(ep.id);
    try {
      let authHeader: string | undefined;
      if (integ.tipoAuth === 'BASIC' && integ.authConfig) {
        authHeader = `Basic ${integ.authConfig}`;
      } else if (integ.tipoAuth === 'BEARER' && integ.authConfig) {
        authHeader = `Bearer ${integ.authConfig}`;
      } else if (integ.tipoAuth === 'API_KEY' && integ.authConfig) {
        authHeader = integ.authConfig;
      }

      const result = await integracaoService.testarConexao({
        url: ep.url,
        metodo: ep.metodo,
        authHeader,
        timeoutMs: ep.timeoutMs,
      });
      setTestResults((prev) => ({ ...prev, [ep.id]: result }));
    } catch (err: any) {
      const status = err?.response?.status || 0;
      const msg = err?.response?.data?.message || err?.message || 'Erro na requisicao';
      setTestResults((prev) => ({ ...prev, [ep.id]: { sucesso: false, status, statusText: typeof msg === 'string' ? msg : JSON.stringify(msg), duracao: 0, url: ep.url } }));
    } finally { setTestingId(null); }
  }

  async function testarTodos(integ: IntegracaoApi) {
    const endpoints = integ.endpoints.filter((ep) => ep.ambiente === integ.ambiente && ep.ativo);
    for (const ep of endpoints) {
      await testarEndpoint(ep, integ);
    }
  }

  return (
    <>
      <Header title="Integracoes API" ambienteAtivo={integracoes.find((i) => i.codigo === 'PROTHEUS')?.ambiente ?? null} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">Gerencie as integracoes com sistemas externos (ERP, GLPI, etc.)</p>
          {canEdit && (
            <button onClick={iniciarNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              <Plus className="w-4 h-4" /> Nova Integracao
            </button>
          )}
        </div>

        {/* Form integracao */}
        {showForm && canEdit && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-4">{editingId ? 'Editar Integracao' : 'Nova Integracao'}</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                <input type="text" value={formCodigo} onChange={(e) => setFormCodigo(e.target.value)} required disabled={!!editingId}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100 uppercase" placeholder="PROTHEUS" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                <input type="text" value={formNome} onChange={(e) => setFormNome(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Protheus ERP" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
                <input type="text" value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600" placeholder="Integracao com ERP Totvs Protheus" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente Ativo</label>
                <select value={formAmbiente} onChange={(e) => setFormAmbiente(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                  {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Autenticacao</label>
                <select value={formTipoAuth} onChange={(e) => setFormTipoAuth(e.target.value as any)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600">
                  {TIPOS_AUTH.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {formTipoAuth === 'BASIC' ? 'Credenciais (Base64)' : formTipoAuth === 'BEARER' ? 'Token' : formTipoAuth === 'API_KEY' ? 'API Key' : 'N/A'}
                </label>
                <input type="password" value={formAuthConfig} onChange={(e) => setFormAuthConfig(e.target.value)} disabled={formTipoAuth === 'NONE'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:bg-slate-100" placeholder={formTipoAuth === 'NONE' ? '' : 'Credenciais'} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        {/* Form endpoint inline */}
        {showEpForm && canEdit && (
          <form onSubmit={handleEndpointSubmit} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="text-sm font-semibold text-slate-800 mb-4">{editingEpId ? 'Editar Endpoint' : 'Novo Endpoint'}</h4>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Integracao</label>
                <select value={showEpForm} onChange={(e) => setShowEpForm(e.target.value)} disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100">
                  {integracoes.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.codigo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ambiente</label>
                <select value={epAmbiente} onChange={(e) => setEpAmbiente(e.target.value as any)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs">
                  {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Operacao *</label>
                <input type="text" value={epOperacao} onChange={(e) => setEpOperacao(e.target.value)} required disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100 uppercase" placeholder="HIERARQUIA" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Metodo</label>
                <select value={epMetodo} onChange={(e) => setEpMetodo(e.target.value as any)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs">
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">URL *</label>
                <input type="text" value={epUrl} onChange={(e) => setEpUrl(e.target.value)} required
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono" placeholder="https://api.exemplo.com/endpoint" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
                <input type="text" value={epDescricao} onChange={(e) => setEpDescricao(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" placeholder="Descricao do endpoint" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Timeout (ms)</label>
                <input type="number" value={epTimeout} onChange={(e) => setEpTimeout(e.target.value)} min="1000"
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingEp} className="bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">{savingEp ? 'Salvando...' : 'Salvar'}</button>
              <button type="button" onClick={() => { setShowEpForm(null); setEditingEpId(null); }} className="text-xs text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        {/* Lista flat de endpoints por integracao */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : integracoes.length === 0 ? (
          <div className="text-center py-12">
            <Plug className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma integracao cadastrada</p>
          </div>
        ) : (
          <div className="space-y-6">
            {integracoes.map((integ) => {
              const allEndpoints = integ.endpoints;
              const operacoes = [...new Set(allEndpoints.map((ep) => ep.operacao))];

              return (
                <div key={integ.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Header da integracao */}
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Plug className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-slate-800">{integ.nome}</span>
                      <span className="text-xs font-mono text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{integ.codigo}</span>
                      <AmbienteBadge ambiente={integ.ambiente} />
                      <span className="text-xs text-slate-400">Auth: {integ.tipoAuth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <>
                          <button onClick={() => testarTodos(integ)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50">
                            <TestTube2 className="w-3.5 h-3.5" /> Testar Todos
                          </button>
                          <button onClick={() => setAmbienteModal(integ)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 px-2 py-1 rounded border border-amber-200 hover:bg-amber-50">
                            <ArrowRightLeft className="w-3.5 h-3.5" /> Trocar Ambiente
                          </button>
                          <button onClick={() => iniciarNovoEndpoint(integ.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50">
                            <Plus className="w-3.5 h-3.5" /> Endpoint
                          </button>
                          <button onClick={() => iniciarEdicao(integ)} className="text-slate-400 hover:text-emerald-600" title="Editar integracao"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => {
                            if (!confirm(`Excluir integracao "${integ.nome}" e todos seus endpoints?`)) return;
                            try { await integracaoService.excluir(integ.id); carregar(); } catch { alert('Erro ao excluir'); }
                          }} className="text-slate-400 hover:text-red-600" title="Excluir integracao"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tabela flat de endpoints */}
                  {allEndpoints.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-200 bg-slate-50/50">
                            <th className="px-4 py-2.5">Operacao</th>
                            <th className="px-4 py-2.5 text-center">Producao</th>
                            <th className="px-4 py-2.5 text-center">Homologacao</th>
                            <th className="px-4 py-2.5">Metodo</th>
                            <th className="px-4 py-2.5">URL</th>
                            <th className="px-4 py-2.5">Timeout</th>
                            <th className="px-4 py-2.5">Status</th>
                            {canEdit && <th className="px-4 py-2.5">Acoes</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {operacoes.map((op) => {
                            const epProd = allEndpoints.find((ep) => ep.operacao === op && ep.ambiente === 'PRODUCAO');
                            const epHomol = allEndpoints.find((ep) => ep.operacao === op && ep.ambiente === 'HOMOLOGACAO');
                            const epAtivo = integ.ambiente === 'PRODUCAO' ? epProd : epHomol;
                            const ep = epAtivo || epProd || epHomol;
                            if (!ep) return null;

                            return (
                              <tr key={op} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <span className="font-medium text-slate-700">{op}</span>
                                  {ep.descricao && <p className="text-xs text-slate-400 mt-0.5">{ep.descricao}</p>}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {epProd ? (
                                    <span className={`inline-block w-3 h-3 rounded-full ${integ.ambiente === 'PRODUCAO' ? 'bg-green-500' : 'bg-slate-300'}`} title={epProd.url} />
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {epHomol ? (
                                    <span className={`inline-block w-3 h-3 rounded-full ${integ.ambiente === 'HOMOLOGACAO' ? 'bg-green-500' : 'bg-slate-300'}`} title={epHomol.url} />
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3"><MetodoBadge metodo={ep.metodo} /></td>
                                <td className="px-4 py-3"><span className="text-xs font-mono text-slate-600 break-all">{ep.url}</span></td>
                                <td className="px-4 py-3 text-xs text-slate-500">{(ep.timeoutMs / 1000).toFixed(0)}s</td>
                                <td className="px-4 py-3">
                                  {epAtivo && testingId === epAtivo.id ? (
                                    <div className="flex items-center gap-1.5">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                      <span className="text-xs text-blue-500">Testando...</span>
                                    </div>
                                  ) : epAtivo && testResults[epAtivo.id] ? (
                                    <div className="flex items-center gap-1.5">
                                      <StatusBadge result={testResults[epAtivo.id]} />
                                      <span className="text-xs text-slate-400">{testResults[epAtivo.id].duracao}ms</span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                                {canEdit && (
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      {epAtivo && (
                                        <button
                                          onClick={() => testarEndpoint(epAtivo, integ)}
                                          disabled={testingId === epAtivo.id}
                                          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded-md disabled:opacity-50"
                                          title="Testar conexao"
                                        >
                                          <TestTube2 className="w-3 h-3" /> Testar
                                        </button>
                                      )}
                                      <button onClick={() => iniciarEdicaoEndpoint(ep)} className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md" title="Editar">
                                        <Pencil className="w-3 h-3" /> Editar
                                      </button>
                                      <button onClick={async () => {
                                        if (!confirm(`Excluir endpoint "${ep.operacao}"?`)) return;
                                        try { await integracaoService.excluirEndpoint(ep.id); carregar(); } catch { alert('Erro ao excluir'); }
                                      }} className="text-slate-400 hover:text-red-600" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-6 py-8 text-center text-sm text-slate-400">
                      Nenhum endpoint cadastrado nesta integracao
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal troca de ambiente */}
      {ambienteModal && (
        <ModalTrocaAmbiente
          integ={ambienteModal}
          onConfirm={confirmarTrocaAmbiente}
          onCancel={() => setAmbienteModal(null)}
          switching={switching}
        />
      )}
    </>
  );
}
