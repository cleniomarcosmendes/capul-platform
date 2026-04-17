import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { paradaService } from '../../services/parada.service';
import { softwareService } from '../../services/software.service';
import { coreApi } from '../../services/api';
import { ArrowLeft, Paperclip, Download, Trash2 } from 'lucide-react';
import { useToast } from '../../components/Toast';
import type { Software, SoftwareModulo, MotivoParada, TipoParada, ImpactoParada } from '../../types';

// Converte ISO UTC string para formato datetime-local (hora local do browser)
function toLocalDateTimeString(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const tipoOptions: { value: TipoParada; label: string }[] = [
  { value: 'PARADA_PROGRAMADA', label: 'Parada Programada' },
  { value: 'PARADA_NAO_PROGRAMADA', label: 'Parada Nao Programada' },
  { value: 'MANUTENCAO_PREVENTIVA', label: 'Manutencao Preventiva' },
];

const impactoOptions: { value: ImpactoParada; label: string }[] = [
  { value: 'TOTAL', label: 'Total' },
  { value: 'PARCIAL', label: 'Parcial' },
];

interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
}

export function ParadaFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [modulos, setModulos] = useState<SoftwareModulo[]>([]);
  const [motivos, setMotivos] = useState<MotivoParada[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);
  const { toast, confirm } = useToast();

  // Anexos (somente modo edicao)
  type AnexoParada = { id: string; nomeOriginal: string; mimeType: string; tamanho: number; createdAt: string; usuario: { id: string; nome: string } };
  const [anexos, setAnexos] = useState<AnexoParada[]>([]);
  const [uploadingAnexo, setUploadingAnexo] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TipoParada>('PARADA_NAO_PROGRAMADA');
  const [impacto, setImpacto] = useState<ImpactoParada>('TOTAL');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [softwareId, setSoftwareId] = useState('');
  const [softwareModuloId, setSoftwareModuloId] = useState('');
  const [filialIds, setFilialIds] = useState<string[]>([]);
  const [motivoParadaId, setMotivoParadaId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    paradaService.listarMotivos().then((data) => setMotivos(data.filter((m) => m.ativo))).catch(() => {});
    coreApi.get('/filiais').then(({ data }) => setFiliais(data)).catch(() => {});

    if (isEdit && id) {
      paradaService.buscar(id).then((p) => {
        setTitulo(p.titulo);
        setTipo(p.tipo);
        setImpacto(p.impacto);
        // Converter UTC -> hora local para datetime-local input
        setInicio(toLocalDateTimeString(p.inicio));
        setFim(p.fim ? toLocalDateTimeString(p.fim) : '');
        setSoftwareId(p.softwareId);
        setSoftwareModuloId(p.softwareModuloId || '');
        setMotivoParadaId(p.motivoParadaId || '');
        setFilialIds(p.filiaisAfetadas.map((f) => f.filialId));
        setDescricao(p.descricao || '');
        setObservacoes(p.observacoes || '');
      }).catch(() => setError('Erro ao carregar parada'))
        .finally(() => setLoadingData(false));
      paradaService.listarAnexos(id).then(setAnexos).catch(() => {});
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (softwareId) {
      softwareService.buscar(softwareId).then((sw) => {
        setModulos(sw.modulos || []);
      }).catch(() => setModulos([]));
    } else {
      setModulos([]);
      setSoftwareModuloId('');
    }
  }, [softwareId]);

  function toggleFilial(fId: string) {
    setFilialIds((prev) =>
      prev.includes(fId) ? prev.filter((x) => x !== fId) : [...prev, fId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !softwareId || !inicio || filialIds.length === 0) {
      setError('Preencha os campos obrigatorios');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        titulo,
        tipo,
        impacto,
        inicio: new Date(inicio).toISOString(),
        fim: fim ? new Date(fim).toISOString() : undefined,
        softwareId,
        softwareModuloId: softwareModuloId || undefined,
        motivoParadaId: motivoParadaId || undefined,
        filialIds,
        descricao: descricao || undefined,
        observacoes: observacoes || undefined,
      };

      if (isEdit && id) {
        await paradaService.atualizar(id, payload);
      } else {
        await paradaService.criar(payload);
      }
      setDirty(false);
      navigate('/gestao-ti/paradas');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao salvar parada');
    }
    setSaving(false);
  }

  if (loadingData) {
    return (
      <>
        <Header title={isEdit ? 'Editar Parada' : 'Nova Parada'} />
        <div className="p-6 text-slate-500">Carregando...</div>
      </>
    );
  }

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Parada' : 'Nova Parada'} />
      <div className="p-6 max-w-3xl" onChange={() => setDirty(true)}>
        <button
          onClick={() => guardedNavigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ex: Queda do sistema ERP"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoParada)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {tipoOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Impacto *</label>
              <select
                value={impacto}
                onChange={(e) => setImpacto(e.target.value as ImpactoParada)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {impactoOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Inicio *</label>
              <input
                type="datetime-local"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fim</label>
              <input
                type="datetime-local"
                value={fim}
                min={inicio || undefined}
                onChange={(e) => setFim(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              {!isEdit && (
                <p className="text-xs text-slate-400 mt-1">Se informado, a parada sera criada como finalizada</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Software *</label>
              <select
                value={softwareId}
                onChange={(e) => { setSoftwareId(e.target.value); setSoftwareModuloId(''); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione...</option>
                {softwares.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modulo</label>
              <select
                value={softwareModuloId}
                onChange={(e) => setSoftwareModuloId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                disabled={modulos.length === 0}
              >
                <option value="">Todos / Geral</option>
                {modulos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Parada</label>
            <select
              value={motivoParadaId}
              onChange={(e) => setMotivoParadaId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="">Selecione um motivo...</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">Filiais Afetadas *</label>
              {filiais.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilialIds(filialIds.length === filiais.length ? [] : filiais.map((f) => f.id))}
                  className="text-xs text-capul-600 hover:text-capul-700 font-medium"
                >
                  {filialIds.length === filiais.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              )}
            </div>
            <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
              {filiais.length === 0 ? (
                <p className="text-sm text-slate-400">Carregando filiais...</p>
              ) : (
                filiais.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filialIds.includes(f.id)}
                      onChange={() => toggleFilial(f.id)}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-700">
                      {f.codigo} - {f.nomeFantasia}
                    </span>
                  </label>
                ))
              )}
            </div>
            {filialIds.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">{filialIds.length} filial(is) selecionada(s)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Descreva o problema..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Anexos — somente modo edicao */}
          {isEdit && id && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Anexos</label>
              <div className="border border-dashed border-slate-300 rounded-lg p-4">
                <label className="flex items-center gap-2 text-sm text-capul-600 hover:text-capul-700 cursor-pointer w-fit">
                  <Paperclip className="w-4 h-4" />
                  {uploadingAnexo ? 'Enviando...' : 'Selecionar arquivo'}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingAnexo}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = '';
                      setUploadingAnexo(true);
                      try {
                        await paradaService.uploadAnexo(id, file);
                        const updated = await paradaService.listarAnexos(id);
                        setAnexos(updated);
                        toast('success', 'Anexo enviado');
                      } catch { toast('error', 'Erro ao enviar anexo'); }
                      setUploadingAnexo(false);
                    }}
                  />
                </label>
                <p className="text-xs text-slate-400 mt-1">Max 10MB. Imagens, PDF, documentos, planilhas, ZIP.</p>
                {anexos.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {anexos.map((a) => (
                      <div key={a.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-2 text-sm">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              const viewable = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
                              if (viewable.includes(a.mimeType)) {
                                paradaService.abrirAnexo(id, a.id, a.mimeType).catch(() => {
                                  paradaService.downloadAnexo(id, a.id, a.nomeOriginal);
                                });
                              } else {
                                paradaService.downloadAnexo(id, a.id, a.nomeOriginal);
                              }
                            }}
                            className="text-capul-700 hover:underline truncate text-left"
                          >
                            {a.nomeOriginal}
                          </button>
                          <p className="text-xs text-slate-400">{(a.tamanho / 1024).toFixed(0)} KB — {a.usuario.nome}</p>
                        </div>
                        <button type="button" onClick={() => paradaService.downloadAnexo(id, a.id, a.nomeOriginal)} className="p-1 text-slate-400 hover:text-capul-600" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!await confirm('Remover Anexo', `Remover "${a.nomeOriginal}"?`, { variant: 'danger' })) return;
                            try {
                              await paradaService.removerAnexo(id, a.id);
                              setAnexos((prev) => prev.filter((x) => x.id !== a.id));
                              toast('success', 'Anexo removido');
                            } catch { toast('error', 'Erro ao remover'); }
                          }}
                          className="p-1 text-slate-400 hover:text-red-500"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Registrar Parada'}
            </button>
            <button
              type="button"
              onClick={() => guardedNavigate(-1)}
              className="border border-slate-300 text-slate-600 px-6 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
