import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { inventoryService } from '../services/inventory.service';
import { integrationService } from '../services/integration.service';
import type { InventoryList } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ArrowLeft, ArrowRight, Package, ArrowLeftRight, CheckCircle2, Loader2, FileText } from 'lucide-react';

type Tipo = 'SIMPLE' | 'COMPARATIVE';

const etapaConfig: Record<string, { label: string; color: string }> = {
  ENCERRADO: { label: 'Encerrado', color: 'bg-blue-100 text-blue-700' },
  ANALISADO: { label: 'Analisado', color: 'bg-purple-100 text-purple-700' },
  INTEGRADO: { label: 'Integrado', color: 'bg-emerald-100 text-emerald-700' },
};

function fallbackEtapa(status: string): string {
  if (status === 'CLOSED') return 'INTEGRADO';
  if (status === 'COMPLETED') return 'ENCERRADO';
  return status;
}

export default function IntegracaoNovaPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const initialInvA = params.get('inv_a') ?? '';

  const [step, setStep] = useState<1 | 2 | 3>(initialInvA ? 2 : 1);
  const [tipo, setTipo] = useState<Tipo>('SIMPLE');
  const [invAId, setInvAId] = useState<string>(initialInvA);
  const [invBId, setInvBId] = useState<string>('');

  const [available, setAvailable] = useState<InventoryList[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);

  const [saving, setSaving] = useState(false);

  // Carrega APENAS inventários elegíveis para nova integração:
  // status=COMPLETED + analisado_em != null + sem integração ativa.
  // Backend exclui CLOSED (já integrado) e qualquer já vinculado a integração não-CANCELLED.
  useEffect(() => {
    setLoadingList(true);
    inventoryService.listarDisponiveisIntegracao()
      .then((res) => setAvailable(res.items ?? []))
      .catch(() => setAvailable([]))
      .finally(() => setLoadingList(false));
  }, []);

  const invA = useMemo(() => available.find((i) => i.id === invAId), [available, invAId]);
  const invB = useMemo(() => available.find((i) => i.id === invBId), [available, invBId]);

  // Lista filtrada para escolha de inv_b
  const candidatesB = useMemo(() => {
    if (!invA) return [];
    return available.filter((i) => i.id !== invA.id && i.warehouse !== invA.warehouse);
  }, [available, invA]);

  // Avançar pro preview
  async function handlePreview() {
    if (!invAId) {
      toast.warning('Escolha o inventário base.');
      return;
    }
    if (tipo === 'COMPARATIVE' && !invBId) {
      toast.warning('Escolha o segundo inventário.');
      return;
    }
    setPreviewing(true);
    try {
      const res = await integrationService.preview(invAId, tipo === 'COMPARATIVE' ? invBId : undefined);
      setPreviewData(res as unknown as Record<string, unknown>);
      setStep(3);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao gerar preview.');
    } finally {
      setPreviewing(false);
    }
  }

  // Salvar (cria DRAFT)
  async function handleConfirmar() {
    setSaving(true);
    try {
      const res = await integrationService.salvar(invAId, tipo === 'COMPARATIVE' ? invBId : undefined);
      const integrationId = (res as { integration_id?: string })?.integration_id;
      toast.success('Integração criada. Confirme o envio ao Protheus na próxima tela.');
      if (integrationId) {
        navigate(`/inventario/integracoes/${integrationId}`);
      } else {
        navigate('/inventario/integracoes');
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(detail || 'Erro ao salvar integração.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Nova Integração Protheus" />
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <button
          onClick={() => navigate('/inventario/integracoes')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Integrações
        </button>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 text-sm">
          {[
            { n: 1, label: 'Tipo' },
            { n: 2, label: 'Inventário(s)' },
            { n: 3, label: 'Preview e Confirmar' },
          ].map((s, idx, arr) => (
            <div key={s.n} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                step === s.n ? 'bg-capul-600 text-white' : step > s.n ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s.n ? 'bg-white/30' : step > s.n ? 'bg-emerald-200' : 'bg-slate-200'
                }`}>{s.n}</span>
                {s.label}
              </div>
              {idx < arr.length - 1 && <div className="w-6 h-px bg-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Tipo */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-semibold text-slate-800">Escolha o tipo de integração</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => { setTipo('SIMPLE'); setInvBId(''); setStep(2); }}
                className="text-left border border-slate-200 hover:border-capul-500 hover:bg-sky-50 rounded-lg p-4 transition-colors"
              >
                <Package className="w-6 h-6 text-sky-600 mb-2" />
                <p className="font-semibold text-slate-800">Simples</p>
                <p className="text-xs text-slate-500 mt-1">
                  Apenas um inventário. Gera <strong>SB7</strong> (ajuste de estoque) no Protheus.
                  Use quando não há transferência entre armazéns a registrar.
                </p>
              </button>

              <button
                onClick={() => { setTipo('COMPARATIVE'); setStep(2); }}
                className="text-left border border-slate-200 hover:border-capul-500 hover:bg-purple-50 rounded-lg p-4 transition-colors"
              >
                <ArrowLeftRight className="w-6 h-6 text-purple-600 mb-2" />
                <p className="font-semibold text-slate-800">Comparativa</p>
                <p className="text-xs text-slate-500 mt-1">
                  Dois inventários de <strong>armazéns diferentes</strong>. Gera <strong>SD3</strong> (transferências
                  lógicas) + <strong>SB7</strong> (ajustes finais) no Protheus. Use para corrigir transferências
                  físicas que não foram lançadas no sistema (CD ↔ Venda).
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Inventários */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">
                  Inventário base
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    (Tipo: {tipo === 'SIMPLE' ? 'Simples' : 'Comparativa'})
                  </span>
                </h3>
                <button
                  onClick={() => { setStep(1); setInvAId(''); setInvBId(''); }}
                  className="text-xs text-capul-600 hover:underline"
                >
                  Trocar tipo
                </button>
              </div>

              {invA ? (
                <div className="border border-capul-300 bg-capul-50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{invA.name}</p>
                    <p className="text-xs text-slate-600">Armazém {invA.warehouse} · {invA.total_items} itens</p>
                  </div>
                  <button
                    onClick={() => { setInvAId(''); setInvBId(''); }}
                    className="text-xs text-capul-700 hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : loadingList ? (
                <p className="text-sm text-slate-400">Carregando inventários...</p>
              ) : available.length === 0 ? (
                <p className="text-sm text-amber-600">
                  Nenhum inventário Encerrado/Analisado disponível.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {available.map((inv) => {
                    const etapa = inv.etapa_atual || fallbackEtapa(inv.status);
                    const ec = etapaConfig[etapa] || { label: etapa, color: 'bg-slate-100 text-slate-700' };
                    return (
                      <button
                        key={inv.id}
                        onClick={() => setInvAId(inv.id)}
                        className="text-left border border-slate-200 hover:border-capul-500 hover:bg-capul-50 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ec.color}`}>
                            {ec.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Armazém <strong>{inv.warehouse}</strong> · {inv.total_items} itens
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* inv_b para Comparativa */}
            {tipo === 'COMPARATIVE' && invA && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-800">
                  Inventário comparativo
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    (armazém diferente de {invA.warehouse})
                  </span>
                </h3>

                {invB ? (
                  <div className="border border-purple-300 bg-purple-50 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{invB.name}</p>
                      <p className="text-xs text-slate-600">Armazém {invB.warehouse} · {invB.total_items} itens</p>
                    </div>
                    <button
                      onClick={() => setInvBId('')}
                      className="text-xs text-purple-700 hover:underline"
                    >
                      Trocar
                    </button>
                  </div>
                ) : candidatesB.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    Nenhum inventário disponível em armazém diferente. Para comparativa, precisa de pelo
                    menos um inventário em outro armazém.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {candidatesB.map((inv) => {
                      const etapa = inv.etapa_atual || fallbackEtapa(inv.status);
                      const ec = etapaConfig[etapa] || { label: etapa, color: 'bg-slate-100 text-slate-700' };
                      return (
                        <button
                          key={inv.id}
                          onClick={() => setInvBId(inv.id)}
                          className="text-left border border-slate-200 hover:border-purple-500 hover:bg-purple-50 rounded-lg p-3 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="font-medium text-slate-800 text-sm truncate">{inv.name}</p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${ec.color}`}>
                              {ec.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Armazém <strong>{inv.warehouse}</strong> · {inv.total_items} itens
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                onClick={handlePreview}
                disabled={!invAId || (tipo === 'COMPARATIVE' && !invBId) || previewing}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-capul-600 text-white rounded-lg hover:bg-capul-700 disabled:opacity-50"
              >
                {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {previewing ? 'Gerando preview...' : 'Gerar preview'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Preview + Confirmar */}
        {step === 3 && previewData && (
          <div className="space-y-3">
            <PreviewSummary data={previewData} />

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Criar Integração'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PreviewSummary({ data }: { data: Record<string, unknown> }) {
  const summary = (data.summary as Record<string, unknown>) || {};
  const tipo = String(data.integration_type || '');
  const totalTransfers = Number(summary.total_transfers ?? 0);
  const totalAdjustments = Number(summary.total_adjustments ?? 0);
  const totalItems = totalTransfers + totalAdjustments;

  // Formato BR com 2 casas (padrão monetário)
  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-slate-400" />
        <h3 className="font-semibold text-slate-800">Preview</h3>
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {tipo === 'COMPARATIVE' ? 'Comparativa' : 'Simples'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Transferências (SD3)</p>
          <p className="text-2xl font-bold text-slate-800">{totalTransfers}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Ajustes (SB7)</p>
          <p className="text-2xl font-bold text-slate-800">{totalAdjustments}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Valor transferências</p>
          <p className="text-base font-semibold text-slate-700">
            R$ {fmtBRL(Number(summary.total_transfer_value ?? 0))}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Valor ajustes</p>
          <p className="text-base font-semibold text-slate-700">
            R$ {fmtBRL(Number(summary.total_adjustment_value ?? 0))}
          </p>
        </div>
      </div>

      <div className="text-xs text-slate-500">
        Ao confirmar, a integração é criada e fica <strong>aguardando o envio</strong>.
        Você confirma o envio efetivo ao Protheus na próxima tela ({totalItems} ite{totalItems !== 1 ? 'ns' : 'm'} total).
      </div>
    </div>
  );
}
