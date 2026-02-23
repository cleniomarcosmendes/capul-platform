import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { catalogoService } from '../../services/catalogo.service';
import { softwareService } from '../../services/software.service';
import { projetoService } from '../../services/projeto.service';
import { ArrowLeft, FolderKanban } from 'lucide-react';
import type { EquipeTI, CatalogoServico, Visibilidade, Prioridade, Software, SoftwareModulo, Projeto } from '../../types';

export function ChamadoCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projetoIdParam = searchParams.get('projetoId');
  const { gestaoTiRole } = useAuth();
  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';
  const [projetoVinculado, setProjetoVinculado] = useState<Projeto | null>(null);

  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogoServico[]>([]);
  const [softwaresList, setSoftwaresList] = useState<Software[]>([]);
  const [modulosList, setModulosList] = useState<SoftwareModulo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [equipeAtualId, setEquipeAtualId] = useState('');
  const [visibilidade, setVisibilidade] = useState<Visibilidade>('PUBLICO');
  const [prioridade, setPrioridade] = useState<Prioridade>('MEDIA');
  const [softwareId, setSoftwareId] = useState('');
  const [softwareModuloId, setSoftwareModuloId] = useState('');
  const [softwareNome, setSoftwareNome] = useState('');
  const [moduloNome, setModuloNome] = useState('');
  const [catalogoServicoId, setCatalogoServicoId] = useState('');

  useEffect(() => {
    equipeService.listar('ATIVO').then((data) => {
      const filtered = isUsuarioFinal ? data.filter((e) => e.aceitaChamadoExterno) : data;
      setEquipes(filtered);
    }).catch(() => {});
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwaresList).catch(() => {});
    if (projetoIdParam) {
      projetoService.buscar(projetoIdParam).then(setProjetoVinculado).catch(() => {});
    }
  }, [isUsuarioFinal]);

  useEffect(() => {
    if (softwareId) {
      softwareService.listarModulos(softwareId).then((mods) => {
        setModulosList(mods.filter((m) => m.status === 'ATIVO'));
      }).catch(() => setModulosList([]));
      const sw = softwaresList.find((s) => s.id === softwareId);
      if (sw) setSoftwareNome(sw.nome);
    } else {
      setModulosList([]);
      setSoftwareNome('');
    }
    setSoftwareModuloId('');
    setModuloNome('');
  }, [softwareId]);

  useEffect(() => {
    if (equipeAtualId) {
      catalogoService.listar(equipeAtualId, 'ATIVO').then(setCatalogos).catch(() => setCatalogos([]));
    } else {
      setCatalogos([]);
    }
    setCatalogoServicoId('');
  }, [equipeAtualId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const chamado = await chamadoService.criar({
        titulo,
        descricao,
        equipeAtualId,
        visibilidade: isUsuarioFinal ? 'PUBLICO' : visibilidade,
        prioridade,
        softwareId: softwareId || undefined,
        softwareModuloId: softwareModuloId || undefined,
        softwareNome: softwareNome || undefined,
        moduloNome: moduloNome || undefined,
        catalogoServicoId: catalogoServicoId || undefined,
        projetoId: projetoIdParam || undefined,
      });
      navigate(`/gestao-ti/chamados/${chamado.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao criar chamado');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Novo Chamado" />
      <div className="p-6 max-w-3xl">
        <button
          onClick={() => navigate('/gestao-ti/chamados')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {projetoVinculado && (
          <div className="bg-capul-50 border border-capul-200 text-capul-700 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
            <FolderKanban className="w-4 h-4" />
            Vinculado ao Projeto #{projetoVinculado.numero} — {projetoVinculado.nome}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Descreva brevemente o problema"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Descreva o problema em detalhes..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Equipe Destino *</label>
              <select
                value={equipeAtualId}
                onChange={(e) => setEquipeAtualId(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione a equipe</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="CRITICA">Critica</option>
              </select>
            </div>
          </div>

          {!isUsuarioFinal && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Visibilidade</label>
              <select
                value={visibilidade}
                onChange={(e) => setVisibilidade(e.target.value as Visibilidade)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="PUBLICO">Publico (solicitante acompanha)</option>
                <option value="PRIVADO">Privado (somente equipe TI)</option>
              </select>
            </div>
          )}

          {catalogos.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Servico do Catalogo</label>
              <select
                value={catalogoServicoId}
                onChange={(e) => setCatalogoServicoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum (chamado generico)</option>
                {catalogos.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Software (opcional)</label>
              <select
                value={softwareId}
                onChange={(e) => setSoftwareId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum</option>
                {softwaresList.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}{s.fabricante ? ` (${s.fabricante})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modulo (opcional)</label>
              <select
                value={softwareModuloId}
                onChange={(e) => {
                  setSoftwareModuloId(e.target.value);
                  const mod = modulosList.find((m) => m.id === e.target.value);
                  setModuloNome(mod?.nome || '');
                }}
                disabled={!softwareId || modulosList.length === 0}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
              >
                <option value="">Nenhum</option>
                {modulosList.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Criando...' : 'Abrir Chamado'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
