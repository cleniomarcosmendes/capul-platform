import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { catalogoService } from '../../services/catalogo.service';
import { softwareService } from '../../services/software.service';
import { projetoService } from '../../services/projeto.service';
import { paradaService } from '../../services/parada.service';
import { ordemServicoService } from '../../services/ordem-servico.service';
import { ativoService } from '../../services/ativo.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft, FolderKanban, Paperclip, X } from 'lucide-react';
import type { EquipeTI, CatalogoServico, Visibilidade, Prioridade, Software, SoftwareModulo, Projeto, Departamento, Ativo, TipoDepartamento } from '../../types';

export function ChamadoCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projetoIdParam = searchParams.get('projetoId');
  const paradaIdParam = searchParams.get('paradaId');
  const osIdParam = searchParams.get('osId');
  const { usuario, gestaoTiRole } = useAuth();
  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';
  const [projetoVinculado, setProjetoVinculado] = useState<Projeto | null>(null);

  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogoServico[]>([]);
  const [softwaresList, setSoftwaresList] = useState<Software[]>([]);
  const [modulosList, setModulosList] = useState<SoftwareModulo[]>([]);
  const [filiais, setFiliais] = useState<{ id: string; codigo: string; nomeFantasia: string }[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
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

  // Filial/Departamento para tecnicos
  const [filialId, setFilialId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');

  // Ativo vinculado
  const [ativosList, setAtivosList] = useState<Ativo[]>([]);
  const [ativoId, setAtivoId] = useState('');

  // IP da maquina
  const [ipMaquina, setIpMaquina] = useState('');


  // Anexos
  const [arquivos, setArquivos] = useState<File[]>([]);

  useEffect(() => {
    equipeService.listar('ATIVO').then((data) => {
      const filtered = isUsuarioFinal ? data.filter((e) => e.aceitaChamadoExterno) : data;
      setEquipes(filtered);
    }).catch(() => {});
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwaresList).catch(() => {});
    if (projetoIdParam) {
      projetoService.buscar(projetoIdParam).then(setProjetoVinculado).catch(() => {});
    }
    // Carregar filiais e ativos para tecnicos
    if (!isUsuarioFinal) {
      coreService.listarFiliais().then(setFiliais).catch(() => {});
      ativoService.listar({ status: 'ATIVO' }).then(setAtivosList).catch(() => {});
    }
  }, [isUsuarioFinal]);

  // Pre-preencher filial/depto do usuario logado
  useEffect(() => {
    if (!isUsuarioFinal && usuario) {
      setFilialId(usuario.filialAtual?.id || '');
      setDepartamentoId(usuario.departamento.id);
    }
  }, [isUsuarioFinal, usuario]);

  // Recarregar departamentos quando filial muda
  useEffect(() => {
    if (!isUsuarioFinal && filialId) {
      coreService.listarDepartamentos(filialId).then(setDepartamentos).catch(() => setDepartamentos([]));
    }
  }, [isUsuarioFinal, filialId]);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      const novos = Array.from(e.target.files);
      setArquivos((prev) => [...prev, ...novos]);
    }
    e.target.value = '';
  }

  function removeFile(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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
        filialId: (!isUsuarioFinal && filialId && filialId !== usuario?.filialAtual?.id) ? filialId : undefined,
        departamentoId: (!isUsuarioFinal && departamentoId && departamentoId !== usuario?.departamento.id) ? departamentoId : undefined,
        ipMaquina: ipMaquina || undefined,
        ativoId: ativoId || undefined,
      });

      // Upload dos anexos
      if (arquivos.length > 0) {
        await Promise.all(arquivos.map((file) => chamadoService.uploadAnexo(chamado.id, file)));
      }

      // Vincular a parada ou OS se veio do contexto
      if (paradaIdParam) {
        await paradaService.vincularChamado(paradaIdParam, chamado.id).catch(() => {});
      }
      if (osIdParam) {
        await ordemServicoService.vincularChamado(osIdParam, chamado.id).catch(() => {});
      }

      navigate(paradaIdParam ? `/gestao-ti/paradas/${paradaIdParam}` : osIdParam ? `/gestao-ti/ordens-servico` : `/gestao-ti/chamados/${chamado.id}`);
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Assunto *</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Resuma em poucas palavras sua solicitacao. Ex: Impressora nao imprime, Liberar acesso ao sistema..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Detalhe sua necessidade *</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Explique o que esta acontecendo, o que voce precisa e qual o impacto no seu trabalho..."
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
              {(() => {
                const equipeSel = equipes.find((e) => e.id === equipeAtualId);
                if (!equipeSel?.descricao) return null;
                return (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-1">{equipeSel.sigla} — {equipeSel.nome}</p>
                    <p className="text-xs text-blue-600 whitespace-pre-wrap">{equipeSel.descricao}</p>
                  </div>
                );
              })()}
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

          {/* Filial e Departamento — somente para tecnicos */}
          {!isUsuarioFinal && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <p className="text-xs text-slate-500">Altere caso esteja abrindo em nome de outro setor/filial</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Filial do solicitante</label>
                  <select
                    value={filialId}
                    onChange={(e) => {
                      setFilialId(e.target.value);
                      setDepartamentoId('');
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Selecione</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Departamento do solicitante</label>
                  <select
                    value={departamentoId}
                    onChange={(e) => setDepartamentoId(e.target.value)}
                    disabled={!filialId}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50"
                  >
                    <option value="">Selecione</option>
                    {(['ADMINISTRATIVO', 'COMERCIAL', 'OPERACIONAL', 'TECNOLOGIA'] as TipoDepartamento[]).map((tipo) => {
                      const deptosDoTipo = departamentos.filter((d) => d.tipo === tipo);
                      if (deptosDoTipo.length === 0) return null;
                      const labels: Record<TipoDepartamento, string> = {
                        ADMINISTRATIVO: 'Administrativo',
                        COMERCIAL: 'Comercial',
                        OPERACIONAL: 'Operacional',
                        TECNOLOGIA: 'Tecnologia',
                      };
                      return (
                        <optgroup key={tipo} label={labels[tipo]}>
                          {deptosDoTipo.map((d) => (
                            <option key={d.id} value={d.id}>{d.nome}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          )}

          {!isUsuarioFinal && ativosList.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ativo / Equipamento</label>
              <select
                value={ativoId}
                onChange={(e) => setAtivoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Nenhum</option>
                {ativosList.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.tag}] {a.nome} {a.tipo !== 'OUTRO' ? `(${a.tipo.replace(/_/g, ' ')})` : ''} {a.ip ? `- ${a.ip}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">Vincular o equipamento relacionado ao chamado</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IP da Maquina (acesso remoto)</label>
            <input
              value={ipMaquina}
              onChange={(e) => setIpMaquina(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Ex: 192.168.1.100"
            />
            <p className="text-xs text-slate-400 mt-1">Informe o IP da sua maquina para acesso remoto (ex: 192.168.1.100)</p>
          </div>

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

          {/* Anexos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Anexos (opcional)</label>
            <div
              className="border border-dashed border-slate-300 rounded-lg p-4 transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-capul-400', 'bg-capul-50'); }}
              onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-capul-400', 'bg-capul-50'); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-capul-400', 'bg-capul-50'); if (e.dataTransfer.files.length > 0) { const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileChange(fakeEvent); } }}
            >
              <label className="flex items-center gap-2 text-sm text-capul-600 hover:text-capul-700 cursor-pointer w-fit">
                <Paperclip className="w-4 h-4" />
                Selecionar ou arrastar arquivos
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
                />
              </label>
              <p className="text-xs text-slate-400 mt-1">Max 10MB por arquivo. Imagens, PDF, documentos, planilhas, ZIP. Arraste arquivos para ca.</p>
              {arquivos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {arquivos.map((file, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 text-sm">
                      <span className="text-slate-700 truncate">{file.name} <span className="text-slate-400">({formatFileSize(file.size)})</span></span>
                      <button type="button" onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
