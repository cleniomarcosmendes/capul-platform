import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { equipeService } from '../../services/equipe.service';
import { coreService } from '../../services/core.service';
import type { Departamento } from '../../types';
import { Save, ArrowLeft } from 'lucide-react';

interface FormData {
  nome: string;
  sigla: string;
  descricao: string;
  cor: string;
  icone: string;
  privada: boolean;
  restritaVisibilidade: boolean;
  apoioSac: boolean;
  atendeSac: boolean;
  emailEquipe: string;
  ordem: number;
  /** Workspace Onda 2 C2.8 — depto-dono explícito no form (antes vinha
   *  implícito do cascade do criador). */
  departamentoId: string;
}

const initialForm: FormData = {
  nome: '',
  sigla: '',
  descricao: '',
  cor: '#006838',
  icone: 'users',
  privada: false,
  restritaVisibilidade: false,
  apoioSac: false,
  atendeSac: false,
  emailEquipe: '',
  ordem: 0,
  departamentoId: '',
};

export function EquipeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState<FormData>(initialForm);
  const [departamentosWorkspace, setDepartamentosWorkspace] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);

  // Workspace Onda 2 C2.8 — deptos-workspace com EQUIPE ativa.
  useEffect(() => {
    coreService.listarDepartamentos({ funcionalidade: 'EQUIPE' })
      .then(setDepartamentosWorkspace)
      .catch(() => setDepartamentosWorkspace([]));
  }, []);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      equipeService
        .buscarParaConfig(id)
        .then((equipe) => {
          setForm({
            nome: equipe.nome,
            sigla: equipe.sigla,
            descricao: equipe.descricao || '',
            cor: equipe.cor || '#006838',
            icone: equipe.icone || 'users',
            privada: equipe.privada,
            restritaVisibilidade: equipe.restritaVisibilidade ?? false,
            apoioSac: equipe.apoioSac ?? false,
            atendeSac: equipe.atendeSac ?? false,
            emailEquipe: equipe.emailEquipe || '',
            ordem: equipe.ordem,
            departamentoId: equipe.departamentoId ?? '',
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
        departamentoId: form.departamentoId || undefined,
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
      <div className="p-6 mx-auto max-w-3xl" onChange={() => setDirty(true)}>
        <button
          onClick={() => guardedNavigate('/gestao-ti/equipes')}
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

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-sm">
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

          {/* Workspace Onda 2 C2.8 — depto-dono (workspace que opera). */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Departamento (workspace) *</label>
            <select
              value={form.departamentoId}
              onChange={(e) => handleChange('departamentoId', e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-600"
            >
              <option value="">Selecione o departamento</option>
              {departamentosWorkspace.map((d) => (
                <option key={d.id} value={d.id}>{d.nome}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Workspace que vai gerenciar esta equipe. Só aparecem deptos com a funcionalidade Equipe ativa.
            </p>
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

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="privada"
              checked={form.privada}
              onChange={(e) => handleChange('privada', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
            />
            <label htmlFor="privada" className="text-sm text-slate-700">
              Equipe privada
              <span className="block text-xs text-slate-500">
                Quando marcada, só o staff (ADMIN/GESTOR/SUPORTE) do próprio
                departamento pode abrir chamado direto para esta equipe. Os
                demais (usuário final, chave, terceirizado e outros setores)
                não a veem na abertura — chegam via transferência. A
                transferência entre equipes não muda.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="restritaVisibilidade"
              checked={form.restritaVisibilidade}
              onChange={(e) => handleChange('restritaVisibilidade', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
            />
            <label htmlFor="restritaVisibilidade" className="text-sm text-slate-700">
              Visibilidade restrita à equipe
              <span className="block text-xs text-slate-500">
                Quando marcada, só os <b>membros</b> desta equipe visualizam os
                chamados dela na listagem — nem o SUPORTE do departamento (não
                membro) os vê. O <b>gestor do workspace</b> e o solicitante/
                técnico/colaborador do chamado seguem vendo normalmente.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="apoioSac"
              checked={form.apoioSac}
              onChange={(e) => handleChange('apoioSac', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
            />
            <label htmlFor="apoioSac" className="text-sm text-slate-700">
              Equipe de apoio ao SAC (catálogo de apoiadores)
              <span className="block text-xs text-slate-500">
                Quando marcada, os <b>membros</b> desta equipe ficam disponíveis
                para serem incluídos <b>em cópia</b> nos chamados do SAC (apoio de
                outros setores). Esta equipe é só catálogo — <b>não recebe
                chamados</b> (não pode ser destino de abertura/transferência).
              </span>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="atendeSac"
              checked={form.atendeSac}
              onChange={(e) => handleChange('atendeSac', e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-capul-600 focus:ring-capul-600"
            />
            <label htmlFor="atendeSac" className="text-sm text-slate-700">
              Equipe de atendimento ao SAC (recebe os chamados de SAC)
              <span className="block text-xs text-slate-500">
                Quando marcada, os <b>chamados abertos para esta equipe são tratados como SAC</b>
                (mostram os dados do cliente e o "responder ao cliente"). Use numa equipe
                dedicada — assim o mesmo workspace pode ter equipe de SAC e equipe de chamado normal.
              </span>
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
              onClick={() => guardedNavigate('/gestao-ti/equipes')}
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
