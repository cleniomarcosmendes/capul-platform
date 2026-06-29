import { useCallback, useEffect, useState } from 'react';
import { Car, ChevronLeft, ChevronRight, Gauge, Loader2, Printer, RefreshCw } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useToast } from '../components/toast-context';
import { LinhaKmBarra } from '../components/LinhaKmBarra';
import { coresPorSegmento, fmtKm, HACHURA, type LinhaKm } from '../components/linhaKm';

// Página dedicada "Linha do KM" (prestação de contas do odômetro). Espelha o
// layout do Acompanhamento do Workspace: filtro de mês + veículo (um ou todos)
// e uma faixa grande por veículo. Read-only (gestores). Substitui a barrinha
// que ficava espremida no rodapé do formulário do veículo.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface VeiculoOpt { id: string; placa: string; modelo?: string | null; departamentoLotacaoId?: string; departamentoNome?: string | null }
interface Resp { mes: number | null; ano: number | null; veiculos: LinhaKm[] }
type Visao = 'linha' | 'pendencias';

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

// Visão "Pendências de KM": agrega os buracos (km não apontado) por
// departamento → veículo, ordenado pelos piores. Cobrança do hodômetro.
// Reusa o que o backend já calcula (kmNaoApontadas + segmentos de gap).
function PendenciasKm({ linhas, mesLabel, loading }: { linhas: LinhaKm[]; mesLabel: string; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>;
  const comGap = linhas.filter((l) => l.kmNaoApontadas > 0);
  if (comGap.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">Nenhum KM não apontado em {mesLabel}. 🎉</div>;
  }
  type Item = { veiculoId: string; placa: string; modelo?: string | null; km: number; nLacunas: number; maior: number };
  const porDepto = new Map<string, { nome: string; itens: Item[]; total: number }>();
  for (const l of comGap) {
    const gaps = l.segmentos.filter((s) => s.tipo === 'gap');
    const maior = gaps.reduce((m, g) => Math.max(m, g.km), 0);
    const nome = l.departamentoNome || '— sem departamento —';
    const key = l.departamentoLotacaoId || nome;
    const grp = porDepto.get(key) ?? { nome, itens: [], total: 0 };
    grp.itens.push({ veiculoId: l.veiculoId, placa: l.placa, modelo: l.modelo, km: l.kmNaoApontadas, nLacunas: gaps.length, maior });
    grp.total += l.kmNaoApontadas;
    porDepto.set(key, grp);
  }
  const deptos = [...porDepto.values()].sort((a, b) => b.total - a.total);
  deptos.forEach((d) => d.itens.sort((a, b) => b.km - a.km));
  const totalGeral = deptos.reduce((a, d) => a + d.total, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{comGap.length} veículo{comGap.length === 1 ? '' : 's'} com KM não apontado em {mesLabel} — total <b className="text-slate-700">{fmtKm(totalGeral)} km</b>. Use para cobrar o apontamento do hodômetro.</p>
      {deptos.map((d) => (
        <div key={d.nome} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-slate-700">{d.nome}</h3>
            <span className="text-xs text-slate-500">Total: <b className="text-amber-700">{fmtKm(d.total)} km</b> não apontados</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-4 py-2">Veículo</th><th className="px-4 py-2 text-right">KM não apontado</th><th className="px-4 py-2 text-center">Lacunas</th><th className="px-4 py-2 text-right">Maior lacuna</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {d.itens.map((v) => (
                <tr key={v.veiculoId} className="hover:bg-slate-50">
                  <td className="px-4 py-2"><span className="inline-flex items-center gap-2"><Car className="h-4 w-4 text-capul-600" /> <span className="font-medium text-slate-700">{v.placa}</span>{v.modelo ? <span className="text-slate-400"> · {v.modelo}</span> : null}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-700">{fmtKm(v.km)} km</td>
                  <td className="px-4 py-2 text-center tabular-nums text-slate-600">{v.nLacunas}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-600">{fmtKm(v.maior)} km</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function LinhaKmPage() {
  const { toast } = useToast();
  const agora = new Date();
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());
  const [veiculoId, setVeiculoId] = useState(''); // '' = todos
  const [departamentoId, setDepartamentoId] = useState(''); // '' = todos
  const [veiculos, setVeiculos] = useState<VeiculoOpt[]>([]);
  const [linhas, setLinhas] = useState<LinhaKm[]>([]);
  const [loading, setLoading] = useState(true);
  const [visao, setVisao] = useState<Visao>('linha');

  // Departamentos (únicos) da lista de veículos — alimentam o filtro.
  const departamentos = Array.from(
    new Map(veiculos.filter((v) => v.departamentoLotacaoId).map((v) => [v.departamentoLotacaoId!, v.departamentoNome || '—'])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  // Veículos do departamento selecionado (filtra o dropdown de veículo).
  const veiculosFiltrados = departamentoId ? veiculos.filter((v) => v.departamentoLotacaoId === departamentoId) : veiculos;

  const noMesAtual = ano === agora.getFullYear() && mes === agora.getMonth() + 1;
  const passoMes = (delta: number) => { const d = new Date(ano, mes - 1 + delta, 1); setMes(d.getMonth() + 1); setAno(d.getFullYear()); };

  useEffect(() => {
    logisticaApi.get<VeiculoOpt[]>('/veiculos').then((r) => setVeiculos(r.data)).catch(() => { /* lista é só conveniência */ });
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await logisticaApi.get<Resp>('/frota/hodometro', { params: { mes, ano, veiculoId: veiculoId || undefined, departamentoId: departamentoId || undefined } });
      setLinhas(data.veiculos);
    } catch {
      toast('error', 'Falha ao carregar a linha do KM.');
    } finally { setLoading(false); }
  }, [mes, ano, veiculoId, departamentoId, toast]);
  useEffect(() => { void carregar(); }, [carregar]);

  const umVeiculo = !!veiculoId;
  const comDados = linhas.filter((l) => l.segmentos.length > 0);
  const semDados = linhas.length - comDados.length;
  const exibidas = umVeiculo ? linhas : comDados; // num veículo específico, mostro mesmo vazio (com aviso)

  const imprimir = () => {
    const veicLabel = veiculoId ? (veiculos.find((v) => v.id === veiculoId)?.placa ?? '—') : 'Todos os veículos';
    abrirRelatorioLinhaKm(exibidas.filter((l) => l.segmentos.length > 0), `${MESES[mes - 1]} / ${ano}`, veicLabel, umVeiculo, noMesAtual);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Gauge className="h-6 w-6 text-capul-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Linha do KM</h2>
            <p className="text-sm text-slate-500">Prestação de contas do odômetro: KM em rotas × não apontadas, por veículo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {departamentos.length > 0 && (
            <select value={departamentoId}
              onChange={(e) => { setDepartamentoId(e.target.value); setVeiculoId(''); }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none">
              <option value="">Todos os departamentos</option>
              {departamentos.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          )}
          <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-capul-500 focus:outline-none">
            <option value="">{departamentoId ? 'Veículos do depto' : 'Todos os veículos'}</option>
            {veiculosFiltrados.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.modelo ? ` — ${v.modelo}` : ''}</option>)}
          </select>
          <button onClick={() => passoMes(-1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-slate-700">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => passoMes(1)} disabled={noMesAtual} className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => void carregar()} className="ml-1 inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw className="h-3.5 w-3.5" /> Atualizar</button>
          <button onClick={imprimir} disabled={comDados.length === 0} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40"><Printer className="h-3.5 w-3.5" /> Imprimir</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex"><span className="h-2.5 w-2 rounded-l bg-capul-500" /><span className="h-2.5 w-2 bg-indigo-500" /><span className="h-2.5 w-2 rounded-r bg-emerald-500" /></span>
          Rotas (cores alternam por rota)
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ backgroundImage: HACHURA }} /> Não apontadas (lacuna de odômetro)</span>
        {noMesAtual && <span className="text-slate-400">A faixa inclui a lacuna até o KM atual do veículo.</span>}
      </div>

      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
        <button onClick={() => setVisao('linha')} className={`rounded-md px-3 py-1.5 font-medium ${visao === 'linha' ? 'bg-capul-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Linha visual</button>
        <button onClick={() => setVisao('pendencias')} className={`rounded-md px-3 py-1.5 font-medium ${visao === 'pendencias' ? 'bg-capul-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Pendências de KM</button>
      </div>

      {visao === 'pendencias' ? (
        <PendenciasKm linhas={linhas} mesLabel={`${MESES[mes - 1]} / ${ano}`} loading={loading} />
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Carregando…</div>
      ) : exibidas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Sem rotas com KM apontado em {MESES[mes - 1]} / {ano}.
        </div>
      ) : (
        <div className="space-y-4">
          {exibidas.map((l) => (
            <div key={l.veiculoId} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Car className="h-4 w-4 text-capul-600" /> {l.placa}{l.modelo ? <span className="font-normal text-slate-400"> · {l.modelo}</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-capul-500" /> Rotas: <b>{fmtKm(l.kmViagens)} km</b></span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded" style={{ backgroundImage: HACHURA }} /> Não apontadas: <b>{fmtKm(l.kmNaoApontadas)} km</b></span>
                  <span className="text-slate-400">{l.qtdViagens} rota{l.qtdViagens === 1 ? '' : 's'}</span>
                </div>
              </div>
              <LinhaKmBarra linha={l} altura={umVeiculo ? 'h-9' : 'h-7'} />
              {umVeiculo && l.segmentos.length > 0 && (
                <table className="mt-4 w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="px-3 py-2">Trecho</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Condutor</th><th className="px-3 py-2 text-right">Faixa de KM</th><th className="px-3 py-2 text-right">KM</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(() => coresPorSegmento(l.segmentos))().map((cor, i) => { const s = l.segmentos[i]; return (
                      <tr key={i} className={s.tipo === 'gap' ? 'bg-slate-50/60' : 'hover:bg-slate-50'}>
                        <td className="px-3 py-2">{s.tipo === 'gap'
                          ? <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundImage: HACHURA }} /><span className="italic text-slate-400">{s.label}</span></span>
                          : <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded" style={{ backgroundColor: cor! }} /><span className="font-medium text-slate-700">Rota #{s.viagemNumero}</span></span>}</td>
                        <td className="px-3 py-2 text-slate-500">{s.tipo === 'gap' ? '—' : fmtDate(s.data)}</td>
                        <td className="px-3 py-2 text-slate-500">{s.tipo === 'gap' ? '—' : (s.condutor ?? '—')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtKm(s.kmInicio)} – {fmtKm(s.kmFim)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-800">{fmtKm(s.km)} km</td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {!umVeiculo && semDados > 0 && (
            <p className="text-xs text-slate-400">{semDados} veículo{semDados === 1 ? '' : 's'} sem rotas com KM apontado neste mês {semDados === 1 ? 'foi omitido' : 'foram omitidos'}.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Relatório da Linha do KM para impressão — abre nova janela com HTML inline
// (React 19 não aplica <style> dinâmico; o documento bruto evita o problema).
// Desenha a faixa de cada veículo (viagens × não apontadas) e, num veículo só,
// a tabela de trechos. Respeita o mês e o veículo selecionados.
function abrirRelatorioLinhaKm(linhas: LinhaKm[], periodo: string, veicLabel: string, umVeiculo: boolean, mesCorrente: boolean) {
  // Escapa também aspas: o `title="..."` da faixa interpola texto livre (finalidade da viagem)
  // dentro de atributo — sem escapar " o conteúdo poderia injetar atributos (defesa em profundidade).
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
  const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

  const blocos = linhas.map((l) => {
    const span = Math.max(l.kmMax - l.kmMin, 1);
    const cores = coresPorSegmento(l.segmentos);
    const segs = l.segmentos.map((s, i) => {
      const left = ((s.kmInicio - l.kmMin) / span) * 100;
      const width = Math.max((s.km / span) * 100, 0.5);
      const cor = cores[i] ? `background:${cores[i]};box-shadow:inset 0 0 0 1px rgba(255,255,255,.65)` : '';
      return `<div class="seg ${s.tipo}" style="left:${left}%;width:${width}%;${cor}" title="${esc(s.label)}"></div>`;
    }).join('');
    const tabela = umVeiculo ? `
      <table class="trechos">
        <thead><tr><th>Trecho</th><th>Data</th><th>Condutor</th><th class="r">Faixa de KM</th><th class="r">KM</th></tr></thead>
        <tbody>${l.segmentos.map((s, i) => `
          <tr class="${s.tipo}">
            <td>${s.tipo === 'gap' ? `<span class="dot gap"></span><i>${esc(s.label)}</i>` : `<span class="dot" style="background:${cores[i]}"></span>Rota #${esc(s.viagemNumero)}`}</td>
            <td>${s.tipo === 'gap' ? '—' : esc(dt(s.data))}</td>
            <td>${s.tipo === 'gap' ? '—' : esc(s.condutor ?? '—')}</td>
            <td class="r num">${esc(fmtKm(s.kmInicio))} – ${esc(fmtKm(s.kmFim))}</td>
            <td class="r num">${esc(fmtKm(s.km))} km</td>
          </tr>`).join('')}</tbody>
      </table>` : '';
    return `
      <div class="veic">
        <div class="vhead">
          <b>${esc(l.placa)}</b>${l.modelo ? ` · <span class="muted">${esc(l.modelo)}</span>` : ''}
          <span class="tot">Rotas: <b>${esc(fmtKm(l.kmViagens))} km</b> · Não apontadas: <b>${esc(fmtKm(l.kmNaoApontadas))} km</b> · ${esc(l.qtdViagens)} rota(s)</span>
        </div>
        <div class="bar">${segs}</div>
        <div class="kmlabels"><span>${esc(fmtKm(l.kmMin))} km</span><span>${esc(fmtKm(l.kmMax))} km</span></div>
        ${tabela}
      </div>`;
  }).join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Linha do KM — Frota</title>
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;color:#0f172a;margin:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:20px;font-weight:800;margin:0 0 2px}
  .sub{color:#475569;font-size:12px;margin:0 0 10px}
  .filtros{font-size:12px;color:#334155;margin:0 0 16px}
  .filtros span{display:inline-block;background:#f1f5f9;border-radius:6px;padding:2px 8px;margin-right:6px}
  .legenda{font-size:11px;color:#475569;margin:0 0 16px}
  .legenda i{font-style:normal;display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin-right:4px}
  .legenda .lv{background:#0ea5e9}
  .legenda .lg{background-image:repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1 4px,#e2e8f0 4px,#e2e8f0 8px)}
  .veic{margin:0 0 18px;page-break-inside:avoid}
  .vhead{font-size:13px;margin:0 0 6px}
  .vhead .muted{color:#64748b;font-weight:400}
  .vhead .tot{float:right;font-size:11px;color:#475569}
  .bar{position:relative;height:22px;background:#f1f5f9;border-radius:4px;overflow:hidden}
  .seg{position:absolute;top:2px;bottom:2px;border-radius:3px;background:#0ea5e9}
  .seg.gap{background-image:repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1 4px,#e2e8f0 4px,#e2e8f0 8px)}
  .kmlabels{display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:3px}
  table.trechos{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
  table.trechos th{background:#0f172a;color:#fff;text-align:left;padding:5px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.5px}
  table.trechos td{padding:4px 8px;border-bottom:1px solid #e2e8f0}
  .dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .dot.gap{background-image:repeating-linear-gradient(45deg,#cbd5e1,#cbd5e1 4px,#e2e8f0 4px,#e2e8f0 8px)}
  table.trechos tr.gap td{background:#f8fafc;color:#64748b}
  .r{text-align:right}.num{font-variant-numeric:tabular-nums}
  @media print{@page{size:A4 landscape;margin:10mm}}
</style></head><body>
  <h1>Linha do KM — Frota</h1>
  <p class="sub">CAPUL · Logística · gerado em ${esc(new Date().toLocaleString('pt-BR'))}</p>
  <div class="filtros"><span>Período: ${esc(periodo)}</span><span>Veículo: ${esc(veicLabel)}</span></div>
  <div class="legenda"><i class="lv"></i> Rotas (KM apontado) &nbsp;&nbsp; <i class="lg"></i> Não apontadas (lacuna de odômetro)${mesCorrente ? ' — inclui a lacuna até o KM atual' : ''}</div>
  ${blocos || '<p class="muted">Sem rotas com KM apontado no período.</p>'}
  <script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,width=1000,height=700');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
