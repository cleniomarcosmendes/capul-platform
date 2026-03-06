import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { contratoService } from '../../services/contrato.service';
import { softwareService } from '../../services/software.service';
import { coreService } from '../../services/core.service';
import { ArrowLeft } from 'lucide-react';
import type { Software, TipoContratoConfig } from '../../types';

export function ContratoFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [softwares, setSoftwares] = useState<Software[]>([]);
  const [filiais, setFiliais] = useState<{ id: string; codigo: string; nomeFantasia: string }[]>([]);
  const [tiposContrato, setTiposContrato] = useState<TipoContratoConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoContratoId, setTipoContratoId] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [codigoFornecedor, setCodigoFornecedor] = useState('');
  const [lojaFornecedor, setLojaFornecedor] = useState('');
  const [numeroContrato, setNumeroContrato] = useState('');
  const [filialId, setFilialId] = useState('');
  const [modalidadeValor, setModalidadeValor] = useState('FIXO');
  const [valorTotal, setValorTotal] = useState('');
  const [valorMensal, setValorMensal] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataAssinatura, setDataAssinatura] = useState('');
  const [renovacaoAutomatica, setRenovacaoAutomatica] = useState(false);
  const [diasAlertaVencimento, setDiasAlertaVencimento] = useState('30');
  const [softwareId, setSoftwareId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [gerarParcelas, setGerarParcelas] = useState(false);
  const [quantidadeParcelas, setQuantidadeParcelas] = useState('12');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');

  useEffect(() => {
    Promise.all([
      softwareService.listar({ status: 'ATIVO' }).then(setSoftwares).catch(() => {}),
      coreService.listarFiliais().then(setFiliais).catch(() => {}),
      contratoService.listarTiposContrato().then(setTiposContrato).catch(() => {}),
    ]);

    if (isEdit && id) {
      contratoService.buscar(id).then((c) => {
        setTitulo(c.titulo);
        setDescricao(c.descricao || '');
        setTipoContratoId(c.tipoContratoId || '');
        setFornecedor(c.fornecedor);
        setCodigoFornecedor(c.codigoFornecedor || '');
        setLojaFornecedor(c.lojaFornecedor || '');
        setNumeroContrato(c.numeroContrato || '');
        setFilialId(c.filialId || '');
        setModalidadeValor(c.modalidadeValor || 'FIXO');
        setValorTotal(String(c.valorTotal));
        setValorMensal(c.valorMensal ? String(c.valorMensal) : '');
        setDataInicio(c.dataInicio.slice(0, 10));
        setDataFim(c.dataFim.slice(0, 10));
        setDataAssinatura(c.dataAssinatura ? c.dataAssinatura.slice(0, 10) : '');
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
      tipoContratoId,
      fornecedor,
      filialId,
      modalidadeValor,
      codigoFornecedor: codigoFornecedor || undefined,
      lojaFornecedor: lojaFornecedor || undefined,
      numeroContrato: numeroContrato || undefined,
      valorTotal: parseFloat(valorTotal),
      valorMensal: valorMensal ? parseFloat(valorMensal) : undefined,
      dataInicio,
      dataFim,
      dataAssinatura: dataAssinatura || undefined,
      renovacaoAutomatica,
      diasAlertaVencimento: parseInt(diasAlertaVencimento, 10),
      softwareId: softwareId || undefined,
      observacoes: observacoes || undefined,
      gerarParcelas: !isEdit ? gerarParcelas : undefined,
      quantidadeParcelas: !isEdit && gerarParcelas ? parseInt(quantidadeParcelas, 10) : undefined,
      primeiroVencimento: !isEdit && gerarParcelas && primeiroVencimento ? primeiroVencimento : undefined,
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Contrato *</label>
              <select value={tipoContratoId} onChange={(e) => setTipoContratoId(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Selecione...</option>
                {tiposContrato.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Modalidade de Valor *</label>
              <select value={modalidadeValor} onChange={(e) => setModalidadeValor(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="FIXO">Fixo</option>
                <option value="VARIAVEL">Variavel (ex: locacao impressora)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filial *</label>
              <select value={filialId} onChange={(e) => setFilialId(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Selecione...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>)}
              </select>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor *</label>
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} required maxLength={200}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Nome do fornecedor" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Codigo Fornecedor</label>
              <input value={codigoFornecedor} onChange={(e) => setCodigoFornecedor(e.target.value)} maxLength={20}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="F00051" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loja</label>
              <input value={lojaFornecedor} onChange={(e) => setLojaFornecedor(e.target.value)} maxLength={10}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="0001" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Numero do Contrato</label>
              <input value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} maxLength={50}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="CTR-2026-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dias Alerta Vencimento</label>
              <input type="number" min="1" value={diasAlertaVencimento} onChange={(e) => setDiasAlertaVencimento(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
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

          <div className="flex items-center gap-2">
            <input type="checkbox" id="renovacaoAuto" checked={renovacaoAutomatica} onChange={(e) => setRenovacaoAutomatica(e.target.checked)}
              className="rounded border-slate-300" />
            <label htmlFor="renovacaoAuto" className="text-sm text-slate-700">Renovacao automatica</label>
          </div>

          {!isEdit && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input type="checkbox" id="gerarParcelas" checked={gerarParcelas} onChange={(e) => setGerarParcelas(e.target.checked)}
                  className="rounded border-slate-300" />
                <label htmlFor="gerarParcelas" className="text-sm font-medium text-slate-700">Gerar parcelas automaticamente</label>
              </div>
              {gerarParcelas && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Parcelas</label>
                    <input type="number" min="1" max="120" value={quantidadeParcelas} onChange={(e) => setQuantidadeParcelas(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primeiro Vencimento</label>
                    <input type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
              )}
            </div>
          )}

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
