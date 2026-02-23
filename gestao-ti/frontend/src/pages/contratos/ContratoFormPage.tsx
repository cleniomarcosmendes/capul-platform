import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { contratoService } from '../../services/contrato.service';
import { softwareService } from '../../services/software.service';
import { ArrowLeft } from 'lucide-react';
import type { Software, TipoContrato } from '../../types';

const tipoOptions: { value: TipoContrato; label: string }[] = [
  { value: 'LICENCIAMENTO', label: 'Licenciamento' },
  { value: 'MANUTENCAO', label: 'Manutencao' },
  { value: 'SUPORTE', label: 'Suporte' },
  { value: 'CONSULTORIA', label: 'Consultoria' },
  { value: 'DESENVOLVIMENTO', label: 'Desenvolvimento' },
  { value: 'CLOUD_SAAS', label: 'Cloud/SaaS' },
  { value: 'OUTSOURCING', label: 'Outsourcing' },
  { value: 'OUTRO', label: 'Outro' },
];

export function ContratoFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TipoContrato>('LICENCIAMENTO');
  const [fornecedor, setFornecedor] = useState('');
  const [cnpjFornecedor, setCnpjFornecedor] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataAssinatura, setDataAssinatura] = useState('');
  const [indiceReajuste, setIndiceReajuste] = useState('');
  const [percentualReajuste, setPercentualReajuste] = useState('');
  const [renovacaoAutomatica, setRenovacaoAutomatica] = useState(false);
  const [diasAlertaVencimento, setDiasAlertaVencimento] = useState('30');
  const [softwareId, setSoftwareId] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {});
    if (isEdit && id) {
      contratoService.buscar(id).then((c) => {
        setTitulo(c.titulo);
        setDescricao(c.descricao || '');
        setTipo(c.tipo);
        setFornecedor(c.fornecedor);
        setCnpjFornecedor(c.cnpjFornecedor || '');
        setValorTotal(String(c.valorTotal));
        setValorMensal(c.valorMensal ? String(c.valorMensal) : '');
        setDataInicio(c.dataInicio.slice(0, 10));
        setDataFim(c.dataFim.slice(0, 10));
        setDataAssinatura(c.dataAssinatura ? c.dataAssinatura.slice(0, 10) : '');
        setIndiceReajuste(c.indiceReajuste || '');
        setPercentualReajuste(c.percentualReajuste ? String(c.percentualReajuste) : '');
        setRenovacaoAutomatica(c.renovacaoAutomatica);
        setDiasAlertaVencimento(String(c.diasAlertaVencimento));
        setSoftwareId(c.softwareId || '');
        setObservacoes(c.observacoes || '');
      }).catch(() => setError('Erro ao carregar contrato'))
        .finally(() => setLoadingData(false));
    }
  }, [id, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      titulo,
      descricao: descricao || undefined,
      tipo,
      fornecedor,
      cnpjFornecedor: cnpjFornecedor || undefined,
      valorTotal: parseFloat(valorTotal),
      valorMensal: valorMensal ? parseFloat(valorMensal) : undefined,
      dataInicio,
      dataFim,
      dataAssinatura: dataAssinatura || undefined,
      indiceReajuste: indiceReajuste || undefined,
      percentualReajuste: percentualReajuste ? parseFloat(percentualReajuste) : undefined,
      renovacaoAutomatica,
      diasAlertaVencimento: parseInt(diasAlertaVencimento, 10),
      softwareId: softwareId || undefined,
      observacoes: observacoes || undefined,
    };

    try {
      if (isEdit && id) {
        await contratoService.atualizar(id, payload);
        navigate(`/gestao-ti/contratos/${id}`);
      } else {
        const contrato = await contratoService.criar(payload);
        navigate(`/gestao-ti/contratos/${contrato.id}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao salvar contrato');
    } finally {
      setSaving(false);
    }
  }

  if (loadingData) return <><Header title="Contrato" /><div className="p-6"><p className="text-slate-500">Carregando...</p></div></>;

  return (
    <>
      <Header title={isEdit ? 'Editar Contrato' : 'Novo Contrato'} />
      <div className="p-6 max-w-3xl">
        <button
          onClick={() => navigate(isEdit ? `/gestao-ti/contratos/${id}` : '/gestao-ti/contratos')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Titulo do contrato" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoContrato)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                {tipoOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} required maxLength={200}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nome do fornecedor" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ Fornecedor</label>
              <input value={cnpjFornecedor} onChange={(e) => setCnpjFornecedor(e.target.value)} maxLength={18}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Software (opcional)</label>
              <select value={softwareId} onChange={(e) => setSoftwareId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Nenhum</option>
                {softwares.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.fabricante ? ` (${s.fabricante})` : ''}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Total (R$) *</label>
              <input type="number" step="0.01" min="0" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Valor Mensal (R$)</label>
              <input type="number" step="0.01" min="0" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Assinatura</label>
              <input type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Inicio *</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Fim *</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Indice Reajuste</label>
              <input value={indiceReajuste} onChange={(e) => setIndiceReajuste(e.target.value)} maxLength={50}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Ex: IPCA, IGP-M" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">% Reajuste</label>
              <input type="number" step="0.01" min="0" value={percentualReajuste} onChange={(e) => setPercentualReajuste(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dias Alerta Vencimento</label>
              <input type="number" min="1" value={diasAlertaVencimento} onChange={(e) => setDiasAlertaVencimento(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="renovacaoAuto" checked={renovacaoAutomatica} onChange={(e) => setRenovacaoAutomatica(e.target.checked)}
              className="rounded border-slate-300" />
            <label htmlFor="renovacaoAuto" className="text-sm text-slate-700">Renovacao automatica</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Descricao do contrato..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50 transition-colors">
              {saving ? 'Salvando...' : isEdit ? 'Salvar Alteracoes' : 'Criar Contrato'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
