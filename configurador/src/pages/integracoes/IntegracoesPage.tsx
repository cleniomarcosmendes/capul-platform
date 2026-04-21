import { useEffect, useState, useCallback } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import { extractApiError } from '../../utils/errors';
import {
  integracaoService,
  MODULOS_CONSUMIDORES,
  type IntegracaoApi,
  type IntegracaoEndpoint,
  type ModuloConsumidor,
  type TesteConexaoResult,
} from '../../services/integracao.service';
import {
  Plus, Plug, Pencil, Trash2, TestTube2, Check, X, Loader2, AlertTriangle, Shield,
  FileText, HardDrive, Users, ArrowLeftRight,
} from 'lucide-react';

const AMBIENTES = ['PRODUCAO', 'HOMOLOGACAO'] as const;
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const TIPOS_AUTH = ['BASIC', 'BEARER', 'API_KEY', 'NONE'] as const;

const MODULO_LABEL: Record<ModuloConsumidor, string> = {
  FISCAL: 'Fiscal',
  GESTAO_TI: 'Gestão TI',
  INVENTARIO: 'Inventário',
};

const MODULO_ICON: Record<ModuloConsumidor, typeof FileText> = {
  FISCAL: FileText,
  GESTAO_TI: Users,
  INVENTARIO: HardDrive,
};

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

type AmbienteLike = 'PRODUCAO' | 'HOMOLOGACAO' | 'MIXED';

function AmbienteBadge({ ambiente, size = 'sm' }: { ambiente: AmbienteLike; size?: 'sm' | 'lg' }) {
  const base =
    ambiente === 'PRODUCAO'
      ? 'bg-red-100 text-red-700 border-red-200'
      : ambiente === 'HOMOLOGACAO'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-purple-100 text-purple-700 border-purple-200';
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

/** Ambiente ativo agregado nos endpoints ativos de (integracao, modulo). */
function ambienteDoModulo(endpoints: IntegracaoEndpoint[], modulo: ModuloConsumidor): AmbienteLike {
  const ativos = endpoints.filter((ep) => ep.modulo === modulo && ep.ativo);
  if (ativos.length === 0) return 'HOMOLOGACAO';
  const set = new Set(ativos.map((ep) => ep.ambiente));
  if (set.size === 1) return [...set][0] as 'PRODUCAO' | 'HOMOLOGACAO';
  return 'MIXED';
}

// --- Modal de confirmacao de ativacao de endpoint (single) ---
function ModalConfirmarAtivacao({
  integ,
  endpointAlvo,
  endpointAtualAtivo,
  onConfirm,
  onCancel,
  switching,
}: {
  integ: IntegracaoApi;
  endpointAlvo: IntegracaoEndpoint;
  endpointAtualAtivo: IntegracaoEndpoint | null;
  onConfirm: () => void;
  onCancel: () => void;
  switching: boolean;
}) {
  const isProd = endpointAlvo.ambiente === 'PRODUCAO';
  const Icon = MODULO_ICON[endpointAlvo.modulo];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header colorido pelo ambiente alvo */}
        <div className={`px-6 py-5 ${isProd ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                Ativar em {endpointAlvo.ambiente}
              </h3>
              <p className="text-white/80 text-sm">{integ.nome}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {/* Identificacao da operacao */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Icon className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">{MODULO_LABEL[endpointAlvo.modulo]}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800 text-sm">{endpointAlvo.operacao}</span>
            <MetodoBadge metodo={endpointAlvo.metodo} />
          </div>

          {/* URL que fica ativa */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Ficara ativa</p>
              <AmbienteBadge ambiente={endpointAlvo.ambiente} />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-xs font-mono text-green-800 break-all">{endpointAlvo.url}</span>
            </div>
          </div>

          {/* URL que desativa (se houver) */}
          {endpointAtualAtivo && endpointAtualAtivo.id !== endpointAlvo.id && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Sera desativada</p>
                <AmbienteBadge ambiente={endpointAtualAtivo.ambiente} />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-slate-500 line-through break-all">{endpointAtualAtivo.url}</span>
              </div>
            </div>
          )}

          {/* Aviso quando for PROD */}
          {isProd && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 leading-relaxed">
                A ativacao em <strong>PRODUCAO</strong> afeta imediatamente as consultas reais do modulo
                <strong> {MODULO_LABEL[endpointAlvo.modulo]}</strong>. Certifique-se de que o endpoint esta publicado e responde.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={switching}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={switching}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isProd ? 'bg-red-600 hover:bg-red-700 shadow-red-200 shadow-md' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 shadow-md'
            }`}
          >
            {switching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Ativando...</>
            ) : (
              <><Shield className="w-4 h-4" /> Ativar em {endpointAlvo.ambiente}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Modal de confirmacao de troca de ambiente em massa (todos os endpoints de um modulo) ---
function ModalConfirmarTrocaBulk({
  integ,
  modulo,
  ambienteAlvo,
  endpoints,
  onConfirm,
  onCancel,
  switching,
}: {
  integ: IntegracaoApi;
  modulo: ModuloConsumidor;
  ambienteAlvo: 'PRODUCAO' | 'HOMOLOGACAO';
  endpoints: IntegracaoEndpoint[];
  onConfirm: () => void;
  onCancel: () => void;
  switching: boolean;
}) {
  const isProd = ambienteAlvo === 'PRODUCAO';
  const Icon = MODULO_ICON[modulo];

  // Agrupa por operacao → par (alvo vs. atual ativo)
  const operacoes = [...new Set(endpoints.map((ep) => ep.operacao))].sort();
  const linhas = operacoes.map((op) => {
    const alvo = endpoints.find((ep) => ep.operacao === op && ep.ambiente === ambienteAlvo);
    const atualAtivo = endpoints.find((ep) => ep.operacao === op && ep.ativo) ?? null;
    return { op, alvo, atualAtivo, jaAtivo: atualAtivo?.ambiente === ambienteAlvo };
  });
  const totalMudancas = linhas.filter((l) => !!l.alvo && !l.jaAtivo).length;
  const semAlvo = linhas.filter((l) => !l.alvo).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header colorido pelo ambiente alvo */}
        <div className={`px-6 py-5 ${isProd ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-amber-500 to-amber-600'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">
                Trocar {MODULO_LABEL[modulo]} para {ambienteAlvo}
              </h3>
              <p className="text-white/80 text-sm">{integ.nome} — {totalMudancas} operacao(oes) sera(ao) alterada(s)</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <Icon className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">{MODULO_LABEL[modulo]}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 text-sm">{operacoes.length} operacao(oes)</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {linhas.map(({ op, alvo, atualAtivo, jaAtivo }) => (
              <div key={op} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="font-medium text-slate-700 min-w-[120px]">{op}</span>
                {!alvo ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3" /> sem endpoint {ambienteAlvo}
                  </span>
                ) : jaAtivo ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    <Check className="w-3 h-3" /> ja em {ambienteAlvo}
                  </span>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    {atualAtivo && (
                      <>
                        <AmbienteBadge ambiente={atualAtivo.ambiente} />
                        <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                      </>
                    )}
                    <AmbienteBadge ambiente={alvo.ambiente} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {semAlvo > 0 && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                {semAlvo} operacao(oes) nao tem endpoint cadastrado em <strong>{ambienteAlvo}</strong> —
                sera(ao) ignorada(s). Cadastre manualmente antes se precisar.
              </p>
            </div>
          )}

          {isProd && totalMudancas > 0 && (
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg mt-4">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 leading-relaxed">
                A troca em massa para <strong>PRODUCAO</strong> afeta imediatamente todas as consultas reais do
                modulo <strong>{MODULO_LABEL[modulo]}</strong>. Certifique-se de que todos os endpoints estao publicados.
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={switching}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={switching || totalMudancas === 0}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              isProd ? 'bg-red-600 hover:bg-red-700 shadow-red-200 shadow-md' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-200 shadow-md'
            }`}
          >
            {switching ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Trocando...</>
            ) : totalMudancas === 0 ? (
              <><Check className="w-4 h-4" /> Nada a fazer</>
            ) : (
              <><ArrowLeftRight className="w-4 h-4" /> Trocar {totalMudancas} operacao(oes)</>
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
  const toast = useToast();
  const confirm = useConfirm();

  const [integracoes, setIntegracoes] = useState<IntegracaoApi[]>([]);
  const [loading, setLoading] = useState(true);
  // Form integracao
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formTipoAuth, setFormTipoAuth] = useState<'BASIC' | 'BEARER' | 'API_KEY' | 'NONE'>('BASIC');
  const [formAuthConfig, setFormAuthConfig] = useState('');
  const [saving, setSaving] = useState(false);

  // Form endpoint
  const [showEpForm, setShowEpForm] = useState<string | null>(null); // integracaoId
  const [editingEpId, setEditingEpId] = useState<string | null>(null);
  const [epModulo, setEpModulo] = useState<ModuloConsumidor>('INVENTARIO');
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

  // Modal de confirmacao de ativacao (single-endpoint)
  const [confirmarAtivacao, setConfirmarAtivacao] = useState<{
    integ: IntegracaoApi;
    endpointAlvo: IntegracaoEndpoint;
    endpointAtualAtivo: IntegracaoEndpoint | null;
  } | null>(null);
  const [switching, setSwitching] = useState(false);

  // Modal de troca em massa (todos os endpoints de um modulo)
  const [trocaBulk, setTrocaBulk] = useState<{
    integ: IntegracaoApi;
    modulo: ModuloConsumidor;
    ambienteAlvo: 'PRODUCAO' | 'HOMOLOGACAO';
  } | null>(null);
  const [switchingBulk, setSwitchingBulk] = useState(false);


  // Tab ativo por integracao (default: primeiro modulo com endpoints)
  const [activeTab, setActiveTab] = useState<Record<string, ModuloConsumidor>>({});

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const data = await integracaoService.listar();
      setIntegracoes(data);
    } catch { /* silencioso */ } finally { setLoading(false); }
  }

  function iniciarNovo() {
    setEditingId(null);
    setFormCodigo('');
    setFormNome('');
    setFormDescricao('');
    setFormTipoAuth('BASIC');
    setFormAuthConfig('');
    setShowForm(true);
  }

  function iniciarEdicao(integ: IntegracaoApi) {
    setEditingId(integ.id);
    setFormCodigo(integ.codigo);
    setFormNome(integ.nome);
    setFormDescricao(integ.descricao || '');
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
          tipoAuth: formTipoAuth,
          authConfig: formAuthConfig || undefined,
        } as any);
      } else {
        await integracaoService.criar({
          codigo: formCodigo.toUpperCase(),
          nome: formNome,
          descricao: formDescricao || undefined,
          tipoAuth: formTipoAuth,
          authConfig: formAuthConfig || undefined,
        } as any);
      }
      setShowForm(false);
      toast.success(editingId ? 'Integracao atualizada' : 'Integracao criada');
      carregar();
    } catch (err) {
      toast.error('Falha ao salvar integracao', extractApiError(err));
    } finally { setSaving(false); }
  }

  const confirmarAtivacaoEndpoint = useCallback(async () => {
    if (!confirmarAtivacao) return;
    setSwitching(true);
    try {
      await integracaoService.ativarEndpoint(confirmarAtivacao.integ.id, confirmarAtivacao.endpointAlvo.id);
      const amb = confirmarAtivacao.endpointAlvo.ambiente;
      const op = confirmarAtivacao.endpointAlvo.operacao;
      setConfirmarAtivacao(null);
      toast.success(`Endpoint ativado em ${amb}`, `Operacao "${op}"`);
      carregar();
    } catch (err) {
      toast.error('Falha ao ativar endpoint', extractApiError(err));
    } finally { setSwitching(false); }
  }, [confirmarAtivacao, toast]);

  const confirmarTrocaBulk = useCallback(async () => {
    if (!trocaBulk) return;
    setSwitchingBulk(true);
    try {
      const res = await integracaoService.trocarAmbienteModulo(
        trocaBulk.integ.id,
        trocaBulk.modulo,
        trocaBulk.ambienteAlvo,
      );
      const amb = trocaBulk.ambienteAlvo;
      setTrocaBulk(null);
      toast.success(`Ambiente do modulo alterado para ${amb}`, `${res.endpointsAtivados} operacao(oes) agora em ${amb}`);
      carregar();
    } catch (err) {
      toast.error('Falha ao trocar ambiente do modulo', extractApiError(err));
    } finally { setSwitchingBulk(false); }
  }, [trocaBulk, toast]);

  // --- Endpoint CRUD ---

  function iniciarNovoEndpoint(integracaoId: string, moduloPadrao: ModuloConsumidor = 'INVENTARIO') {
    setShowEpForm(integracaoId);
    setEditingEpId(null);
    setEpModulo(moduloPadrao);
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
    setEpModulo(ep.modulo);
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
          modulo: epModulo,
          ambiente: epAmbiente,
          descricao: epDescricao || undefined,
          url: epUrl,
          metodo: epMetodo,
          timeoutMs: parseInt(epTimeout),
        } as any);
      } else {
        await integracaoService.adicionarEndpoint(showEpForm, {
          modulo: epModulo,
          ambiente: epAmbiente,
          operacao: epOperacao.trim(),
          descricao: epDescricao || undefined,
          url: epUrl,
          metodo: epMetodo,
          timeoutMs: parseInt(epTimeout),
        } as any);
      }
      setShowEpForm(null);
      setEditingEpId(null);
      toast.success(editingEpId ? 'Endpoint atualizado' : 'Endpoint criado');
      carregar();
    } catch (err) {
      toast.error('Falha ao salvar endpoint', extractApiError(err));
    } finally { setSavingEp(false); }
  }

  function abrirConfirmacaoAtivacao(integ: IntegracaoApi, ep: IntegracaoEndpoint) {
    if (ep.ativo) return; // ja ativo — nada a fazer
    // Encontra o irmao atualmente ativo (mesmo modulo+operacao, outro ambiente)
    const atualAtivo = integ.endpoints.find(
      (e) => e.modulo === ep.modulo && e.operacao === ep.operacao && e.ativo,
    ) ?? null;
    setConfirmarAtivacao({ integ, endpointAlvo: ep, endpointAtualAtivo: atualAtivo });
  }

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

  async function testarTodosModulo(integ: IntegracaoApi, modulo: ModuloConsumidor) {
    const endpoints = integ.endpoints.filter((ep) => ep.modulo === modulo && ep.ativo);
    for (const ep of endpoints) {
      await testarEndpoint(ep, integ);
    }
  }

  return (
    <>
      <Header title="Integracoes API" ambienteAtivo={null} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-slate-500">
            Gerencie as integracoes com sistemas externos (ERP, GLPI, etc.) —
            cada modulo consumidor tem seus proprios endpoints ativaveis independentemente.
          </p>
          {canEdit && (
            <button onClick={iniciarNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
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
            <div className="grid grid-cols-2 gap-4 mb-4">
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
            <div className="grid grid-cols-5 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Integracao</label>
                <select value={showEpForm} onChange={(e) => setShowEpForm(e.target.value)} disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100">
                  {integracoes.map((i) => <option key={i.id} value={i.id}>{i.nome} ({i.codigo})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Modulo *</label>
                <select value={epModulo} onChange={(e) => setEpModulo(e.target.value as ModuloConsumidor)} disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100">
                  {MODULOS_CONSUMIDORES.map((m) => <option key={m} value={m}>{MODULO_LABEL[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ambiente</label>
                <select value={epAmbiente} onChange={(e) => setEpAmbiente(e.target.value as any)} disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100">
                  {AMBIENTES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Operacao *</label>
                <input type="text" value={epOperacao} onChange={(e) => setEpOperacao(e.target.value)} required disabled={!!editingEpId}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs disabled:bg-slate-100" placeholder="xmlNfe" />
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

        {/* Lista agrupada por integracao > modulo */}
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
              return (
                <div key={integ.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  {/* Header da integracao */}
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Plug className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-slate-800">{integ.nome}</span>
                      <span className="text-xs font-mono text-slate-400 bg-slate-200 px-2 py-0.5 rounded">{integ.codigo}</span>
                      <span className="text-xs text-slate-400">Auth: {integ.tipoAuth}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <>
                          <button onClick={() => iniciarNovoEndpoint(integ.id)} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50">
                            <Plus className="w-3.5 h-3.5" /> Endpoint
                          </button>
                          <button onClick={() => iniciarEdicao(integ)} className="text-slate-400 hover:text-emerald-600" title="Editar integracao"><Pencil className="w-4 h-4" /></button>
                          <button onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir integracao "${integ.nome}"?`,
                              description: 'Todos os endpoints vinculados serao removidos. Esta acao nao pode ser desfeita.',
                              variant: 'danger',
                              confirmLabel: 'Excluir',
                            });
                            if (!ok) return;
                            try {
                              await integracaoService.excluir(integ.id);
                              toast.success('Integracao excluida');
                              carregar();
                            } catch (err) {
                              toast.error('Erro ao excluir', extractApiError(err));
                            }
                          }} className="text-slate-400 hover:text-red-600" title="Excluir integracao"><Trash2 className="w-4 h-4" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tabs por modulo */}
                  {(() => {
                    const modulosComEndpoints = MODULOS_CONSUMIDORES.filter(
                      (m) => integ.endpoints.some((ep) => ep.modulo === m),
                    );
                    if (modulosComEndpoints.length === 0) return null;

                    const moduloAtivo: ModuloConsumidor =
                      activeTab[integ.id] && modulosComEndpoints.includes(activeTab[integ.id])
                        ? activeTab[integ.id]
                        : modulosComEndpoints[0];

                    const endpointsDoModulo = integ.endpoints.filter((ep) => ep.modulo === moduloAtivo);
                    const operacoes = [...new Set(endpointsDoModulo.map((ep) => ep.operacao))];

                    return (
                      <>
                        {/* Tab bar */}
                        <div className="flex items-stretch border-b border-slate-200 bg-white px-2">
                          {modulosComEndpoints.map((modulo) => {
                            const endpoints = integ.endpoints.filter((ep) => ep.modulo === modulo);
                            const ativos = endpoints.filter((ep) => ep.ativo).length;
                            const ambiente = ambienteDoModulo(integ.endpoints, modulo);
                            const Icon = MODULO_ICON[modulo];
                            const ativo = modulo === moduloAtivo;
                            return (
                              <button
                                key={modulo}
                                onClick={() => setActiveTab((prev) => ({ ...prev, [integ.id]: modulo }))}
                                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
                                  ativo
                                    ? 'border-emerald-600 text-emerald-700 font-semibold bg-emerald-50/40'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{MODULO_LABEL[modulo]}</span>
                                <AmbienteBadge ambiente={ambiente} />
                                <span className="text-[11px] text-slate-400">{ativos}/{endpoints.length}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Sub-header: acoes do modulo ativo */}
                        {canEdit && (
                          <div className="flex items-center justify-end gap-2 px-6 py-2.5 bg-slate-50/60 border-b border-slate-100">
                            <button
                              onClick={() => setTrocaBulk({ integ, modulo: moduloAtivo, ambienteAlvo: 'HOMOLOGACAO' })}
                              className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 px-2 py-1 rounded border border-amber-200 hover:bg-amber-50"
                              title={`Ativar todos os endpoints de ${MODULO_LABEL[moduloAtivo]} em HOMOLOGACAO`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" /> Todos HOM
                            </button>
                            <button
                              onClick={() => setTrocaBulk({ integ, modulo: moduloAtivo, ambienteAlvo: 'PRODUCAO' })}
                              className="flex items-center gap-1 text-xs text-red-700 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                              title={`Ativar todos os endpoints de ${MODULO_LABEL[moduloAtivo]} em PRODUCAO`}
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" /> Todos PROD
                            </button>
                            <span className="mx-1 h-4 w-px bg-slate-200" />
                            <button
                              onClick={() => testarTodosModulo(integ, moduloAtivo)}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                            >
                              <TestTube2 className="w-3.5 h-3.5" /> Testar Todos
                            </button>
                            <button
                              onClick={() => iniciarNovoEndpoint(integ.id, moduloAtivo)}
                              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded border border-emerald-200 hover:bg-emerald-50"
                            >
                              <Plus className="w-3.5 h-3.5" /> Endpoint
                            </button>
                          </div>
                        )}

                        {/* Tabela do modulo ativo */}
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
                                {canEdit && <th className="px-4 py-2.5 text-right">Acoes</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {operacoes.map((op) => {
                                const epProd = endpointsDoModulo.find((ep) => ep.operacao === op && ep.ambiente === 'PRODUCAO');
                                const epHomol = endpointsDoModulo.find((ep) => ep.operacao === op && ep.ambiente === 'HOMOLOGACAO');
                                const epAtivo = [epProd, epHomol].find((ep) => ep?.ativo) ?? null;
                                const epDisplay = epAtivo || epProd || epHomol;
                                if (!epDisplay) return null;

                                const renderDot = (ep: IntegracaoEndpoint | undefined) => {
                                  if (!ep) return <span className="text-xs text-slate-300">-</span>;
                                  const color = ep.ativo ? 'bg-green-500' : 'bg-slate-300 hover:bg-slate-400';
                                  return (
                                    <button
                                      onClick={() => canEdit && abrirConfirmacaoAtivacao(integ, ep)}
                                      disabled={!canEdit || ep.ativo}
                                      className={`inline-block w-3 h-3 rounded-full transition-colors ${color} ${canEdit && !ep.ativo ? 'cursor-pointer' : 'cursor-default'}`}
                                      title={ep.ativo ? `ATIVO: ${ep.url}` : `Clique para ativar: ${ep.url}`}
                                    />
                                  );
                                };

                                const urlAtiva = (epAtivo || epDisplay).url;
                                return (
                                  <tr key={op} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                      <span className="font-medium text-slate-700">{op}</span>
                                      {epDisplay.descricao && <p className="text-xs text-slate-400 mt-0.5">{epDisplay.descricao}</p>}
                                    </td>
                                    <td className="px-4 py-3 text-center">{renderDot(epProd)}</td>
                                    <td className="px-4 py-3 text-center">{renderDot(epHomol)}</td>
                                    <td className="px-4 py-3"><MetodoBadge metodo={epDisplay.metodo} /></td>
                                    <td className="px-4 py-3 max-w-xs">
                                      <span
                                        className="block truncate text-xs font-mono text-slate-600"
                                        title={urlAtiva}
                                      >
                                        {urlAtiva}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500">{(epDisplay.timeoutMs / 1000).toFixed(0)}s</td>
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
                                      ) : !epAtivo ? (
                                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                          <AlertTriangle className="w-3 h-3" /> Sem ativo
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-300">-</span>
                                      )}
                                    </td>
                                    {canEdit && (
                                      <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
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
                                          <button
                                            onClick={() => iniciarEdicaoEndpoint(epDisplay)}
                                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-md"
                                            title="Editar endpoint"
                                          >
                                            <Pencil className="w-3 h-3" /> Editar
                                          </button>
                                          <button
                                            onClick={async () => {
                                              const ok = await confirm({
                                                title: `Excluir endpoint "${epDisplay.operacao}"?`,
                                                description: `Ambiente ${epDisplay.ambiente}. Esta acao nao pode ser desfeita.`,
                                                variant: 'danger',
                                                confirmLabel: 'Excluir',
                                              });
                                              if (!ok) return;
                                              try {
                                                await integracaoService.excluirEndpoint(epDisplay.id);
                                                toast.success('Endpoint excluido');
                                                carregar();
                                              } catch (err) {
                                                toast.error('Erro ao excluir endpoint', extractApiError(err));
                                              }
                                            }}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                                            title="Excluir endpoint"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}

                  {/* Fallback: endpoints sem modulo (nunca deveria acontecer apos migration) */}
                  {integ.endpoints.filter((ep) => !MODULOS_CONSUMIDORES.includes(ep.modulo)).length > 0 && (
                    <div className="px-6 py-3 bg-red-50 border-t border-red-200 text-xs text-red-700">
                      Existem endpoints sem modulo definido — contate o administrador.
                    </div>
                  )}

                  {integ.endpoints.length === 0 && (
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

      {/* Modal de confirmacao de ativacao de endpoint */}
      {confirmarAtivacao && (
        <ModalConfirmarAtivacao
          integ={confirmarAtivacao.integ}
          endpointAlvo={confirmarAtivacao.endpointAlvo}
          endpointAtualAtivo={confirmarAtivacao.endpointAtualAtivo}
          onConfirm={confirmarAtivacaoEndpoint}
          onCancel={() => setConfirmarAtivacao(null)}
          switching={switching}
        />
      )}

      {/* Modal de troca em massa por modulo */}
      {trocaBulk && (
        <ModalConfirmarTrocaBulk
          integ={trocaBulk.integ}
          modulo={trocaBulk.modulo}
          ambienteAlvo={trocaBulk.ambienteAlvo}
          endpoints={trocaBulk.integ.endpoints.filter((ep) => ep.modulo === trocaBulk.modulo)}
          onConfirm={confirmarTrocaBulk}
          onCancel={() => setTrocaBulk(null)}
          switching={switchingBulk}
        />
      )}
    </>
  );
}
