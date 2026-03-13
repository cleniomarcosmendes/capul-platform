import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { projetoService } from '../../services/projeto.service';
import { softwareService } from '../../services/software.service';
import { contratoService } from '../../services/contrato.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft } from 'lucide-react';
import type { Software, Contrato, UsuarioCore, TipoProjeto, Projeto } from '../../types';

const tipoOptions: { value: TipoProjeto; label: string }[] = [
  { value: 'DESENVOLVIMENTO_INTERNO', label: 'Desenvolvimento Interno' },
  { value: 'IMPLANTACAO_TERCEIRO', label: 'Implantacao Terceiro' },
  { value: 'INFRAESTRUTURA', label: 'Infraestrutura' },
  { value: 'OUTRO', label: 'Outro' },
];

export function ProjetoFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioCore[]>([]);
  const [projetosRaiz, setProjetosRaiz] = useState<Projeto[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoProjeto>('DESENVOLVIMENTO_INTERNO');
  const [projetoPaiId, setProjetoPaiId] = useState(searchParams.get('projetoPaiId') || '');
  const [softwareId, setSoftwareId] = useState('');
  const [contratoId, setContratoId] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFimPrevista, setDataFimPrevista] = useState('');
  const [custoPrevisto, setCustoPrevisto] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    contratoService.listar({ status: 'ATIVO' }).then(setContratos).catch(() => {});
    coreService.listarUsuarios().then(setUsuarios).catch(() => {});
    projetoService.listar({ apenasRaiz: true }).then(setProjetosRaiz).catch(() => {});

    if (isEdit && id) {
      projetoService.buscar(id).then((p) => {
        setNome(p.nome);
        setDescricao(p.descricao || '');
        setTipo(p.tipo);
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

    const payload = {
      nome,
      tipo,
      modo: 'COMPLETO' as const,
      projetoPaiId: projetoPaiId || undefined,
      softwareId: softwareId || undefined,
      contratoId: contratoId || undefined,
      responsavelId,
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
        await projetoService.criar(payload);
      }
      navigate('/gestao-ti/projetos');
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
      <Header title={isEdit ? 'Editar Projeto' : 'Novo Projeto'} />
      <div className="p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

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
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                required
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoProjeto)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                {tipoOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
              onClick={() => navigate(-1)}
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
