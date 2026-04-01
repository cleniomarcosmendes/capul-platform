import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { equipeService } from '../../services/equipe.service';
import { Save, ArrowLeft } from 'lucide-react';

interface FormData {
  nome: string;
  sigla: string;
  descricao: string;
  cor: string;
  icone: string;
  aceitaChamadoExterno: boolean;
  emailEquipe: string;
  ordem: number;
}

const initialForm: FormData = {
  nome: '',
  sigla: '',
  descricao: '',
  cor: '#006838',
  icone: 'users',
  aceitaChamadoExterno: true,
  emailEquipe: '',
  ordem: 0,
};

export function EquipeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<FormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog } = useUnsavedChanges(dirty);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      equipeService
        .buscar(id)
        .then((equipe) => {
          setForm({
            nome: equipe.nome,
            sigla: equipe.sigla,
            descricao: equipe.descricao || '',
            cor: equipe.cor || '#006838',
            icone: equipe.icone || 'users',
            aceitaChamadoExterno: equipe.aceitaChamadoExterno,
            emailEquipe: equipe.emailEquipe || '',
            ordem: equipe.ordem,
          });
        })
        .catch(() => setError('Equipe nao encontrada'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        ...form,
        descricao: form.descricao || undefined,
        emailEquipe: form.emailEquipe || undefined,
      };

      if (isEdit) {
        await equipeService.atualizar(id, payload);
      } else {
        await equipeService.criar(payload);
      }
      setDirty(false);
      navigate('/gestao-ti/equipes');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(', ') : message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field: keyof FormData, value: string | boolean | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  if (loading) {
    return (
      <>
        <Header title={isEdit ? 'Editar Equipe' : 'Nova Equipe'} />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Equipe' : 'Nova Equipe'} />
      <div className="p-6 max-w-2xl" onChange={() => setDirty(true)}>
        <button
          onClick={() => navigate('/gestao-ti/equipes')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                placeholder="Ex: Suporte Software"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sigla *</label>
              <input
                type="text"
                value={form.sigla}
                onChange={(e) => handleChange('sigla', e.target.value.toUpperCase())}
                required
                maxLength={10}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600 uppercase"
                placeholder="Ex: SS"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <textarea
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
              placeholder="Descricao da equipe..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cor</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.cor}
                  onChange={(e) => handleChange('cor', e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={form.cor}
                  onChange={(e) => handleChange('cor', e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Icone</label>
              <input
                type="text"
                value={form.icone}
                onChange={(e) => handleChange('icone', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
                placeholder="users"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ordem</label>
              <input
                type="number"
                value={form.ordem}
                onChange={(e) => handleChange('ordem', parseInt(e.target.value) || 0)}
                min={0}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email da Equipe</label>
            <input
              type="email"
              value={form.emailEquipe}
              onChange={(e) => handleChange('emailEquipe', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600"
              placeholder="suporte@empresa.com"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="aceitaChamadoExterno"
              checked={form.aceitaChamadoExterno}
              onChange={(e) => handleChange('aceitaChamadoExterno', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
            />
            <label htmlFor="aceitaChamadoExterno" className="text-sm text-slate-700">
              Aceita chamados externos (usuarios finais podem selecionar esta equipe)
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/gestao-ti/equipes')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
