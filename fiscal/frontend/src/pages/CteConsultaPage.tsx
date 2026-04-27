import { useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, Info, X } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ErrorCard } from '../components/ErrorCard';
import { OrigemBadge } from '../components/OrigemBadge';
import { EventosTimeline } from '../components/EventosTimeline';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import { Row } from '../components/Row';
import { fmtChaveMascara, fmtNum } from '../utils/format';
import type { ProtheusStatus, TimelineEvento, ConsultaProtocoloStatus } from '../types';

interface FilialResumo {
  codigo: string;
  nomeFantasia: string;
  cnpj: string | null;
  isDefault?: boolean;
}

type Tab = 'gerais' | 'participantes' | 'valores' | 'historico';

interface CteParsedLite {
  dadosGerais: {
    chave: string;
    numero: string;
    serie: string;
    dataEmissao: string;
    naturezaOperacao: string;
    tipoCteDescricao: string;
    modalidadeDescricao: string;
    tipoServicoDescricao: string;
    ufInicio: string;
    ufFim: string;
    cfop: string;
  };
  emitente: { cnpj?: string | null; razaoSocial: string };
  remetente: { cnpj?: string | null; razaoSocial: string };
  destinatario: { cnpj?: string | null; razaoSocial: string };
  tomador: string;
  carga: { valorCarga: number; produtoPredominante: string };
  valores: { valorTotalPrestacao: number; valorReceber: number };
  protocoloAutorizacao?: { protocolo: string; motivo: string } | null;
}

interface CteResult {
  chave: string;
  filial: string;
  origem: 'PROTHEUS_CACHE' | 'PROTHEUS_CACHE_RACE' | 'SEFAZ_DOWNLOAD' | 'SEFAZ_STATUS_ONLY';
  documentoConsultaId: string;
  parsed: CteParsedLite | null;
  xml: string | null;
  xmlDisponivel: boolean;
  protheusStatus: ProtheusStatus;
  eventos: TimelineEvento[];
  consultaProtocoloStatus: ConsultaProtocoloStatus;
  avisoXmlIndisponivel?: string | null;
  alertaProtheus?: string;
}

export function CteConsultaPage() {
  const [chave, setChave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CteResult | null>(null);
  const [tab, setTab] = useState<Tab>('gerais');
  const { usuario } = useAuth();

  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [filialSelecionada, setFilialSelecionada] = useState<string>(
    usuario?.filialCodigo ?? '01',
  );

  useEffect(() => {
    fiscalApi
      .get<FilialResumo[]>('/filiais')
      .then((r) => {
        setFiliais(r.data);
        if (r.data.length > 0 && !r.data.some((f) => f.codigo === filialSelecionada)) {
          const defaultFilial = r.data.find((f) => f.isDefault) ?? r.data[0];
          setFilialSelecionada(defaultFilial.codigo);
        }
      })
      .catch(() => setFiliais([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setTab('gerais');
    if (!/^\d{44}$/.test(chave)) {
      setError('Chave deve ter 44 dígitos.');
      return;
    }
    try {
      setLoading(true);
      const { data } = await fiscalApi.post<CteResult>('/cte/consulta', {
        chave,
        filial: filialSelecionada,
      });
      setResult(data);
      // Se não tem XML, jogamos o usuário direto pro histórico (única coisa visível)
      if (!data.xmlDisponivel) setTab('historico');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao consultar CT-e.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadXml() {
    if (!result?.xmlDisponivel) return;
    const r = await fiscalApi.get(`/cte/${result.chave}/filial/${result.filial}/xml`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `CTe_${result.chave}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadDacte() {
    if (!result?.xmlDisponivel) return;
    const r = await fiscalApi.get(`/cte/${result.chave}/filial/${result.filial}/dacte`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `DACTE_${result.chave}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageWrapper title="Consulta CT-e">
      <form
        onSubmit={handleConsultar}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="mb-3 text-xs text-slate-500">
          Informe a chave de acesso do CT-e (44 dígitos — os separadores da máscara são aplicados
          automaticamente: <span className="font-mono">UF-AAMM-CNPJ-mod-série-nNF-tpEmis+cNF-DV</span>).
          O XML é lido do Protheus (SZR010) — se não estiver em cache, exibimos apenas o status e
          os eventos retornados pelo serviço CteConsultaProtocolo da SEFAZ.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-96">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Filial consulente
            </label>
            <select
              value={filialSelecionada}
              onChange={(e) => setFilialSelecionada(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
              title="Filial registrada em fiscal.documento_consulta para auditoria"
            >
              {filiais.length === 0 && (
                <option value={filialSelecionada}>{filialSelecionada}</option>
              )}
              {filiais.map((f) => (
                <option key={f.codigo} value={f.codigo}>
                  {f.codigo} — {f.nomeFantasia}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[30rem]">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Chave de acesso
            </label>
            <div className="relative">
              <input
                type="text"
                value={fmtChaveMascara(chave)}
                onChange={(e) => setChave(e.target.value.replace(/\D/g, '').slice(0, 44))}
                placeholder="52-2604-00000000000000-57-001-000000001-100000001-0"
                maxLength={51}
                title="UF-AAMM-CNPJ-mod-série-nNF-tpEmis+cNF-DV"
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-9 font-mono text-sm tracking-tight focus:border-slate-500 focus:ring-slate-500"
                required
              />
              {chave.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setChave('');
                    setResult(null);
                    setError(null);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Limpar chave e resultado"
                  tabIndex={-1}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div>
            <Button type="submit" loading={loading}>
              Consultar
            </Button>
          </div>
        </div>
      </form>

      {error && <ErrorCard error={error} context="cte" />}

      {result && (
        <div className="space-y-6">
          <OrigemBadge
            status={result.protheusStatus}
            tipoDocumento="cte"
            chave={result.chave}
            filial={result.filial}
            onReexecutar={(novo) => setResult({ ...result, protheusStatus: novo })}
          />

          {/* Banner quando XML não está disponível */}
          {!result.xmlDisponivel && result.avisoXmlIndisponivel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                <div className="flex-1 text-sm">
                  <p className="mb-1 font-semibold text-amber-900">
                    XML completo não disponível
                  </p>
                  <p className="text-xs text-amber-800">{result.avisoXmlIndisponivel}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cabeçalho */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {result.parsed ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge variant="gray">
                    CT-e nº {result.parsed.dadosGerais.numero} — Série{' '}
                    {result.parsed.dadosGerais.serie}
                  </Badge>
                  <Badge variant="purple">
                    {result.parsed.dadosGerais.modalidadeDescricao}
                  </Badge>
                </div>
                <div className="mb-4 font-mono text-xs text-slate-500">
                  {result.chave.replace(/(\d{4})(?=\d)/g, '$1 ')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Download className="h-4 w-4" />}
                    onClick={handleDownloadXml}
                  >
                    Baixar XML
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<FileText className="h-4 w-4" />}
                    onClick={handleDownloadDacte}
                  >
                    Baixar DACTE
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                <div>
                  <p className="font-medium text-slate-700">Chave consultada</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {result.chave.replace(/(\d{4})(?=\d)/g, '$1 ')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b border-slate-200">
              {(
                [
                  ['gerais', 'Dados gerais', result.xmlDisponivel],
                  ['participantes', 'Participantes', result.xmlDisponivel],
                  ['valores', 'Valores', result.xmlDisponivel],
                  [
                    'historico',
                    `Histórico (${result.eventos?.length ?? 0})`,
                    true,
                  ],
                ] as [Tab, string, boolean][]
              )
                .filter(([, , visible]) => visible)
                .map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      tab === k
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
            </div>
            <div className="p-5">
              {tab === 'gerais' && result.parsed && <DadosGerais parsed={result.parsed} />}
              {tab === 'participantes' && result.parsed && (
                <Participantes parsed={result.parsed} />
              )}
              {tab === 'valores' && result.parsed && <Valores parsed={result.parsed} />}
              {tab === 'historico' && (
                <EventosTimeline
                  eventos={result.eventos ?? []}
                  consultaProtocoloStatus={result.consultaProtocoloStatus}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function DadosGerais({ parsed }: { parsed: CteParsedLite }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
      <Row label="Natureza" value={parsed.dadosGerais.naturezaOperacao} wide />
      <Row label="Tipo" value={parsed.dadosGerais.tipoCteDescricao} />
      <Row label="Serviço" value={parsed.dadosGerais.tipoServicoDescricao} />
      <Row label="Origem" value={parsed.dadosGerais.ufInicio} />
      <Row label="Destino" value={parsed.dadosGerais.ufFim} />
      <Row label="CFOP" value={parsed.dadosGerais.cfop} />
      <Row
        label="Data emissão"
        value={new Date(parsed.dadosGerais.dataEmissao).toLocaleString('pt-BR')}
      />
    </dl>
  );
}

function Participantes({ parsed }: { parsed: CteParsedLite }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
      <Row label="Emitente (transportador)" value={parsed.emitente.razaoSocial} wide />
      <Row label="Remetente" value={parsed.remetente.razaoSocial} />
      <Row label="Destinatário" value={parsed.destinatario.razaoSocial} />
      <Row label="Tomador" value={parsed.tomador} />
    </dl>
  );
}

function Valores({ parsed }: { parsed: CteParsedLite }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
      <Row label="Produto predominante" value={parsed.carga.produtoPredominante} wide />
      <Row label="Valor da carga" value={fmtNum(parsed.carga.valorCarga)} />
      <Row
        label="Valor total da prestação"
        value={fmtNum(parsed.valores.valorTotalPrestacao)}
      />
      <Row label="Valor a receber" value={fmtNum(parsed.valores.valorReceber)} />
    </dl>
  );
}
