import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { projetoService } from '../../services/projeto.service';
import { chamadoService } from '../../services/chamado.service';
import { softwareService } from '../../services/software.service';
import { contratoService } from '../../services/contrato.service';
import { compraService } from '../../services/compra.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft } from 'lucide-react';
import type { Software, Contrato, UsuarioCore, Projeto, TipoProjetoConfig } from '../../types';

export function ProjetoFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { gestaoTiRole, usuario } = useAuth();
  const isExternoRole = gestaoTiRole === 'USUARIO_CHAVE' || gestaoTiRole === 'TERCEIRIZADO';

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [projetosRaiz, setProjetosRaiz] = useState<Projeto[]>([]);
  const [tiposProjeto, setTiposProjeto] = useState<TipoProjetoConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog, guardedNavigate } = useUnsavedChanges(dirty);

  const chamadoId = searchParams.get('chamadoId') || '';
  const chamadoNumero = searchParams.get('chamadoNumero') || '';
  const solicitanteId = searchParams.get('solicitanteId') || '';

  const [nome, setNome] = useState(searchParams.get('nome') || '');
  const [descricao, setDescricao] = useState(searchParams.get('descricao') || '');
  const [tipoProjetoId, setTipoProjetoId] = useState('');
  const [projetoPaiId, setProjetoPaiId] = useState(searchParams.get('projetoPaiId') || '');
  const [softwareId, setSoftwareId] = useState(searchParams.get('softwareId') || '');
  const [contratoId, setContratoId] = useState('');
  const [responsavelId, setResponsavelId] = useState(searchParams.get('responsavelId') || '');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFimPrevista, setDataFimPrevista] = useState('');
  const [custoPrevisto, setCustoPrevisto] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    contratoService.listar({ status: 'ATIVO' }).then(setContratos).catch(() => {});
    coreService.listarUsuarios().then(setUsuarios).catch(() => {});
    projetoService.listar({ apenasRaiz: true }).then(setProjetosRaiz).catch(() => {});
    compraService.listarTiposProjeto('ATIVO').then(setTiposProjeto).catch(() => {});

    if (isEdit && id) {
      projetoService.buscar(id).then((p) => {
        setNome(p.nome);
        setDescricao(p.descricao || '');
        setTipoProjetoId(p.tipoProjetoId || '');
        setProjetoPaiId(p.projetoPaiId || '');
        setSoftwareId(p.softwareId || '');
        setContratoId(p.contratoId || '');
        setResponsavelId(p.responsavelId);
        setDataInicio(p.dataInicio ? p.dataInicio.slice(0, 10) : '');
        setDataFimPrevista(p.dataFimPrevista ? p.dataFimPrevista.slice(0, 10) : '');
        setCustoPrevisto(p.custoPrevisto ? String(p.custoPrevisto) : '');
        setObservacoes(p.observacoes || '');
      }).catch(() => setError('Erro ao carregar projeto'))
        .finally(() => setLoadingData(false));
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    if (dataInicio && dataFimPrevista && dataFimPrevista < dataInicio) {
      setError('A Data Fim Prevista nao pode ser anterior a Data Inicio.');
      return;
    }

    const payload = {
      nome,
      tipo: (isExternoRole ? 'STAKEHOLDER' : 'OUTRO') as any,
      tipoProjetoId: tipoProjetoId || undefined,
      modo: 'COMPLETO' as const,
      projetoPaiId: projetoPaiId || undefined,
      softwareId: isExternoRole ? undefined : (softwareId || undefined),
      contratoId: isExternoRole ? undefined : (contratoId || undefined),
      responsavelId: isExternoRole ? (usuario?.id || '') : responsavelId,
      descricao: descricao || undefined,
      dataInicio: dataInicio || undefined,
      dataFimPrevista: dataFimPrevista || undefined,
      custoPrevisto: custoPrevisto ? Number(custoPrevisto) : undefined,
      observacoes: observacoes || undefined,
    };

    try {
      if (isEdit && id) {
        const { projetoPaiId: _pai, ...updatePayload } = payload;
        await projetoService.atualizar(id, updatePayload);
      } else {
        const novoProjeto = await projetoService.criar(payload);
        // Vincular chamado ao projeto se veio de um chamado
        if (chamadoId && novoProjeto?.id) {
          await chamadoService.vincularProjeto(chamadoId, novoProjeto.id).catch(() => {});
          // Se o solicitante do chamado existe, adiciona-lo como usuario-chave do projeto
          if (solicitanteId && solicitanteId !== responsavelId) {
            await projetoService.adicionarUsuarioChave(novoProjeto.id, {
              usuarioId: solicitanteId,
              funcao: 'Solicitante do chamado',
            }).catch(() => {});
          }
        }
      }
      // Se veio de um chamado, voltar para o chamado
      setDirty(false);
      if (chamadoId) {
        navigate(`/gestao-ti/chamados/${chamadoId}`);
      } else {
        navigate('/gestao-ti/projetos');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao salvar projeto');
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) {
    return (
      <>
        <Header title={isEdit ? 'Editar Projeto' : 'Novo Projeto'} />
        <div className="p-6"><p className="text-slate-500">Carregando...</p></div>
      </>
    );
  }

  return (
    <>
      {ConfirmDialog}
      <Header title={isEdit ? 'Editar Projeto' : 'Novo Projeto'} />
      <div className="p-6" onChange={() => setDirty(true)}>
        <button
          onClick={() => guardedNavigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {chamadoId && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 text-sm">
            Criando projeto a partir do chamado <strong>#{chamadoNumero}</strong>. O chamado sera vinculado automaticamente ao projeto.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Projeto</label>
              <select
                value={tipoProjetoId}
                onChange={(e) => setTipoProjetoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Selecione...</option>
                {tiposProjeto.map((t) => <option key={t.id} value={t.id}>{t.descricao}</option>)}
              </select>
            </div>

            {!isEdit && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projeto Pai</label>
                <select
                  value={projetoPaiId}
                  onChange={(e) => setProjetoPaiId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Nenhum (projeto raiz)</option>
                  {projetosRaiz.map((p) => (
                    <option key={p.id} value={p.id}>#{p.numero} - {p.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {!isExternoRole && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsavel *</label>
                <select
                  required
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">Selecione...</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            )}

            {isExternoRole && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsavel</label>
                <input
                  type="text"
                  value={usuario?.nome || ''}
                  disabled
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-100 text-slate-700"
                />
              </div>
            )}

            {!isExternoRole && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Software</label>
                  <select
                    value={softwareId}
                    onChange={(e) => setSoftwareId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Nenhum</option>
                    {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contrato</label>
                  <select
                    value={contratoId}
                    onChange={(e) => setContratoId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Nenhum</option>
                    {contratos.map((c) => <option key={c.id} value={c.id}>#{c.numero} - {c.titulo}</option>)}
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicio</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim Prevista</label>
              <input
                type="date"
                value={dataFimPrevista}
                min={dataInicio || undefined}
                onChange={(e) => setDataFimPrevista(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custo Previsto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={custoPrevisto}
                onChange={(e) => setCustoPrevisto(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar Projeto'}
            </button>
            <button
              type="button"
              onClick={() => guardedNavigate(-1)}
              className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg text-sm hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
