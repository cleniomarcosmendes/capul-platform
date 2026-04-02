import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { ativoService } from '../../services/ativo.service';
import { coreService } from '../../services/core.service';
import { coreApi } from '../../services/api';
import { ArrowLeft } from 'lucide-react';
import type { Ativo, TipoAtivo, FilialResumo, Departamento, UsuarioCore } from '../../types';

interface AtivoResumo { id: string; tag: string; nome: string; tipo: TipoAtivo }

const tipoOptions: { value: TipoAtivo; label: string }[] = [
  { value: 'SERVIDOR', label: 'Servidor' },
  { value: 'ESTACAO_TRABALHO', label: 'Estacao de Trabalho' },
  { value: 'NOTEBOOK', label: 'Notebook' },
  { value: 'IMPRESSORA', label: 'Impressora' },
  { value: 'SWITCH', label: 'Switch' },
  { value: 'ROTEADOR', label: 'Roteador' },
  { value: 'STORAGE', label: 'Storage' },
  { value: 'OUTRO', label: 'Outro' },
];

export function AtivoFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [ativosPai, setAtivosPai] = useState<AtivoResumo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);

  const [form, setForm] = useState({
    tag: '',
    nome: '',
    descricao: '',
    tipo: 'ESTACAO_TRABALHO' as TipoAtivo,
    fabricante: '',
    modelo: '',
    numeroSerie: '',
    filialId: '',
    responsavelId: '',
    departamentoId: '',
    dataAquisicao: '',
    dataGarantia: '',
    processador: '',
    memoriaGB: '',
    discoGB: '',
    sistemaOperacional: '',
    ip: '',
    hostname: '',
    observacoes: '',
    glpiId: '',
    ativoPaiId: '',
  });

  useEffect(() => {
    coreApi.get('/filiais').then(({ data }) => setFiliais(data)).catch(() => {});
    coreService.listarUsuarios().then(setUsuarios).catch(() => {});
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
    ativoService.listar({}).then((list) => setAtivosPai(list.map((a: Ativo) => ({ id: a.id, tag: a.tag, nome: a.nome, tipo: a.tipo })))).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    ativoService.buscar(id).then((a: Ativo) => {
      setForm({
        tag: a.tag,
        nome: a.nome,
        descricao: a.descricao || '',
        tipo: a.tipo,
        fabricante: a.fabricante || '',
        modelo: a.modelo || '',
        numeroSerie: a.numeroSerie || '',
        filialId: a.filialId,
        responsavelId: a.responsavelId || '',
        departamentoId: a.departamentoId || '',
        dataAquisicao: a.dataAquisicao ? a.dataAquisicao.slice(0, 10) : '',
        dataGarantia: a.dataGarantia ? a.dataGarantia.slice(0, 10) : '',
        processador: a.processador || '',
        memoriaGB: a.memoriaGB?.toString() || '',
        discoGB: a.discoGB?.toString() || '',
        sistemaOperacional: a.sistemaOperacional || '',
        ip: a.ip || '',
        hostname: a.hostname || '',
        observacoes: a.observacoes || '',
        glpiId: a.glpiId || '',
        ativoPaiId: a.ativoPaiId || '',
      });
    }).catch(() => navigate('/gestao-ti/ativos'))
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
      tag: form.tag,
      nome: form.nome,
      descricao: form.descricao || undefined,
      tipo: form.tipo,
      fabricante: form.fabricante || undefined,
      modelo: form.modelo || undefined,
      numeroSerie: form.numeroSerie || undefined,
      filialId: form.filialId,
      responsavelId: form.responsavelId || undefined,
      departamentoId: form.departamentoId || undefined,
      dataAquisicao: form.dataAquisicao || undefined,
      dataGarantia: form.dataGarantia || undefined,
      processador: form.processador || undefined,
      memoriaGB: form.memoriaGB ? parseInt(form.memoriaGB) : undefined,
      discoGB: form.discoGB ? parseInt(form.discoGB) : undefined,
      sistemaOperacional: form.sistemaOperacional || undefined,
      ip: form.ip || undefined,
      hostname: form.hostname || undefined,
      observacoes: form.observacoes || undefined,
      glpiId: form.glpiId || undefined,
      ativoPaiId: form.ativoPaiId || undefined,
    };

    try {
      if (isEdit) {
        await ativoService.atualizar(id, payload);
        setDirty(false);
        navigate(`/gestao-ti/ativos/${id}`);
      } else {
        const created = await ativoService.criar(payload);
        setDirty(false);
        navigate(`/gestao-ti/ativos/${created.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErro(typeof msg === 'string' ? msg : 'Erro ao salvar ativo');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><Header title={isEdit ? 'Editar Ativo' : 'Novo Ativo'} /><div className="p-6 text-center text-slate-500">Carregando...</div></>;

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Ativo' : 'Novo Ativo'} />
      <div className="p-6 max-w-4xl" onChange={() => setDirty(true)}>
        <button onClick={() => guardedNavigate(isEdit ? `/gestao-ti/ativos/${id}` : '/gestao-ti/ativos')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          {erro && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{erro}</div>}

          {/* Identificacao */}
          <fieldset className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <legend className="text-sm font-semibold text-slate-700 px-2">Identificacao</legend>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tag *</label>
                <input name="tag" value={form.tag} onChange={handleChange} required maxLength={50} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                <input name="nome" value={form.nome} onChange={handleChange} required maxLength={200} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo *</label>
                <select name="tipo" value={form.tipo} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {tipoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fabricante</label>
                <input name="fabricante" value={form.fabricante} onChange={handleChange} maxLength={150} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                <input name="modelo" value={form.modelo} onChange={handleChange} maxLength={150} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">GLPI ID</label>
                <input name="glpiId" value={form.glpiId} onChange={handleChange} placeholder="ID no GLPI (opcional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ativo Pai (Estacao de Trabalho)</label>
                <select name="ativoPaiId" value={form.ativoPaiId} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Nenhum (ativo independente)</option>
                  {ativosPai.filter((a) => a.id !== id).map((a) => <option key={a.id} value={a.id}>[{a.tag}] {a.nome}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descricao</label>
              <textarea name="descricao" value={form.descricao} onChange={handleChange} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </fieldset>

          {/* Localizacao */}
          <fieldset className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <legend className="text-sm font-semibold text-slate-700 px-2">Localizacao e Responsavel</legend>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Filial *</label>
                <select name="filialId" value={form.filialId} onChange={handleChange} required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Selecione...</option>
                  {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nomeFantasia}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Responsavel</label>
                <select name="responsavelId" value={form.responsavelId} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Nenhum</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Departamento</label>
                <select name="departamentoId" value={form.departamentoId} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Nenhum</option>
                  {departamentos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">N. Serie</label>
                <input name="numeroSerie" value={form.numeroSerie} onChange={handleChange} maxLength={100} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data Aquisicao</label>
                <input name="dataAquisicao" type="date" value={form.dataAquisicao} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Data Garantia</label>
                <input name="dataGarantia" type="date" value={form.dataGarantia} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          </fieldset>

          {/* Info Tecnica */}
          <fieldset className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <legend className="text-sm font-semibold text-slate-700 px-2">Informacoes Tecnicas</legend>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Processador</label>
                <input name="processador" value={form.processador} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Memoria (GB)</label>
                <input name="memoriaGB" type="number" value={form.memoriaGB} onChange={handleChange} min={0} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Disco (GB)</label>
                <input name="discoGB" type="number" value={form.discoGB} onChange={handleChange} min={0} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sistema Operacional</label>
                <input name="sistemaOperacional" value={form.sistemaOperacional} onChange={handleChange} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">IP</label>
                <input name="ip" value={form.ip} onChange={handleChange} maxLength={45} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hostname</label>
                <input name="hostname" value={form.hostname} onChange={handleChange} maxLength={100} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Observacoes</label>
              <textarea name="observacoes" value={form.observacoes} onChange={handleChange} rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </fieldset>

          {/* Botoes */}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="bg-teal-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Criar Ativo'}
            </button>
            <button type="button" onClick={() => guardedNavigate(isEdit ? `/gestao-ti/ativos/${id}` : '/gestao-ti/ativos')} className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
