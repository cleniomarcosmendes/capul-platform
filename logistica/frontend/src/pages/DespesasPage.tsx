import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Banknote, Check, Loader2, Paperclip, Pencil, Plus, Printer, Tag, Trash2, X } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { useAuth } from '../contexts/AuthContext';

// Despesas da frota (Fase 2) com governança em 3 níveis. Padrão workspace:
// grid + formulários inline (sem modal). Lançamento direto (supervisor/gestor)
// já entra APROVADA; lançamento do motorista (matrícula+senha, na tela de Frota)
// entra PENDENTE e exige validação aqui.

interface TipoDespesa { id: string; nome: string; descricao?: string | null; ativo: boolean; requerAprovacao: boolean }
interface FornecedorDespesa { id: string; nome: string; ativo: boolean }
interface LocalParada { id: string; nome: string; ativo: boolean; filialId?: string | null; departamentoId?: string | null; veiculoId?: string | null }
interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface VeiculoItem { id: string; placa: string; modelo?: string | null }
interface Despesa {
  id: string; situacao: string; placa: string; modelo?: string | null; veiculoId: string;
  tipo: string; valor: number; dataDespesa: string; fornecedor?: string | null;
  observacao?: string | null; autorNome?: string | null; aprovadoEm?: string | null;
  motivoContestacao?: string | null; temComprovante?: boolean;
  anormalidade?: boolean; motivoAnormalidade?: string | null;
  numeroDocumento?: string | null; semNota?: boolean;
}
const SIT_META: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-emerald-100 text-emerald-700' },
  CONTESTADA: { label: 'Contestada', cls: 'bg-rose-100 text-rose-700' },
};
const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const errMsg = (e: unknown, fb: string) => {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : (typeof m === 'string' ? m : fb);
};
const hoje = new Date();

export function DespesasPage() {
  const { logisticaRole } = useAuth();
  const ehGestor = logisticaRole === 'GESTOR_FROTA' || logisticaRole === 'ADMIN';
  const [tab, setTab] = useState<'despesas' | 'tipos' | 'fornecedores' | 'locais'>('despesas');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Banknote className="h-6 w-6 text-capul-600" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Custos da Frota</h2>
          <p className="text-sm text-slate-500">Despesas, fornecedores e locais — por veículo, com validação do supervisor / gestor de frota.</p>
        </div>
      </div>

      {ehGestor && (
        <div className="flex gap-1 border-b border-slate-200">
          {(['despesas', 'tipos', 'fornecedores', 'locais'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium ${tab === t ? 'border-b-2 border-capul-600 text-capul-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'despesas' ? 'Despesas' : t === 'tipos' ? 'Tipos de despesa' : t === 'fornecedores' ? 'Fornecedores' : 'Locais de parada'}
            </button>
          ))}
        </div>
      )}

      {tab === 'despesas' ? <DespesasTab /> : tab === 'tipos' ? <TiposTab /> : tab === 'fornecedores' ? <FornecedoresTab /> : <LocaisTab />}
    </div>
  );
}

// ---- Aba Despesas ----
type SortCol = 'data' | 'veiculo' | 'tipo' | 'documento' | 'valor' | 'fornecedor' | 'autor' | 'situacao';

function DespesasTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [situacao, setSituacao] = useState('');
  const [veiculoFiltro, setVeiculoFiltro] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('data');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const carregar = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (mes) { params.mes = mes; params.ano = ano; } // mes 0 = Todos os meses
      if (situacao) params.situacao = situacao;
      if (veiculoFiltro) params.veiculoId = veiculoFiltro;
      const [d, v] = await Promise.all([
        logisticaApi.get<Despesa[]>('/despesas', { params }),
        logisticaApi.get<VeiculoItem[]>('/veiculos'),
      ]);
      setDespesas(d.data); setVeiculos(v.data);
    } catch (e) {
      toast('error', errMsg(e, 'Falha ao carregar despesas.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano, situacao, veiculoFiltro]);

  const toggleSort = (col: SortCol) => {
    if (col === sortCol) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'data' || col === 'valor' ? 'desc' : 'asc'); }
  };
  const ordenadas = useMemo(() => {
    const val = (d: Despesa): string | number => {
      switch (sortCol) {
        case 'data': return new Date(d.dataDespesa).getTime();
        case 'veiculo': return d.placa ?? '';
        case 'tipo': return d.tipo ?? '';
        case 'documento': return d.numeroDocumento ?? '';
        case 'valor': return d.valor ?? 0;
        case 'fornecedor': return d.fornecedor ?? '';
        case 'autor': return d.autorNome ?? '';
        case 'situacao': return d.situacao ?? '';
      }
    };
    const arr = [...despesas].sort((a, b) => {
      const va = val(a), vb = val(b);
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [despesas, sortCol, sortDir]);

  const totalPeriodo = useMemo(() => despesas.reduce((s, d) => s + Number(d.valor || 0), 0), [despesas]);

  const periodoLabel = mes
    ? `${new Date(2000, mes - 1, 1).toLocaleString('pt-BR', { month: 'long' })} / ${ano}`
    : 'Todos os meses';
  const imprimir = () => {
    const filtros: string[] = [`Período: ${periodoLabel}`];
    if (veiculoFiltro) filtros.push(`Veículo: ${veiculos.find((v) => v.id === veiculoFiltro)?.placa ?? '—'}`);
    if (situacao) filtros.push(`Situação: ${SIT_META[situacao]?.label ?? situacao}`);
    abrirRelatorioDespesas(ordenadas, filtros, totalPeriodo);
  };

  const Th = ({ col, children, right }: { col: SortCol; children: React.ReactNode; right?: boolean }) => (
    <th className={`px-4 py-2 ${right ? 'text-right' : ''}`}>
      <button onClick={() => toggleSort(col)} className={`flex items-center gap-1 hover:text-slate-700 ${right ? 'ml-auto' : ''}`}>
        {children} <SortIcon active={sortCol === col} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value={0}>Todos os meses</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}</option>)}
        </select>
        <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} disabled={!mes}
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-100 disabled:text-slate-400" />
        <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todas situações</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="APROVADA">Aprovadas</option>
          <option value="CONTESTADA">Contestadas</option>
        </select>
        <select value={veiculoFiltro} onChange={(e) => setVeiculoFiltro(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Todos veículos</option>
          {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={imprimir} disabled={despesas.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={() => navigate('/despesas/nova')} className="inline-flex items-center gap-2 rounded-lg bg-capul-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-capul-700">
            <Plus className="h-4 w-4" /> Lançar despesa
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
        ) : despesas.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">Nenhuma despesa no período.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <Th col="data">Data</Th>
                <Th col="veiculo">Veículo</Th>
                <Th col="tipo">Tipo</Th>
                <Th col="documento">Documento</Th>
                <Th col="valor" right>Valor</Th>
                <Th col="fornecedor">Fornecedor</Th>
                <Th col="autor">Autor</Th>
                <Th col="situacao">Situação</Th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenadas.map((d) => (
                <LinhaDespesa key={d.id} d={d} onChanged={carregar} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <td className="px-4 py-2" colSpan={4}>Total ({despesas.length} despesa{despesas.length === 1 ? '' : 's'})</td>
                <td className="px-4 py-2 text-right tabular-nums">{BRL(totalPeriodo)}</td>
                <td className="px-4 py-2" colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

// Relatório de despesas para impressão — abre nova janela com HTML inline (React 19
// não aplica <style> dinâmico; gerar o documento bruto evita o problema). Respeita os
// filtros atuais do grid e a ordenação corrente. Inclui subtotal por tipo de despesa.
function abrirRelatorioDespesas(despesas: Despesa[], filtros: string[], total: number) {
  // Escapa também aspas (defesa em profundidade): hoje só interpola em texto, mas mantém o helper
  // seguro caso algum valor passe a cair em atributo HTML no relatório de impressão.
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  // Subtotais por tipo (desc por valor).
  const porTipo = new Map<string, number>();
  for (const d of despesas) porTipo.set(d.tipo, (porTipo.get(d.tipo) ?? 0) + Number(d.valor || 0));
  const subtotais = [...porTipo.entries()].sort((a, b) => b[1] - a[1]);
  const linhas = despesas.map((d) => `
    <tr>
      <td>${esc(fmtDate(d.dataDespesa))}</td>
      <td>${esc(d.placa)}${d.modelo ? ` · ${esc(d.modelo)}` : ''}</td>
      <td>${esc(d.tipo)}</td>
      <td>${d.semNota ? 'S/N' : esc(d.numeroDocumento ?? '—')}</td>
      <td class="r num">${esc(brl(Number(d.valor || 0)))}</td>
      <td>${esc(d.fornecedor ?? '—')}</td>
      <td>${esc(d.autorNome ?? '—')}</td>
      <td>${esc(SIT_META[d.situacao]?.label ?? d.situacao)}</td>
    </tr>`).join('');
  const subRows = subtotais.map(([t, v]) => `<tr><td>${esc(t)}</td><td class="r num">${esc(brl(v))}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Despesas — Frota</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;margin:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:20px;font-weight:800;margin:0 0 2px}
  .sub{color:#475569;font-size:12px;margin:0 0 14px}
  .filtros{font-size:12px;color:#334155;margin:0 0 14px}
  .filtros span{display:inline-block;background:#f1f5f9;border-radius:6px;padding:2px 8px;margin-right:6px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:18px}
  th{background:#0f172a;color:#fff;text-align:left;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:5px 8px;border-bottom:1px solid #e2e8f0}
  .r{text-align:right}
  .num{font-variant-numeric:tabular-nums}
  tfoot td{font-weight:800;border-top:2px solid #0f172a;background:#f8fafc}
  .grid2{display:flex;gap:24px;align-items:flex-start}
  .box{flex:0 0 auto;min-width:280px}
  .box h2{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin:0 0 6px}
  @media print{@page{size:A4 landscape;margin:10mm}.noprint{display:none}}
</style></head><body>
  <h1>Relatório de Despesas — Frota</h1>
  <p class="sub">CAPUL · Logística · gerado em ${new Date().toLocaleString('pt-BR')}</p>
  <div class="filtros">${filtros.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
  <table>
    <thead><tr><th>Data</th><th>Veículo</th><th>Tipo</th><th>Documento</th><th class="r">Valor</th><th>Fornecedor</th><th>Autor</th><th>Situação</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td colspan="4">Total — ${despesas.length} despesa(s)</td><td class="r num">${esc(brl(total))}</td><td colspan="3"></td></tr></tfoot>
  </table>
  <div class="grid2">
    <div class="box">
      <h2>Subtotais por tipo de despesa</h2>
      <table><tbody>${subRows}</tbody>
      <tfoot><tr><td>Total</td><td class="r num">${esc(brl(total))}</td></tr></tfoot></table>
    </div>
  </div>
  <script>window.onload=function(){window.print()}</script>
</body></html>`;
  const w = window.open('', '_blank', 'noopener,width=1000,height=700');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function LinhaDespesa({ d, onChanged }: { d: Despesa; onChanged: () => void }) {
  const { toast, confirm } = useToast();
  const navigate = useNavigate();
  const sit = SIT_META[d.situacao] ?? { label: d.situacao, cls: 'bg-slate-100 text-slate-600' };
  const [contestando, setContestando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [busy, setBusy] = useState(false);

  const aprovar = async () => {
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/aprovar`); toast('success', 'Despesa aprovada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao aprovar.')); } finally { setBusy(false); }
  };
  const excluir = async () => {
    const ok = await confirm('Excluir despesa', `Excluir a despesa de ${BRL(d.valor)} (${d.tipo} · ${d.placa})? Esta ação não pode ser desfeita.`, { confirmLabel: 'Excluir', variant: 'danger' });
    if (!ok) return;
    setBusy(true);
    try { await logisticaApi.delete(`/despesas/${d.id}`); toast('success', 'Despesa excluída.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao excluir.')); } finally { setBusy(false); }
  };
  const contestar = async () => {
    if (!motivo.trim()) { toast('warning', 'Informe o motivo da contestação.'); return; }
    setBusy(true);
    try { await logisticaApi.patch(`/despesas/${d.id}/contestar`, { motivo: motivo.trim() }); toast('success', 'Despesa contestada.'); onChanged(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao contestar.')); } finally { setBusy(false); }
  };
  const verRecibo = async () => {
    setBusy(true);
    try {
      const { data } = await logisticaApi.get(`/despesas/${d.id}/comprovante`, { responseType: 'blob' });
      window.open(URL.createObjectURL(data as Blob), '_blank', 'noopener');
    } catch (e) { toast('error', errMsg(e, 'Falha ao abrir o recibo.')); } finally { setBusy(false); }
  };

  return (
    <>
      <tr className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/despesas/${d.id}/editar`)} title="Clique para editar">
        <td className="px-4 py-2 text-slate-600">{fmtDate(d.dataDespesa)}</td>
        <td className="px-4 py-2">{d.placa}{d.modelo ? <span className="text-slate-400"> · {d.modelo}</span> : null}</td>
        <td className="px-4 py-2">{d.tipo}</td>
        <td className="px-4 py-2 text-slate-600">{d.semNota ? <span className="text-slate-400 italic">S/N</span> : (d.numeroDocumento ?? '—')}</td>
        <td className="px-4 py-2 text-right tabular-nums">{BRL(d.valor)}</td>
        <td className="px-4 py-2 text-slate-600">
          <div className="flex items-center gap-2">
            <span className="block max-w-[12rem] truncate" title={d.fornecedor ?? ''}>{d.fornecedor ?? '—'}</span>
            {d.temComprovante && (
              <button onClick={(e) => { e.stopPropagation(); void verRecibo(); }} disabled={busy} title="Ver recibo" className="inline-flex shrink-0 items-center gap-1 rounded border border-capul-200 bg-capul-50 px-1.5 py-0.5 text-xs text-capul-700 hover:bg-capul-100 disabled:opacity-50">
                <Paperclip className="h-3 w-3" /> Recibo
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-slate-600"><span className="block max-w-[12rem] truncate" title={d.autorNome ?? ''}>{d.autorNome ?? '—'}</span></td>
        <td className="px-4 py-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sit.cls}`}>{sit.label}</span>
            {d.situacao === 'CONTESTADA' && d.motivoContestacao && <span className="text-xs text-rose-500" title={d.motivoContestacao}>ⓘ</span>}
            {d.anormalidade && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700" title={d.motivoAnormalidade ?? 'Anormalidade (mau uso)'}>
                <AlertTriangle className="h-3 w-3" /> Anormal
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-2">
            {d.situacao === 'PENDENTE' && (
              <>
                <button onClick={(e) => { e.stopPropagation(); void aprovar(); }} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> Aprovar
                </button>
                <button onClick={(e) => { e.stopPropagation(); setContestando((s) => !s); }} className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">
                  <X className="h-3.5 w-3.5" /> Contestar
                </button>
              </>
            )}
            <button onClick={(e) => { e.stopPropagation(); navigate(`/despesas/${d.id}/editar`); }} disabled={busy} title="Editar" className="inline-flex items-center rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); void excluir(); }} disabled={busy} title="Excluir" className="inline-flex items-center rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      {contestando && d.situacao === 'PENDENTE' && (
        <tr>
          <td colSpan={9} className="bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da contestação" maxLength={255} className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
              <button onClick={() => void contestar()} disabled={busy} className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50">Confirmar contestação</button>
              <button onClick={() => setContestando(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-white">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Ícone de ordenação (padrão workspace).
function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
  return dir === 'asc' ? <ArrowUp className="h-3 w-3 text-capul-600" /> : <ArrowDown className="h-3 w-3 text-capul-600" />;
}
const thCad = 'px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500';
const btnSortCad = 'flex items-center gap-1 hover:text-slate-700';
const pill = (ativo: boolean) => `rounded-full px-2 py-1 text-xs font-medium ${ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`;

// ---- Aba Fornecedores (gestor de frota) — padrão de cadastro do workspace ----
function FornecedoresTab() {
  const { toast } = useToast();
  const [fornecedores, setFornecedores] = useState<FornecedorDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<FornecedorDespesa[]>('/despesas/fornecedores'); setFornecedores(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar fornecedores.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/fornecedores', { nome: nome.trim() }); setNome(''); setShowForm(false); toast('success', 'Fornecedor criado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar fornecedor.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/despesas/fornecedores/${editId}`, { nome: editNome.trim() }); toast('success', 'Fornecedor atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (f: FornecedorDespesa) => {
    try { await logisticaApi.patch(`/despesas/fornecedores/${f.id}`, { ativo: !f.ativo }); toast('success', f.ativo ? 'Fornecedor inativado.' : 'Fornecedor ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [fornecedores, sortDir]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Fornecedores usados nas despesas da frota (postos, oficinas, etc.).</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="mb-4 max-w-md">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoFocus placeholder="ex.: Posto Ipiranga Centro"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : fornecedores.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum fornecedor cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  {editId === f.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={120} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><span className={pill(f.ativo)}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(f.id); setEditNome(f.nome); }} className="text-left font-medium text-capul-700 hover:underline">{f.nome}</button>
                      </td>
                      <td className="px-6 py-4"><span className={pill(f.ativo)}>{f.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(f.id); setEditNome(f.nome); }} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(f)} className="text-xs text-capul-600 hover:underline">{f.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- Aba Tipos de despesa (gestor de frota) — padrão de cadastro do workspace ----
// ---- Aba Locais de parada (gestor de frota) — pick-list do planejamento ----
const labelCore = (i?: CoreItem) => (i ? i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8) : '—');

function LocaisTab() {
  const { toast } = useToast();
  const [locais, setLocais] = useState<LocalParada[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Form de criação — nome + escopo.
  const [nome, setNome] = useState('');
  const [filialId, setFilialId] = useState(''); // '' = todas as filiais
  const [aplicaA, setAplicaA] = useState<'TODOS' | 'DEPTO' | 'VEICULO'>('TODOS');
  const [deptoId, setDeptoId] = useState('');
  const [veicId, setVeicId] = useState('');
  // Listas auxiliares (escopo).
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [deptos, setDeptos] = useState<CoreItem[]>([]);
  const [veiculos, setVeiculos] = useState<VeiculoItem[]>([]);

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<LocalParada[]>('/frota/locais'); setLocais(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar locais.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    coreApi.get<CoreItem[]>('/filiais').then((r) => setFiliais(r.data)).catch(() => {});
    coreApi.get<CoreItem[]>('/departamentos').then((r) => setDeptos(r.data)).catch(() => {});
    logisticaApi.get<VeiculoItem[]>('/veiculos').then((r) => setVeiculos(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filialNome = (id?: string | null) => (id ? labelCore(filiais.find((f) => f.id === id)) : 'Todas');
  const deptoNome = (id?: string | null) => (id ? labelCore(deptos.find((d) => d.id === id)) : '');
  const veicLabel = (id?: string | null) => { const v = veiculos.find((x) => x.id === id); return v ? `${v.placa}${v.modelo ? ` · ${v.modelo}` : ''}` : '—'; };
  const escopo = (l: LocalParada) => (l.veiculoId ? `Veículo: ${veicLabel(l.veiculoId)}` : l.departamentoId ? `Depto: ${deptoNome(l.departamentoId)}` : 'Todos');

  const resetForm = () => { setNome(''); setFilialId(''); setAplicaA('TODOS'); setDeptoId(''); setVeicId(''); };

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    if (aplicaA === 'DEPTO' && !deptoId) { toast('warning', 'Selecione o departamento.'); return; }
    if (aplicaA === 'VEICULO' && !veicId) { toast('warning', 'Selecione o veículo.'); return; }
    setSalvando(true);
    try {
      await logisticaApi.post('/frota/locais', {
        nome: nome.trim(),
        filialId: filialId || undefined,
        departamentoId: aplicaA === 'DEPTO' ? deptoId : undefined,
        veiculoId: aplicaA === 'VEICULO' ? veicId : undefined,
      });
      resetForm(); setShowForm(false); toast('success', 'Local criado.'); await carregar();
    } catch (e) { toast('error', errMsg(e, 'Falha ao criar local.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/frota/locais/${editId}`, { nome: editNome.trim() }); toast('success', 'Local atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (l: LocalParada) => {
    try { await logisticaApi.patch(`/frota/locais/${l.id}`, { ativo: !l.ativo }); toast('success', l.ativo ? 'Local inativado.' : 'Local ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...locais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [locais, sortDir]);

  const selCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Locais/pontos de parada — atalho ao planejar a rota. O <b>escopo</b> define onde o local aparece (todos, um departamento ou um veículo) — evita poluir a lista.</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">
          <Plus className="h-4 w-4" /> Novo Local
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120} autoFocus placeholder="ex.: Fazenda Boa Vista, Banco Centro" className={selCls} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Filial</label>
              <select value={filialId} onChange={(e) => setFilialId(e.target.value)} className={selCls}>
                <option value="">Todas as filiais</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Aplica a</label>
              <select value={aplicaA} onChange={(e) => setAplicaA(e.target.value as typeof aplicaA)} className={selCls}>
                <option value="TODOS">Todos (qualquer veículo/depto)</option>
                <option value="DEPTO">Um departamento</option>
                <option value="VEICULO">Um veículo (rota do carro)</option>
              </select>
            </div>
            {aplicaA === 'DEPTO' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Departamento *</label>
                <select value={deptoId} onChange={(e) => setDeptoId(e.target.value)} className={selCls}>
                  <option value="">Selecione…</option>
                  {deptos.map((d) => <option key={d.id} value={d.id}>{labelCore(d)}</option>)}
                </select>
              </div>
            )}
            {aplicaA === 'VEICULO' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Veículo *</label>
                <select value={veicId} onChange={(e) => setVeicId(e.target.value)} className={selCls}>
                  <option value="">Selecione…</option>
                  {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : locais.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum local cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Escopo</th>
                <th className={thCad}>Filial</th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  {editId === l.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={120} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3 text-slate-500">{escopo(l)}</td>
                      <td className="px-6 py-3 text-slate-500">{filialNome(l.filialId)}</td>
                      <td className="px-6 py-3"><span className={pill(l.ativo)}>{l.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} className="text-left font-medium text-capul-700 hover:underline">{l.nome}</button>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{escopo(l)}</td>
                      <td className="px-6 py-4 text-slate-600">{filialNome(l.filialId)}</td>
                      <td className="px-6 py-4"><span className={pill(l.ativo)}>{l.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(l)} className="text-xs text-capul-600 hover:underline">{l.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TiposTab() {
  const { toast } = useToast();
  const [tipos, setTipos] = useState<TipoDespesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [requerAprovacao, setRequerAprovacao] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editRequer, setEditRequer] = useState(true);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await logisticaApi.get<TipoDespesa[]>('/despesas/tipos'); setTipos(data); }
    catch (e) { toast('error', errMsg(e, 'Falha ao carregar tipos.')); } finally { setLoading(false); }
  };
  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const criar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast('warning', 'Informe o nome.'); return; }
    setSalvando(true);
    try { await logisticaApi.post('/despesas/tipos', { nome: nome.trim(), descricao: descricao.trim() || undefined, requerAprovacao }); setNome(''); setDescricao(''); setRequerAprovacao(true); setShowForm(false); toast('success', 'Tipo de despesa criado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao criar tipo.')); } finally { setSalvando(false); }
  };
  const salvarEdicao = async () => {
    if (!editId || !editNome.trim()) return;
    try { await logisticaApi.patch(`/despesas/tipos/${editId}`, { nome: editNome.trim(), descricao: editDescricao.trim() || undefined, requerAprovacao: editRequer }); toast('success', 'Tipo atualizado.'); setEditId(null); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };
  const toggle = async (t: TipoDespesa) => {
    try { await logisticaApi.patch(`/despesas/tipos/${t.id}`, { ativo: !t.ativo }); toast('success', t.ativo ? 'Tipo inativado.' : 'Tipo ativado.'); await carregar(); }
    catch (e) { toast('error', errMsg(e, 'Falha ao atualizar.')); }
  };

  const ordenados = useMemo(() => {
    const arr = [...tipos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return sortDir === 'asc' ? arr : arr.reverse();
  }, [tipos, sortDir]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">Classificação das despesas (Combustível, Manutenção, Pedágio, IPVA, etc.).</p>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); }} className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700">
          <Plus className="h-4 w-4" /> Novo Tipo
        </button>
      </div>

      {showForm && (
        <form onSubmit={criar} className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nome *</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={60} autoFocus placeholder="ex.: Lavagem"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Descrição (opcional)</label>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={255}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500" />
            </div>
          </div>
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={requerAprovacao} onChange={(e) => setRequerAprovacao(e.target.checked)} className="h-4 w-4 accent-capul-600" />
            Exige aprovação do supervisor/gestor
            <span className="text-xs text-slate-400">— desmarque para tipos que entram automáticos (ex.: Abastecimento)</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" disabled={salvando} className="rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-500">Carregando…</div>
      ) : tipos.length === 0 ? (
        <div className="py-12 text-center">
          <Tag className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-500">Nenhum tipo de despesa cadastrado</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className={thCad}><button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className={btnSortCad}>Nome <SortIcon active dir={sortDir} /></button></th>
                <th className={thCad}>Descrição</th>
                <th className={thCad}>Aprovação</th>
                <th className={thCad}>Status</th>
                <th className={thCad}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {ordenados.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  {editId === t.id ? (
                    <>
                      <td className="px-6 py-3"><input value={editNome} onChange={(e) => setEditNome(e.target.value)} maxLength={60} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} maxLength={255} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
                      <td className="px-6 py-3"><label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={editRequer} onChange={(e) => setEditRequer(e.target.checked)} className="h-4 w-4 accent-capul-600" /> Exige</label></td>
                      <td className="px-6 py-3"><span className={pill(t.ativo)}>{t.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => void salvarEdicao()} className="text-emerald-600 hover:text-emerald-800" title="Salvar"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <button onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditDescricao(t.descricao ?? ''); setEditRequer(t.requerAprovacao); }} className="text-left font-medium text-capul-700 hover:underline">{t.nome}</button>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{t.descricao ?? '—'}</td>
                      <td className="px-6 py-4">
                        {t.requerAprovacao
                          ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Exige aprovação</span>
                          : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Automática</span>}
                      </td>
                      <td className="px-6 py-4"><span className={pill(t.ativo)}>{t.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setEditId(t.id); setEditNome(t.nome); setEditDescricao(t.descricao ?? ''); setEditRequer(t.requerAprovacao); }} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                          <button onClick={() => void toggle(t)} className="text-xs text-capul-600 hover:underline">{t.ativo ? 'Inativar' : 'Ativar'}</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
