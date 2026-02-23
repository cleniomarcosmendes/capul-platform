import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { licencaService } from '../../services/licenca.service';
import { ArrowLeft, Edit3, RefreshCw, Receipt, PieChart, KeyRound, Clock } from 'lucide-react';
import type {
  Contrato,
  StatusContrato,
  ParcelaContrato,
  ContratoHistorico,
  SoftwareLicenca,
  CentroCusto,
  ModalidadeRateio,
} from '../../types';

const statusCores: Record<string, string> = {
  RASCUNHO: 'bg-slate-100 text-slate-700',
  ATIVO: 'bg-green-100 text-green-700',
  SUSPENSO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
  RENOVADO: 'bg-blue-100 text-blue-700',
  CANCELADO: 'bg-slate-200 text-slate-500',
};

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho', ATIVO: 'Ativo', SUSPENSO: 'Suspenso', VENCIDO: 'Vencido', RENOVADO: 'Renovado', CANCELADO: 'Cancelado',
};

const tipoLabels: Record<string, string> = {
  LICENCIAMENTO: 'Licenciamento', MANUTENCAO: 'Manutencao', SUPORTE: 'Suporte', CONSULTORIA: 'Consultoria',
  DESENVOLVIMENTO: 'Desenvolvimento', CLOUD_SAAS: 'Cloud/SaaS', OUTSOURCING: 'Outsourcing', OUTRO: 'Outro',
};

const parcelaStatusCores: Record<string, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  PAGA: 'bg-green-100 text-green-700',
  ATRASADA: 'bg-red-100 text-red-700',
  CANCELADA: 'bg-slate-200 text-slate-500',
};

const modalidadeLabels: Record<string, string> = {
  PERCENTUAL_CUSTOMIZADO: 'Percentual Customizado',
  VALOR_FIXO: 'Valor Fixo',
  PROPORCIONAL_CRITERIO: 'Proporcional por Criterio',
  IGUALITARIO: 'Igualitario',
  SEM_RATEIO: 'Sem Rateio',
};

const TRANSICOES: Record<string, StatusContrato[]> = {
  RASCUNHO: ['ATIVO', 'CANCELADO'],
  ATIVO: ['SUSPENSO', 'VENCIDO', 'CANCELADO'],
  SUSPENSO: ['ATIVO', 'CANCELADO'],
  VENCIDO: [],
};

type Tab = 'parcelas' | 'rateio' | 'licencas' | 'historico';

export function ContratoDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const canManage = ['ADMIN', 'GESTOR_TI'].includes(gestaoTiRole || '');

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('parcelas');

  useEffect(() => { load(); }, [id]);

  async function load() {
    if (!id) return;
    try {
      const data = await contratoService.buscar(id);
      setContrato(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleStatus(status: StatusContrato) {
    if (!id) return;
    try {
      const data = await contratoService.alterarStatus(id, status);
      setContrato(data);
    } catch {
      // ignore
    }
  }

  async function handleRenovar() {
    if (!id || !confirm('Confirma a renovacao deste contrato?')) return;
    try {
      const novo = await contratoService.renovar(id);
      navigate(`/gestao-ti/contratos/${novo.id}`);
    } catch {
      // ignore
    }
  }

  if (loading) return <><Header title="Contrato" /><div className="p-6"><p className="text-slate-500">Carregando...</p></div></>;
  if (!contrato) return <><Header title="Contrato" /><div className="p-6"><p className="text-red-500">Contrato nao encontrado</p></div></>;

  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);
  const transicoesPermitidas = TRANSICOES[contrato.status] || [];

  const tabs: { key: Tab; label: string; icon: typeof Receipt }[] = [
    { key: 'parcelas', label: 'Parcelas', icon: Receipt },
    { key: 'rateio', label: 'Rateio', icon: PieChart },
    { key: 'licencas', label: 'Licencas', icon: KeyRound },
    { key: 'historico', label: 'Historico', icon: Clock },
  ];

  return (
    <>
      <Header title={`Contrato #${contrato.numero}`} />
      <div className="p-6">
        <button onClick={() => navigate('/gestao-ti/contratos')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Header info */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-slate-800">{contrato.titulo}</h2>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCores[contrato.status]}`}>
                  {statusLabels[contrato.status]}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {tipoLabels[contrato.tipo]} | Fornecedor: {contrato.fornecedor}
                {contrato.cnpjFornecedor && ` (${contrato.cnpjFornecedor})`}
              </p>
              {contrato.software && (
                <p className="text-sm text-slate-500 mt-1">
                  Software: <Link to={`/gestao-ti/softwares/${contrato.software.id}`} className="text-capul-600 hover:underline">{contrato.software.nome}</Link>
                </p>
              )}
            </div>
            {canManage && !finalizado && (
              <div className="flex items-center gap-2">
                <Link to={`/gestao-ti/contratos/${contrato.id}/editar`}
                  className="flex items-center gap-1 text-sm text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                  <Edit3 className="w-3.5 h-3.5" /> Editar
                </Link>
                {(contrato.status === 'ATIVO' || contrato.status === 'VENCIDO') && (
                  <button onClick={handleRenovar}
                    className="flex items-center gap-1 text-sm text-capul-600 border border-capul-300 px-3 py-1.5 rounded-lg hover:bg-capul-50">
                    <RefreshCw className="w-3.5 h-3.5" /> Renovar
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Valor Total</p>
              <p className="font-semibold text-slate-800">R$ {Number(contrato.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            {contrato.valorMensal && (
              <div>
                <p className="text-slate-500">Valor Mensal</p>
                <p className="font-semibold text-slate-800">R$ {Number(contrato.valorMensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Vigencia</p>
              <p className="font-semibold text-slate-800">
                {new Date(contrato.dataInicio).toLocaleDateString('pt-BR')} - {new Date(contrato.dataFim).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Parcelas / Licencas</p>
              <p className="font-semibold text-slate-800">{contrato._count.parcelas} / {contrato._count.licencas}</p>
            </div>
          </div>

          {canManage && transicoesPermitidas.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-200">
              <span className="text-xs text-slate-500">Alterar status:</span>
              {transicoesPermitidas.map((s) => (
                <button key={s} onClick={() => handleStatus(s)}
                  className={`text-xs px-3 py-1 rounded-full border ${statusCores[s]} hover:opacity-80`}>
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-slate-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-capul-600 text-capul-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'parcelas' && <TabParcelas contrato={contrato} canManage={canManage} onReload={load} />}
        {tab === 'rateio' && <TabRateio contrato={contrato} canManage={canManage} onReload={load} />}
        {tab === 'licencas' && <TabLicencas contrato={contrato} canManage={canManage} onReload={load} />}
        {tab === 'historico' && <TabHistorico historicos={contrato.historicos || []} />}
      </div>
    </>
  );
}

// ─── Tab Parcelas ────────────────────────────────────────────

function TabParcelas({ contrato, canManage, onReload }: { contrato: Contrato; canManage: boolean; onReload: () => void }) {
  const parcelas = contrato.parcelas || [];
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [showForm, setShowForm] = useState(false);
  const [numero, setNumero] = useState(String(parcelas.length + 1));
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await contratoService.criarParcela(contrato.id, {
        numero: parseInt(numero, 10),
        descricao: descricao || undefined,
        valor: parseFloat(valor),
        dataVencimento,
      });
      setShowForm(false);
      setDescricao('');
      setValor('');
      setDataVencimento('');
      onReload();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handlePagar(p: ParcelaContrato) {
    if (!confirm(`Confirma pagamento da parcela #${p.numero}?`)) return;
    try {
      await contratoService.pagarParcela(contrato.id, p.id);
      onReload();
    } catch { /* ignore */ }
  }

  async function handleCancelar(p: ParcelaContrato) {
    if (!confirm(`Cancelar parcela #${p.numero}?`)) return;
    try {
      await contratoService.cancelarParcela(contrato.id, p.id);
      onReload();
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Parcelas ({parcelas.length})</h4>
        {canManage && !finalizado && (
          <button onClick={() => { setShowForm(!showForm); setNumero(String(parcelas.length + 1)); }}
            className="text-xs text-capul-600 hover:underline">{showForm ? 'Cancelar' : '+ Nova Parcela'}</button>
        )}
      </div>
      {showForm && (
        <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">#</label>
            <input type="number" min="1" value={numero} onChange={(e) => setNumero(e.target.value)} required
              className="w-16 border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-slate-500 mb-1">Descricao</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Valor (R$) *</label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required
              className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Vencimento *</label>
            <input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} required
              className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
          </div>
          <button type="submit" disabled={saving}
            className="bg-capul-600 text-white px-4 py-1.5 rounded text-sm hover:bg-capul-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      )}
      {parcelas.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhuma parcela cadastrada</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600">#</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Descricao</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Pagamento</th>
              <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
              {canManage && <th className="text-center px-4 py-2 font-medium text-slate-600">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {parcelas.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-500">{p.numero}</td>
                <td className="px-4 py-2.5 text-slate-700">{p.descricao || '-'}</td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                  R$ {Number(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{new Date(p.dataVencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2.5 text-slate-600">{p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${parcelaStatusCores[p.status]}`}>{p.status}</span>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5 text-center">
                    {p.status === 'PENDENTE' && (
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handlePagar(p)} className="text-xs text-green-600 hover:underline">Pagar</button>
                        <button onClick={() => handleCancelar(p)} className="text-xs text-red-500 hover:underline">Cancelar</button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Tab Rateio ──────────────────────────────────────────────

function TabRateio({ contrato, canManage, onReload }: { contrato: Contrato; canManage: boolean; onReload: () => void }) {
  const rateio = contrato.rateioConfig;
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [modalidade, setModalidade] = useState<ModalidadeRateio>('PERCENTUAL_CUSTOMIZADO');
  const [criterio, setCriterio] = useState('');
  const [itens, setItens] = useState<{ centroCustoId: string; percentual: string; valorFixo: string; parametro: string }[]>([]);
  const [simulacao, setSimulacao] = useState<{ centroCustoId: string; valorCalculado: number }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    coreService.listarCentrosCusto().then(setCentrosCusto).catch(() => {});
  }, []);

  function addItem() {
    setItens([...itens, { centroCustoId: '', percentual: '', valorFixo: '', parametro: '' }]);
  }

  function updateItem(idx: number, field: string, value: string) {
    const updated = [...itens];
    updated[idx] = { ...updated[idx], [field]: value };
    setItens(updated);
  }

  function removeItem(idx: number) {
    setItens(itens.filter((_, i) => i !== idx));
  }

  function buildPayload() {
    return {
      modalidade,
      criterio: criterio || undefined,
      itens: itens.map((i) => ({
        centroCustoId: i.centroCustoId,
        percentual: i.percentual ? parseFloat(i.percentual) : undefined,
        valorFixo: i.valorFixo ? parseFloat(i.valorFixo) : undefined,
        parametro: i.parametro ? parseFloat(i.parametro) : undefined,
      })),
    };
  }

  async function handleSimular() {
    try {
      const result = await contratoService.simularRateio(contrato.id, buildPayload());
      setSimulacao(result as unknown as { centroCustoId: string; valorCalculado: number }[]);
    } catch { /* ignore */ }
  }

  async function handleConfirmar() {
    setSaving(true);
    try {
      await contratoService.configurarRateio(contrato.id, buildPayload());
      setShowForm(false);
      setSimulacao(null);
      onReload();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  const ccMap = Object.fromEntries(centrosCusto.map((c) => [c.id, c]));

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Rateio por Centro de Custo</h4>
        {canManage && !finalizado && (
          <button onClick={() => setShowForm(!showForm)}
            className="text-xs text-capul-600 hover:underline">{showForm ? 'Cancelar' : 'Configurar Rateio'}</button>
        )}
      </div>

      {rateio && !showForm && (
        <div className="px-6 py-4">
          <p className="text-sm text-slate-600 mb-3">
            Modalidade: <span className="font-medium">{modalidadeLabels[rateio.modalidade]}</span>
            {rateio.criterio && <span className="text-slate-400"> ({rateio.criterio})</span>}
          </p>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-600">Centro de Custo</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">%</th>
                <th className="text-right px-3 py-2 font-medium text-slate-600">Valor Calculado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rateio.itens.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-slate-700">{item.centroCusto.codigo} - {item.centroCusto.nome}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{item.percentual != null ? `${Number(item.percentual).toFixed(2)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">
                    R$ {Number(item.valorCalculado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!rateio && !showForm && (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum rateio configurado</p>
      )}

      {showForm && (
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Modalidade</label>
              <select value={modalidade} onChange={(e) => { setModalidade(e.target.value as ModalidadeRateio); setSimulacao(null); }}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
                {Object.entries(modalidadeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {modalidade === 'PROPORCIONAL_CRITERIO' && (
              <div>
                <label className="block text-xs text-slate-500 mb-1">Criterio</label>
                <input value={criterio} onChange={(e) => setCriterio(e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Ex: num. funcionarios" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            {itens.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select value={item.centroCustoId} onChange={(e) => updateItem(idx, 'centroCustoId', e.target.value)}
                  className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
                  <option value="">Selecione CC...</option>
                  {centrosCusto.map((cc) => <option key={cc.id} value={cc.id}>{cc.codigo} - {cc.nome}</option>)}
                </select>
                {modalidade === 'PERCENTUAL_CUSTOMIZADO' && (
                  <input type="number" step="0.01" placeholder="%" value={item.percentual} onChange={(e) => updateItem(idx, 'percentual', e.target.value)}
                    className="w-24 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                {modalidade === 'VALOR_FIXO' && (
                  <input type="number" step="0.01" placeholder="R$" value={item.valorFixo} onChange={(e) => updateItem(idx, 'valorFixo', e.target.value)}
                    className="w-32 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                {modalidade === 'PROPORCIONAL_CRITERIO' && (
                  <input type="number" step="0.01" placeholder="Param." value={item.parametro} onChange={(e) => updateItem(idx, 'parametro', e.target.value)}
                    className="w-28 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                )}
                <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm">X</button>
              </div>
            ))}
            <button onClick={addItem} className="text-xs text-capul-600 hover:underline">+ Adicionar CC</button>
          </div>

          {simulacao && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-2">Simulacao:</p>
              {simulacao.map((s, i) => (
                <p key={i} className="text-sm text-green-800">
                  {ccMap[s.centroCustoId]?.nome || s.centroCustoId}: R$ {Number(s.valorCalculado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleSimular} className="text-sm border border-capul-300 text-capul-600 px-4 py-1.5 rounded hover:bg-capul-50">
              Simular
            </button>
            <button onClick={handleConfirmar} disabled={saving}
              className="text-sm bg-capul-600 text-white px-4 py-1.5 rounded hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Confirmar Rateio'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Licencas ────────────────────────────────────────────

function TabLicencas({ contrato, canManage, onReload }: { contrato: Contrato; canManage: boolean; onReload: () => void }) {
  const licencas = contrato.licencas || [];
  const finalizado = ['RENOVADO', 'CANCELADO'].includes(contrato.status);

  const [disponíveis, setDisponíveis] = useState<SoftwareLicenca[]>([]);
  const [showVincular, setShowVincular] = useState(false);
  const [selectedLicId, setSelectedLicId] = useState('');

  async function loadDisponíveis() {
    try {
      const all = await licencaService.listar({ status: 'ATIVA' });
      const semContrato = all.filter((l: SoftwareLicenca) => !l.contratoId);
      setDisponíveis(semContrato);
    } catch { /* ignore */ }
  }

  async function handleVincular() {
    if (!selectedLicId) return;
    try {
      await contratoService.vincularLicenca(contrato.id, selectedLicId);
      setShowVincular(false);
      setSelectedLicId('');
      onReload();
    } catch { /* ignore */ }
  }

  async function handleDesvincular(licId: string) {
    if (!confirm('Desvincular esta licenca?')) return;
    try {
      await contratoService.desvincularLicenca(contrato.id, licId);
      onReload();
    } catch { /* ignore */ }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h4 className="font-semibold text-slate-700">Licencas Vinculadas ({licencas.length})</h4>
        {canManage && !finalizado && (
          <button onClick={() => { setShowVincular(!showVincular); if (!showVincular) loadDisponíveis(); }}
            className="text-xs text-capul-600 hover:underline">{showVincular ? 'Cancelar' : '+ Vincular Licenca'}</button>
        )}
      </div>

      {showVincular && (
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Selecione a licenca</label>
            <select value={selectedLicId} onChange={(e) => setSelectedLicId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm bg-white">
              <option value="">Selecione...</option>
              {disponíveis.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.software.nome} - {l.modeloLicenca || 'S/M'} (R$ {Number(l.valorTotal ?? 0).toLocaleString('pt-BR')})
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleVincular} disabled={!selectedLicId}
            className="bg-capul-600 text-white px-4 py-1.5 rounded text-sm hover:bg-capul-700 disabled:opacity-50">Vincular</button>
        </div>
      )}

      {licencas.length === 0 ? (
        <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhuma licenca vinculada</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Software</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Modelo</th>
              <th className="text-right px-4 py-2 font-medium text-slate-600">Valor</th>
              <th className="text-left px-4 py-2 font-medium text-slate-600">Vencimento</th>
              <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
              {canManage && <th className="text-center px-4 py-2 font-medium text-slate-600">Acoes</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {licencas.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 text-slate-700">{l.software.nome}</td>
                <td className="px-4 py-2.5 text-slate-600">{l.modeloLicenca || '-'}</td>
                <td className="px-4 py-2.5 text-right text-slate-700">
                  R$ {Number(l.valorTotal ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{l.dataVencimento ? new Date(l.dataVencimento).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${l.status === 'ATIVA' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {l.status}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => handleDesvincular(l.id)} className="text-xs text-red-500 hover:underline">Desvincular</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Tab Historico ───────────────────────────────────────────

function TabHistorico({ historicos }: { historicos: ContratoHistorico[] }) {
  if (historicos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 px-6 py-8 text-center">
        <p className="text-sm text-slate-400">Nenhum registro no historico</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <div className="divide-y divide-slate-100">
        {historicos.map((h) => (
          <div key={h.id} className="px-6 py-3 flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-capul-400 mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700">
                <span className="font-medium">{h.tipo.replace(/_/g, ' ')}</span>
                {h.descricao && <span className="text-slate-500"> — {h.descricao}</span>}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {h.usuario.nome} em {new Date(h.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
