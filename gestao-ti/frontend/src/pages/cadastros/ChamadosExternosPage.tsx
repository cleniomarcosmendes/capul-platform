import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { Plus, Globe2, Pencil, Check, X, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { chamadoExternoService, type ChamadoExternoMensal } from '../../services/chamado-externo.service';
import { softwareService } from '../../services/software.service';
import type { Software } from '../../types';

const MESES = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type SortKey = 'ano' | 'mes' | 'software' | 'qtdChamados';
type SortDir = 'asc' | 'desc';

const now = new Date();
const ANO_ATUAL = now.getFullYear();
// Janela: ano atual + 2 a frente. Recalculado a cada carga da pagina via
// `new Date().getFullYear()` — quando virar 2027, a lista vira [2027,2028,2029]
// automaticamente. Nao incluir anos passados (nunca terao lancamento novo).
const ANOS = [ANO_ATUAL, ANO_ATUAL + 1, ANO_ATUAL + 2];

export function ChamadosExternosPage() {
  const { gestaoTiRole } = useAuth();
  const canManage = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR';
  const { toast, confirm } = useToast();

  const [registros, setRegistros] = useState<ChamadoExternoMensal[]>([]);
  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroAno, setFiltroAno] = useState<number | ''>('');
  const [filtroMes, setFiltroMes] = useState<number | ''>('');

  const [showForm, setShowForm] = useState(false);
  const [formMes, setFormMes] = useState<number>(now.getMonth() + 1);
  const [formAno, setFormAno] = useState<number>(ANO_ATUAL);
  const [formSoftwareId, setFormSoftwareId] = useState('');
  const [formQtd, setFormQtd] = useState<number | ''>('');
  const [formObs, setFormObs] = useState('');
  const [saving, setSaving] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState<number | ''>('');
  const [editObs, setEditObs] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey>('ano');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    void carregar();
    void carregarSoftwares();
  }, [filtroAno, filtroMes]);

  async function carregar() {
    setLoading(true);
    try {
      const lista = await chamadoExternoService.listar({
        ano: filtroAno || undefined,
        mes: filtroMes || undefined,
      });
      setRegistros(lista);
    } catch {
      toast('error', 'Erro ao carregar lançamentos');
    }
    setLoading(false);
  }

  async function carregarSoftwares() {
    if (softwares.length > 0) return;
    try {
      const lista = await softwareService.listar({ status: 'ATIVO' });
      setSoftwares(lista);
    } catch {
      /* nao bloqueia listagem */
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    return [...registros].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sortKey) {
        case 'ano': va = a.ano; vb = b.ano; break;
        case 'mes': va = a.ano * 100 + a.mes; vb = b.ano * 100 + b.mes; break;
        case 'software': va = a.software.nome.toLowerCase(); vb = b.software.nome.toLowerCase(); break;
        case 'qtdChamados': va = a.qtdChamados; vb = b.qtdChamados; break;
      }
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [registros, sortKey, sortDir]);

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!formSoftwareId) { toast('error', 'Selecione o Software/Fornecedor'); return; }
    if (formQtd === '' || formQtd < 0) { toast('error', 'Quantidade inválida'); return; }
    setSaving(true);
    try {
      await chamadoExternoService.criar({
        mes: formMes,
        ano: formAno,
        softwareId: formSoftwareId,
        qtdChamados: Number(formQtd),
        observacoes: formObs.trim() || undefined,
      });
      toast('success', 'Lançamento criado');
      setShowForm(false);
      setFormSoftwareId(''); setFormQtd(''); setFormObs('');
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar lançamento';
      toast('error', msg);
    }
    setSaving(false);
  }

  function startEdit(r: ChamadoExternoMensal) {
    setEditId(r.id);
    setEditQtd(r.qtdChamados);
    setEditObs(r.observacoes || '');
  }

  async function saveEdit() {
    if (!editId) return;
    if (editQtd === '' || editQtd < 0) { toast('error', 'Quantidade inválida'); return; }
    setEditSaving(true);
    try {
      await chamadoExternoService.atualizar(editId, {
        qtdChamados: Number(editQtd),
        observacoes: editObs.trim() || undefined,
      });
      toast('success', 'Lançamento atualizado');
      setEditId(null);
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao atualizar';
      toast('error', msg);
    }
    setEditSaving(false);
  }

  async function handleExcluir(r: ChamadoExternoMensal) {
    if (!await confirm('Excluir Lançamento', `Excluir lançamento de ${MESES[r.mes - 1]}/${r.ano} - ${r.software.nome}?`, { variant: 'danger' })) return;
    try {
      await chamadoExternoService.excluir(r.id);
      toast('success', 'Lançamento excluído');
      carregar();
    } catch {
      toast('error', 'Erro ao excluir');
    }
  }

  return (
    <>
      <Header title="Chamados a Fornecedores Externos" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-slate-500">
              Registro mensal de chamados que a CAPUL abriu junto a fornecedores externos (TOTVS, Zanthus, Linix, etc.).
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Alimenta o indicador "Chamados Externos" em <a href="/gestao-ti/indicadores" className="text-capul-600 hover:underline">Indicadores Estratégicos</a>.
            </p>
          </div>
          {canManage && (
            <button onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors">
              <Plus className="w-4 h-4" /> Novo Lançamento
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ano</label>
            <select value={filtroAno} onChange={(e) => setFiltroAno(e.target.value ? Number(e.target.value) : '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Mês</label>
            <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value ? Number(e.target.value) : '')}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Todos</option>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Form de novo lançamento */}
        {showForm && canManage && (
          <form onSubmit={handleCriar} className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h4 className="font-semibold text-slate-700 mb-4">Novo Lançamento</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mês *</label>
                <select value={formMes} onChange={(e) => setFormMes(Number(e.target.value))} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Ano *</label>
                <select value={formAno} onChange={(e) => setFormAno(Number(e.target.value))} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Software/Fornecedor *</label>
                <select value={formSoftwareId} onChange={(e) => setFormSoftwareId(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {softwares.map((sw) => (
                    <option key={sw.id} value={sw.id}>
                      {sw.nome}{sw.fabricante ? ` (${sw.fabricante})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Qtd. Chamados *</label>
                <input type="number" min={0} value={formQtd} onChange={(e) => setFormQtd(e.target.value === '' ? '' : Number(e.target.value))} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Observações</label>
              <input type="text" value={formObs} onChange={(e) => setFormObs(e.target.value)} maxLength={500}
                placeholder="Opcional"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
            </div>
          </form>
        )}

        {/* Tabela */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : registros.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Globe2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum lançamento registrado</p>
            {canManage && (
              <p className="text-xs text-slate-400 mt-2">Clique em <strong>Novo Lançamento</strong> para começar.</p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3"><button onClick={() => toggleSort('ano')} className="flex items-center gap-1 hover:text-slate-700">Ano <SortIcon col="ano" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('mes')} className="flex items-center gap-1 hover:text-slate-700">Mês <SortIcon col="mes" /></button></th>
                  <th className="px-6 py-3"><button onClick={() => toggleSort('software')} className="flex items-center gap-1 hover:text-slate-700">Software/Fornecedor <SortIcon col="software" /></button></th>
                  <th className="px-6 py-3 text-right"><button onClick={() => toggleSort('qtdChamados')} className="flex items-center gap-1 hover:text-slate-700 ml-auto">Qtd. <SortIcon col="qtdChamados" /></button></th>
                  <th className="px-6 py-3">Observações</th>
                  <th className="px-6 py-3">Registrado por</th>
                  {canManage && <th className="px-6 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-sm text-slate-700">{r.ano}</td>
                    <td className="px-6 py-3 text-sm text-slate-700">{MESES[r.mes - 1]}</td>
                    <td className="px-6 py-3 text-sm">
                      <p className="font-medium text-slate-700">{r.software.nome}</p>
                      {r.software.fabricante && <p className="text-xs text-slate-500">{r.software.fabricante}</p>}
                    </td>
                    {editId === r.id ? (
                      <>
                        <td className="px-6 py-3 text-right">
                          <input type="number" min={0} value={editQtd} onChange={(e) => setEditQtd(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-24 border border-slate-300 rounded px-2 py-1 text-sm text-right" />
                        </td>
                        <td className="px-6 py-3">
                          <input type="text" value={editObs} onChange={(e) => setEditObs(e.target.value)} maxLength={500}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-6 py-3 text-xs text-slate-500">{r.registradoPor?.nome || '-'}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={saveEdit} disabled={editSaving} className="text-green-600 hover:text-green-800" title="Salvar"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600" title="Cancelar"><X className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-3 text-right text-sm font-bold text-rose-600">{r.qtdChamados}</td>
                        <td className="px-6 py-3 text-xs text-slate-500 italic max-w-[300px] truncate" title={r.observacoes || ''}>{r.observacoes || '-'}</td>
                        <td className="px-6 py-3 text-xs text-slate-500">{r.registradoPor?.nome || '-'}</td>
                        {canManage && (
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <button onClick={() => startEdit(r)} className="flex items-center gap-1 text-xs text-capul-600 hover:underline"><Pencil className="w-3.5 h-3.5" /> Editar</button>
                              <button onClick={() => handleExcluir(r)} className="flex items-center gap-1 text-xs text-red-600 hover:underline"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
