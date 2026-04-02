import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { conhecimentoService } from '../../services/conhecimento.service';
import { softwareService } from '../../services/software.service';
import { equipeService } from '../../services/equipe.service';
import { ArrowLeft } from 'lucide-react';
import type { ArtigoConhecimento, CategoriaArtigo, Software, EquipeTI } from '../../types';

const categoriaOptions: { value: CategoriaArtigo; label: string }[] = [
  { value: 'PROCEDIMENTO', label: 'Procedimento' },
  { value: 'SOLUCAO', label: 'Solucao' },
  { value: 'FAQ', label: 'FAQ' },
  { value: 'CONFIGURACAO', label: 'Configuracao' },
  { value: 'OUTRO', label: 'Outro' },
];

export function ConhecimentoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);

  const [form, setForm] = useState({
    titulo: '',
    conteudo: '',
    resumo: '',
    categoria: 'PROCEDIMENTO' as CategoriaArtigo,
    tags: '',
    softwareId: '',
    equipeTiId: '',
    publica: false,
  });

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    conhecimentoService.buscar(id).then((a: ArtigoConhecimento) => {
      setForm({
        titulo: a.titulo,
        conteudo: a.conteudo,
        resumo: a.resumo || '',
        categoria: a.categoria,
        tags: a.tags || '',
        softwareId: a.softwareId || '',
        equipeTiId: a.equipeTiId || '',
        publica: a.publica ?? false,
      });
    }).catch(() => navigate('/gestao-ti/conhecimento'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSaving(true);

    const payload: Record<string, unknown> = {
      titulo: form.titulo,
      conteudo: form.conteudo,
      resumo: form.resumo || undefined,
      categoria: form.categoria,
      tags: form.tags || undefined,
      softwareId: form.softwareId || undefined,
      equipeTiId: form.equipeTiId || undefined,
      publica: form.publica,
    };

    try {
      if (isEdit) {
        await conhecimentoService.atualizar(id, payload);
        setDirty(false);
        navigate(`/gestao-ti/conhecimento/${id}`);
      } else {
        const created = await conhecimentoService.criar(payload);
        setDirty(false);
        navigate(`/gestao-ti/conhecimento/${created.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(typeof msg === 'string' ? msg : 'Erro ao salvar artigo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><Header title={isEdit ? 'Editar Artigo' : 'Novo Artigo'} /><div className="p-6 text-center text-slate-500">Carregando...</div></>;

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Artigo' : 'Novo Artigo'} />
      <div className="p-6 max-w-4xl" onChange={() => setDirty(true)}>
        <button onClick={() => guardedNavigate(isEdit ? `/gestao-ti/conhecimento/${id}` : '/gestao-ti/conhecimento')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {erro && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{erro}</div>}

          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Titulo *</label>
              <input name="titulo" value={form.titulo} onChange={handleChange} required maxLength={300} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Resumo</label>
              <input name="resumo" value={form.resumo} onChange={handleChange} maxLength={500} placeholder="Breve descricao do artigo" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Categoria *</label>
                <select name="categoria" value={form.categoria} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {categoriaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Software</label>
                <select name="softwareId" value={form.softwareId} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Nenhum</option>
                  {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Equipe</label>
                <select name="equipeTiId" value={form.equipeTiId} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Nenhuma</option>
                  {equipes.map((e) => <option key={e.id} value={e.id}>{e.sigla} — {e.nome}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tags (separar por virgula)</label>
              <input name="tags" value={form.tags} onChange={handleChange} maxLength={500} placeholder="Ex: windows, rede, vpn" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.publica}
                  onChange={(e) => setForm({ ...form, publica: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
              <div>
                <span className="text-sm font-medium text-slate-700">Artigo Publico</span>
                <p className="text-xs text-slate-400">Artigos publicos ficam visiveis para todos os usuarios, incluindo usuarios finais</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Conteudo *</label>
              <textarea name="conteudo" value={form.conteudo} onChange={handleChange} required rows={16} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-amber-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Criar Artigo'}
            </button>
            <button type="button" onClick={() => guardedNavigate(isEdit ? `/gestao-ti/conhecimento/${id}` : '/gestao-ti/conhecimento')} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
