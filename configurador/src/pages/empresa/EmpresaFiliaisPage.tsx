import { useEffect, useState, type FormEvent } from 'react';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { empresaService } from '../../services/empresa.service';
import { filialService } from '../../services/filial.service';
import { Building2, Plus, Pencil, X, Save, Star } from 'lucide-react';
import type { Empresa, Filial } from '../../types';

export function EmpresaFiliaisPage() {
  const { configuradorRole } = useAuth();
  const canEdit = configuradorRole === 'ADMIN';

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);

  // Edicao empresa
  const [editEmpresa, setEditEmpresa] = useState(false);
  const [empresaForm, setEmpresaForm] = useState({
    razaoSocial: '', nomeFantasia: '', cnpjMatriz: '', endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '',
  });
  const [savingEmpresa, setSavingEmpresa] = useState(false);

  // Modal filial
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [editingFilialId, setEditingFilialId] = useState<string | null>(null);
  const [filialForm, setFilialForm] = useState({
    codigo: '', nomeFantasia: '', razaoSocial: '', cnpj: '', descricao: '', endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '',
  });
  const [savingFilial, setSavingFilial] = useState(false);
  const [erroFilial, setErroFilial] = useState('');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const empresas = await empresaService.listar();
      if (empresas.length > 0) {
        setEmpresa(empresas[0]);
        const filiaisData = await filialService.listar(empresas[0].id);
        setFiliais(filiaisData);
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }

  function iniciarEdicaoEmpresa() {
    if (!empresa) return;
    setEmpresaForm({
      razaoSocial: empresa.razaoSocial || '',
      nomeFantasia: empresa.nomeFantasia || '',
      cnpjMatriz: empresa.cnpjMatriz || '',
      endereco: empresa.endereco || '',
      cidade: empresa.cidade || '',
      estado: empresa.estado || '',
      cep: empresa.cep || '',
      telefone: empresa.telefone || '',
      email: empresa.email || '',
    });
    setEditEmpresa(true);
  }

  async function salvarEmpresa(e: FormEvent) {
    e.preventDefault();
    if (!empresa) return;
    setSavingEmpresa(true);
    try {
      const atualizada = await empresaService.atualizar(empresa.id, empresaForm);
      setEmpresa({ ...empresa, ...atualizada });
      setEditEmpresa(false);
    } catch {
      // silencioso
    } finally {
      setSavingEmpresa(false);
    }
  }

  function abrirNovaFilial() {
    setEditingFilialId(null);
    setFilialForm({ codigo: '', nomeFantasia: '', razaoSocial: '', cnpj: '', descricao: '', endereco: '', cidade: '', estado: '', cep: '', telefone: '', email: '' });
    setErroFilial('');
    setShowFilialModal(true);
  }

  function abrirEditarFilial(filial: Filial) {
    setEditingFilialId(filial.id);
    setFilialForm({
      codigo: filial.codigo || '',
      nomeFantasia: filial.nomeFantasia || '',
      razaoSocial: filial.razaoSocial || '',
      cnpj: filial.cnpj || '',
      descricao: filial.descricao || '',
      endereco: filial.endereco || '',
      cidade: filial.cidade || '',
      estado: filial.estado || '',
      cep: filial.cep || '',
      telefone: filial.telefone || '',
      email: filial.email || '',
    });
    setErroFilial('');
    setShowFilialModal(true);
  }

  async function salvarFilial(e: FormEvent) {
    e.preventDefault();
    if (!empresa) return;
    setSavingFilial(true);
    setErroFilial('');
    try {
      if (editingFilialId) {
        await filialService.atualizar(editingFilialId, filialForm);
      } else {
        await filialService.criar({ ...filialForm, empresaId: empresa.id });
      }
      setShowFilialModal(false);
      carregar();
    } catch (err: any) {
      setErroFilial(err?.response?.data?.message || 'Erro ao salvar filial');
    } finally {
      setSavingFilial(false);
    }
  }

  async function toggleFilialStatus(filial: Filial) {
    const novoStatus = filial.status === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    try {
      await filialService.atualizar(filial.id, { status: novoStatus } as Partial<Filial>);
      setFiliais((prev) => prev.map((f) => f.id === filial.id ? { ...f, status: novoStatus } : f));
    } catch {
      // silencioso
    }
  }

  const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent';

  return (
    <>
      <Header title="Empresa & Filiais" />
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : !empresa ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma empresa cadastrada</p>
          </div>
        ) : (
          <>
            {/* Empresa Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
              {editEmpresa ? (
                <form onSubmit={salvarEmpresa}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Editar Empresa</h3>
                    <button type="button" onClick={() => setEditEmpresa(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Razao Social *</label>
                      <input type="text" value={empresaForm.razaoSocial} onChange={(e) => setEmpresaForm({ ...empresaForm, razaoSocial: e.target.value })} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia *</label>
                      <input type="text" value={empresaForm.nomeFantasia} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeFantasia: e.target.value })} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ Matriz</label>
                      <input type="text" value={empresaForm.cnpjMatriz} onChange={(e) => setEmpresaForm({ ...empresaForm, cnpjMatriz: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                      <input type="text" value={empresaForm.telefone} onChange={(e) => setEmpresaForm({ ...empresaForm, telefone: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input type="email" value={empresaForm.email} onChange={(e) => setEmpresaForm({ ...empresaForm, email: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Endereco</label>
                      <input type="text" value={empresaForm.endereco} onChange={(e) => setEmpresaForm({ ...empresaForm, endereco: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                      <input type="text" value={empresaForm.cidade} onChange={(e) => setEmpresaForm({ ...empresaForm, cidade: e.target.value })} className={inputClass} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                        <input type="text" value={empresaForm.estado} onChange={(e) => setEmpresaForm({ ...empresaForm, estado: e.target.value })} className={inputClass} maxLength={2} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                        <input type="text" value={empresaForm.cep} onChange={(e) => setEmpresaForm({ ...empresaForm, cep: e.target.value })} className={inputClass} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={savingEmpresa} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                      <Save className="w-4 h-4" />
                      {savingEmpresa ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button type="button" onClick={() => setEditEmpresa(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">{empresa.nomeFantasia}</h3>
                    {canEdit && (
                      <button onClick={iniciarEdicaoEmpresa} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                        <Pencil className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    <div><span className="text-slate-500">Razao Social:</span> <span className="text-slate-700 font-medium ml-1">{empresa.razaoSocial}</span></div>
                    {empresa.cnpjMatriz && <div><span className="text-slate-500">CNPJ:</span> <span className="text-slate-700 font-medium ml-1">{empresa.cnpjMatriz}</span></div>}
                    {empresa.telefone && <div><span className="text-slate-500">Telefone:</span> <span className="text-slate-700 ml-1">{empresa.telefone}</span></div>}
                    {empresa.email && <div><span className="text-slate-500">Email:</span> <span className="text-slate-700 ml-1">{empresa.email}</span></div>}
                    {empresa.endereco && <div><span className="text-slate-500">Endereco:</span> <span className="text-slate-700 ml-1">{empresa.endereco}</span></div>}
                    {(empresa.cidade || empresa.estado) && (
                      <div><span className="text-slate-500">Cidade/UF:</span> <span className="text-slate-700 ml-1">{[empresa.cidade, empresa.estado].filter(Boolean).join(' / ')}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filiais */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Filiais ({filiais.length})</h3>
              {canEdit && (
                <button onClick={abrirNovaFilial} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Nova Filial
                </button>
              )}
            </div>

            {filiais.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhuma filial cadastrada</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Codigo</th>
                      <th className="px-6 py-3">Nome Fantasia</th>
                      <th className="px-6 py-3">CNPJ</th>
                      <th className="px-6 py-3">Cidade/UF</th>
                      <th className="px-6 py-3">Status</th>
                      {canEdit && <th className="px-6 py-3 text-right">Acoes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filiais.map((filial) => (
                      <tr key={filial.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                          <div className="flex items-center gap-2">
                            {filial.codigo}
                            {filial.codigo === '01' && <Star className="w-3.5 h-3.5 text-amber-500" />}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{filial.nomeFantasia}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{filial.cnpj || '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {[filial.cidade, filial.estado].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${filial.status === 'ATIVO' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {filial.status}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => abrirEditarFilial(filial)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-emerald-600 transition-all" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleFilialStatus(filial)}
                                className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${filial.status === 'ATIVO' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                              >
                                {filial.status === 'ATIVO' ? 'Inativar' : 'Ativar'}
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Filial */}
      {showFilialModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">
                {editingFilialId ? 'Editar Filial' : 'Nova Filial'}
              </h3>
              <button onClick={() => setShowFilialModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={salvarFilial}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
                  <input type="text" value={filialForm.codigo} onChange={(e) => setFilialForm({ ...filialForm, codigo: e.target.value })} required className={inputClass} placeholder="02" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia *</label>
                  <input type="text" value={filialForm.nomeFantasia} onChange={(e) => setFilialForm({ ...filialForm, nomeFantasia: e.target.value })} required className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Razao Social</label>
                  <input type="text" value={filialForm.razaoSocial} onChange={(e) => setFilialForm({ ...filialForm, razaoSocial: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                  <input type="text" value={filialForm.cnpj} onChange={(e) => setFilialForm({ ...filialForm, cnpj: e.target.value })} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereco</label>
                  <input type="text" value={filialForm.endereco} onChange={(e) => setFilialForm({ ...filialForm, endereco: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                  <input type="text" value={filialForm.cidade} onChange={(e) => setFilialForm({ ...filialForm, cidade: e.target.value })} className={inputClass} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">UF</label>
                    <input type="text" value={filialForm.estado} onChange={(e) => setFilialForm({ ...filialForm, estado: e.target.value })} className={inputClass} maxLength={2} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                    <input type="text" value={filialForm.cep} onChange={(e) => setFilialForm({ ...filialForm, cep: e.target.value })} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                  <input type="text" value={filialForm.telefone} onChange={(e) => setFilialForm({ ...filialForm, telefone: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={filialForm.email} onChange={(e) => setFilialForm({ ...filialForm, email: e.target.value })} className={inputClass} />
                </div>
              </div>
              {erroFilial && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 mb-4">{erroFilial}</div>}
              <div className="flex gap-3">
                <button type="submit" disabled={savingFilial} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  <Save className="w-4 h-4" />
                  {savingFilial ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => setShowFilialModal(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
