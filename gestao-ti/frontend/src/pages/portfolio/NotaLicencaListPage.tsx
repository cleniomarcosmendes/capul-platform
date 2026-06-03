import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound, Plus, Search, FileText } from 'lucide-react';
import { licencaCompraService } from '../../services/licencaCompra.service';
import type { LicencaCompra } from '../../types';

function formatDateBR(d: string) { return new Date(d).toLocaleDateString('pt-BR'); }

// Resumo dos itens (softwares/licenças) da nota — pro grid ser legível.
function resumoLicencas(n: LicencaCompra): string {
  const its = n.itens || [];
  if (its.length === 0) return '—';
  const primeiro = its[0].software?.nome || its[0].nome || 'Licença';
  return its.length > 1 ? `${primeiro} +${its.length - 1}` : primeiro;
}
function resumoDeptos(n: LicencaCompra): string {
  const nomes = Array.from(new Set((n.itens || []).map((i) => i.departamento?.nome).filter(Boolean))) as string[];
  if (nomes.length === 0) return '—';
  return nomes.length > 1 ? `${nomes[0]} +${nomes.length - 1}` : nomes[0];
}
function resumoUsuarios(n: LicencaCompra): string {
  const nomes = Array.from(new Set((n.itens || []).flatMap((i) => (i.funcionarios || []).map((f) => f.nome)).filter(Boolean))) as string[];
  if (nomes.length === 0) return '—';
  return nomes.length > 1 ? `${nomes[0]} +${nomes.length - 1}` : nomes[0];
}
function resumoSerial(n: LicencaCompra): string {
  const seriais = Array.from(new Set((n.itens || []).map((i) => i.chaveSerial).filter(Boolean))) as string[];
  if (seriais.length === 0) return '—';
  return seriais.length > 1 ? `${seriais[0]} +${seriais.length - 1}` : seriais[0];
}
function resumoVenc(n: LicencaCompra): string {
  const datas = (n.itens || []).map((i) => i.dataVencimento).filter(Boolean) as string[];
  if (datas.length === 0) return '—';
  return formatDateBR(datas.reduce((a, b) => (a < b ? a : b)));
}
// Valor de ordenação por coluna ('' = vazio, vai pro fim).
function sortValue(n: LicencaCompra, col: string): string | number {
  const norm = (v: string) => (v === '—' ? '' : v.toLowerCase());
  switch (col) {
    case 'licenca': return norm(resumoLicencas(n));
    case 'usuario': return norm(resumoUsuarios(n));
    case 'depto': return norm(resumoDeptos(n));
    case 'serial': return norm(resumoSerial(n));
    case 'numero': return (n.semNota ? 's/n' : (n.numero || '').toLowerCase());
    case 'fornecedor': return (n.fornecedor?.nome || '').toLowerCase();
    case 'valor': return Number(n.valorTotal);
    case 'vencimento': {
      const ds = (n.itens || []).map((i) => i.dataVencimento).filter(Boolean) as string[];
      return ds.length ? ds.reduce((a, b) => (a < b ? a : b)) : '';
    }
    default: return '';
  }
}
// Busca ampla (client-side): número, chave, fornecedor, software/licença, usuário,
// matrícula, depto alocado, serial e vencimento (data formatada).
function matchBusca(n: LicencaCompra, termo: string): boolean {
  const campos: string[] = [n.numero, n.chaveNfe || '', n.fornecedor?.nome || ''];
  for (const i of n.itens || []) {
    campos.push(i.nome || '', i.software?.nome || '', i.departamento?.nome || '', i.chaveSerial || '');
    if (i.dataVencimento) campos.push(formatDateBR(i.dataVencimento));
    for (const f of i.funcionarios || []) campos.push(f.nome || '', f.matricula || '');
  }
  return campos.some((c) => c.toLowerCase().includes(termo));
}

export function NotaLicencaListPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = ['ADMIN', 'GESTOR', 'SUPORTE'].includes(gestaoTiRole || '');

  const [notas, setNotas] = useState<LicencaCompra[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  function toggleSort(col: string) {
    if (sortBy !== col) { setSortBy(col); setSortOrder('asc'); return; }
    if (sortOrder === 'asc') { setSortOrder('desc'); return; }
    setSortBy(null); setSortOrder('asc');
  }
  const thSort = (label: string, col: string) => (
    <th className="px-4 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-slate-900" onClick={() => toggleSort(col)} title="Clique para ordenar">
      {label}<span className="ml-1 text-xs text-slate-400">{sortBy === col ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  );
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const arr = termo ? notas.filter((n) => matchBusca(n, termo)) : notas.slice();
    if (sortBy) {
      arr.sort((a, b) => {
        const av = sortValue(a, sortBy), bv = sortValue(b, sortBy);
        const aE = av === '', bE = bv === '';
        if (aE && bE) return 0;
        if (aE) return 1;
        if (bE) return -1;
        const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
    return arr;
  }, [notas, busca, sortBy, sortOrder]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await licencaCompraService.listar({ pageSize: 100 });
      setNotas(r.items);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header title="Licenças" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <KeyRound className="w-6 h-6 text-capul-500" />
            <h3 className="text-lg font-semibold text-slate-800">Notas de Licenças</h3>
          </div>
          {isAdmin && (
            <Link to="/gestao-ti/licencas/nova" className="flex items-center gap-2 bg-capul-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-capul-700">
              <Plus className="w-4 h-4" /> Nova Nota
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar: software/licença, usuário, depto, vencimento, serial, número, chave, fornecedor..."
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full" />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : visiveis.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma nota de licença encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    {thSort('Software / Licença', 'licenca')}
                    {thSort('Usuário', 'usuario')}
                    {thSort('Depto Alocado', 'depto')}
                    {thSort('Vencimento', 'vencimento')}
                    {thSort('Chave Serial', 'serial')}
                    {thSort('Número NF', 'numero')}
                    {thSort('Fornecedor', 'fornecedor')}
                    {thSort('Valor Total', 'valor')}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiveis.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/licencas/${n.id}`} className="text-capul-600 hover:underline font-medium">
                          {resumoLicencas(n)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{resumoUsuarios(n)}</td>
                      <td className="px-4 py-3 text-slate-600">{resumoDeptos(n)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{resumoVenc(n)}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">{resumoSerial(n)}</td>
                      <td className="px-4 py-3 text-slate-600">{n.semNota ? <span className="text-slate-400">S/N</span> : n.numero}</td>
                      <td className="px-4 py-3 text-slate-600">{n.fornecedor?.nome ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        R$ {Number(n.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">{visiveis.length} nota(s)</div>
          </div>
        )}
      </div>
    </>
  );
}
