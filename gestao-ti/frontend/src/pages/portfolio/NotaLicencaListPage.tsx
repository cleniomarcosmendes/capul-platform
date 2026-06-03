import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { KeyRound, Plus, Search, FileText } from 'lucide-react';
import { licencaCompraService } from '../../services/licencaCompra.service';
import type { LicencaCompra } from '../../types';

function formatDateBR(d: string) { return new Date(d).toLocaleDateString('pt-BR'); }

export function NotaLicencaListPage() {
  const { gestaoTiRole } = useAuth();
  const isAdmin = ['ADMIN', 'GESTOR', 'SUPORTE'].includes(gestaoTiRole || '');

  const [notas, setNotas] = useState<LicencaCompra[]>([]);
  const [total, setTotal] = useState(0);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await licencaCompraService.listar({ busca: busca.trim() || undefined, pageSize: 100 });
      setNotas(r.items);
      setTotal(r.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, [busca]);

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
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, chave ou fornecedor..."
              className="border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white w-full" />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : notas.length === 0 ? (
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
                    <th className="px-4 py-3 font-medium text-slate-600">Número</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Fornecedor</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Lançamento</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Licenças</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Valor Total</th>
                    <th className="px-4 py-3 font-medium text-slate-600">Chave NF-e</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notas.map((n) => (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/gestao-ti/licencas/${n.id}`} className="text-capul-600 hover:underline font-medium">
                          {n.semNota ? <span className="text-slate-500">S/N</span> : n.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{n.fornecedor?.nome ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateBR(n.dataLancamento)}</td>
                      <td className="px-4 py-3 text-slate-600">{n._count?.itens ?? n.itens?.length ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600">
                        R$ {Number(n.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-500">
                        {n.chaveNfe ? `${n.chaveNfe.slice(0, 6)}…${n.chaveNfe.slice(-6)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">{total} nota(s)</div>
          </div>
        )}
      </div>
    </>
  );
}
