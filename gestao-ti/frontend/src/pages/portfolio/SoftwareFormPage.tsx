import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { softwareService } from '../../services/software.service';
import { equipeService } from '../../services/equipe.service';
import { ArrowLeft } from 'lucide-react';
import type { EquipeTI, TipoSoftware, Criticidade, AmbienteSoftware } from '../../types';

export function SoftwareFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog } = useUnsavedChanges(dirty);

  const [nome, setNome] = useState('');
  const [fabricante, setFabricante] = useState('');
  const [tipo, setTipo] = useState<TipoSoftware | ''>('');
  const [criticidade, setCriticidade] = useState<Criticidade | ''>('');
  const [versaoAtual, setVersaoAtual] = useState('');
  const [ambiente, setAmbiente] = useState<AmbienteSoftware | ''>('');
  const [urlAcesso, setUrlAcesso] = useState('');
  const [equipeResponsavelId, setEquipeResponsavelId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      softwareService
        .buscar(id)
        .then((sw) => {
          setNome(sw.nome);
          setFabricante(sw.fabricante || '');
          setTipo((sw.tipo as TipoSoftware) || '');
          setCriticidade((sw.criticidade as Criticidade) || '');
          setVersaoAtual(sw.versaoAtual || '');
          setAmbiente((sw.ambiente as AmbienteSoftware) || '');
          setUrlAcesso(sw.urlAcesso || '');
          setEquipeResponsavelId(sw.equipeResponsavelId || '');
          setObservacoes(sw.observacoes || '');
        })
        .catch(() => setError('Erro ao carregar software'))
        .finally(() => setLoadingData(false));
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      nome,
      fabricante: fabricante || undefined,
      tipo: tipo || undefined,
      criticidade: criticidade || undefined,
      versaoAtual: versaoAtual || undefined,
      ambiente: ambiente || undefined,
      urlAcesso: urlAcesso || undefined,
      equipeResponsavelId: equipeResponsavelId || undefined,
      observacoes: observacoes || undefined,
    };

    try {
      if (isEdit) {
        await softwareService.atualizar(id, payload);
        setDirty(false);
        navigate(`/gestao-ti/softwares/${id}`);
      } else {
        const sw = await softwareService.criar(payload);
        setDirty(false);
        navigate(`/gestao-ti/softwares/${sw.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao salvar software');
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <>
        <Header title={isEdit ? 'Editar Software' : 'Novo Software'} />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Software' : 'Novo Software'} />
      <div className="p-6 max-w-3xl" onChange={() => setDirty(true)}>
        <button
          onClick={() => navigate(isEdit ? `/gestao-ti/softwares/${id}` : '/gestao-ti/softwares')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              maxLength={150}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Nome do software"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante</label>
              <input
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: Microsoft, Oracle..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Versao Atual</label>
              <input
                value={versaoAtual}
                onChange={(e) => setVersaoAtual(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Ex: 2024.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoSoftware | '')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione</option>
                <option value="ERP">ERP</option>
                <option value="CRM">CRM</option>
                <option value="SEGURANCA">Seguranca</option>
                <option value="COLABORACAO">Colaboracao</option>
                <option value="INFRAESTRUTURA">Infraestrutura</option>
                <option value="OPERACIONAL">Operacional</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Criticidade</label>
              <select
                value={criticidade}
                onChange={(e) => setCriticidade(e.target.value as Criticidade | '')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione</option>
                <option value="CRITICO">Critico</option>
                <option value="ALTO">Alto</option>
                <option value="MEDIO">Medio</option>
                <option value="BAIXO">Baixo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ambiente</label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as AmbienteSoftware | '')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione</option>
                <option value="ON_PREMISE">On-Premise</option>
                <option value="CLOUD">Cloud</option>
                <option value="HIBRIDO">Hibrido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Equipe Responsavel</label>
              <select
                value={equipeResponsavelId}
                onChange={(e) => setEquipeResponsavelId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhuma</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL de Acesso</label>
              <input
                value={urlAcesso}
                onChange={(e) => setUrlAcesso(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Informacoes adicionais..."
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Cadastrar Software'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
