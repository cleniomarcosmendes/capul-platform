import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Download,
  FileText,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';
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
import {
  fmtChave,
  fmtChaveMascara,
  fmtCnpj,
  fmtCep,
  fmtDataHora,
  fmtData,
  fmtNum,
  fmtTelefone,
} from '../utils/format';
import type {
  CteConsultaResult,
  CteParsed,
  CteParticipante,
  CteModal,
  CteModalRodoviario,
  CteModalAereo,
  CteModalAquaviario,
  CteModalFerroviario,
  CteModalDutoviario,
  CteModalMultimodal,
  CteSeguro,
  CteIcms,
  CteIcmsUFFim,
  CteIssqn,
  CteInfTribFed,
} from '../types';

interface FilialResumo {
  codigo: string;
  nomeFantasia: string;
  cnpj: string | null;
  isDefault?: boolean;
}

type Tab =
  | 'cte'
  | 'emitente'
  | 'remetente'
  | 'expedidor'
  | 'recebedor'
  | 'destinatario'
  | 'tomador'
  | 'locais'
  | 'prestacao'
  | 'tributos'
  | 'carga'
  | 'docs'
  | 'modal'
  | 'docAnt'
  | 'seguro'
  | 'infoAd'
  | 'historico';

const ROLE_OPCAO_TIPO_PROPRIETARIO: Record<string, string> = {
  '0': 'TAC Agregado',
  '1': 'TAC Independente',
  '2': 'Outros',
};

const TIPO_RODADO_MAP: Record<string, string> = {
  '01': 'Truck',
  '02': 'Toco',
  '03': 'Cavalo Mecânico',
  '04': 'VAN',
  '05': 'Utilitário',
  '06': 'Outros',
};

const TIPO_CARROCERIA_MAP: Record<string, string> = {
  '00': 'Não aplicável',
  '01': 'Aberta',
  '02': 'Fechada / Baú',
  '03': 'Granelera',
  '04': 'Porta Container',
  '05': 'Sider',
};

const TIPO_NAVEGACAO_MAP: Record<string, string> = {
  '0': 'Interior',
  '1': 'Cabotagem',
};

const TIPO_TRAFEGO_MAP: Record<string, string> = {
  '0': 'Próprio',
  '1': 'Mútuo',
  '2': 'Rodoferroviário',
  '3': 'Rodoviário',
};

const RESPONSAVEL_FATURAMENTO_MAP: Record<string, string> = {
  '1': 'Ferrovia de Origem',
  '2': 'Ferrovia de Destino',
};

const TIPO_DOC_OUTROS_MAP: Record<string, string> = {
  '00': 'Declaração',
  '10': 'Dutoviário',
  '11': 'Conhecimento Aéreo Internacional',
  '12': 'Declaração de Trânsito Aduaneiro',
  '13': 'Manifesto Internacional / Declaração de Trânsito',
  '14': 'Carnê de Passagens em Alfândega',
  '15': 'Despacho Aduaneiro',
  '16': 'AWB - Air Waybill',
  '17': 'BL - Bill of Lading',
  '18': 'Outros',
};

const SITUACAO_TRIBUTARIA_ISSQN_MAP: Record<string, string> = {
  '00': 'Normal',
  '01': 'Retida',
  '02': 'Substituto Tributário',
  '03': 'Isenta',
};

const INDICADOR_ISS_MAP: Record<string, string> = {
  '1': 'Exigível',
  '2': 'Não incidência',
  '3': 'Isenção',
  '4': 'Exportação',
  '5': 'Imunidade',
  '6': 'Suspensa Decisão Judicial',
  '7': 'Suspensa Procedimento Administrativo',
};

const TIPO_VALE_PEDAGIO_MAP: Record<string, string> = {
  '01': 'TAG',
  '02': 'Cupom',
  '03': 'Cartão',
};

const TIPO_UNIDADE_TRANSPORTE_MAP: Record<string, string> = {
  '1': 'Rodoviário Tração',
  '2': 'Rodoviário Reboque',
  '3': 'Navio',
  '4': 'Balsa',
  '5': 'Aeronave',
  '6': 'Vagão',
  '7': 'Outros',
};

const TIPO_UNIDADE_CARGA_MAP: Record<string, string> = {
  '1': 'Container',
  '2': 'ULD - Unit Load Device',
  '3': 'Pallet',
  '4': 'Outros',
};

export function CteConsultaPage() {
  const [chave, setChave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CteConsultaResult | null>(null);
  const [tab, setTab] = useState<Tab>('cte');
  const { usuario } = useAuth();

  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [filialSelecionada, setFilialSelecionada] = useState<string>(
    usuario?.filialCodigo ?? '01',
  );

  // Deep-link via query params: /fiscal/cte/consulta-por-chave?chave=XXX&filial=YY
  // Quando o operador clica numa chave em /fiscal/cte (lista de Recebidos),
  // a tela abre ja com chave + filial preenchidas e dispara consulta automatica.
  const [searchParams] = useSearchParams();
  const autoConsultadoRef = useRef(false);

  useEffect(() => {
    fiscalApi
      .get<FilialResumo[]>('/filiais')
      .then((r) => {
        setFiliais(r.data);
        const chaveParam = searchParams.get('chave');
        const filialParam = searchParams.get('filial');
        if (chaveParam && /^\d{44}$/.test(chaveParam)) {
          setChave(chaveParam);
        }
        if (filialParam && r.data.some((f) => f.codigo === filialParam)) {
          setFilialSelecionada(filialParam);
        } else if (r.data.length > 0 && !r.data.some((f) => f.codigo === filialSelecionada)) {
          const defaultFilial = r.data.find((f) => f.isDefault) ?? r.data[0];
          setFilialSelecionada(defaultFilial.codigo);
        }
      })
      .catch(() => setFiliais([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-consulta quando chave veio via query param e filiais ja carregaram.
  // Ref evita disparar 2x.
  useEffect(() => {
    const chaveParam = searchParams.get('chave');
    if (
      !autoConsultadoRef.current &&
      chaveParam &&
      /^\d{44}$/.test(chaveParam) &&
      chave === chaveParam &&
      filiais.length > 0
    ) {
      autoConsultadoRef.current = true;
      void handleConsultar(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, filiais]);

  async function handleConsultar(e: React.FormEvent | null) {
    if (e) e.preventDefault();
    setError(null);
    setResult(null);
    setTab('cte');
    if (!/^\d{44}$/.test(chave)) {
      setError('Chave deve ter 44 dígitos.');
      return;
    }
    try {
      setLoading(true);
      const { data } = await fiscalApi.post<CteConsultaResult>('/cte/consulta', {
        chave,
        filial: filialSelecionada,
      });
      setResult(data);
      // Se não tem XML, joga direto pro histórico (única coisa visível)
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

  // Lista de abas — ordem espelha o portal SEFAZ (Tomador 3º, logo após
  // Emitente) pra facilitar quem está acostumado à consulta oficial.
  // Mantemos abas extras que o portal não tem (Locais, Doc. Anteriores,
  // Seguro, Histórico) ao final, agrupadas. Algumas só aparecem quando o
  // XML contém o bloco correspondente, pra não poluir.
  const tabs: Array<[Tab, string, boolean]> = result
    ? [
        ['cte', 'CT-e', result.xmlDisponivel],
        ['emitente', 'Emitente', result.xmlDisponivel],
        ['tomador', 'Tomador', result.xmlDisponivel],
        ['remetente', 'Remetente', result.xmlDisponivel],
        ['expedidor', 'Expedidor', result.xmlDisponivel && !!result.parsed?.expedidor],
        ['recebedor', 'Recebedor', result.xmlDisponivel && !!result.parsed?.recebedor],
        ['destinatario', 'Destinatário', result.xmlDisponivel],
        ['prestacao', 'Prestação', result.xmlDisponivel],
        ['tributos', 'Tributos', result.xmlDisponivel],
        ['carga', 'Carga', result.xmlDisponivel],
        [
          'docs',
          `Documentos (${result.parsed?.documentosTransportados.length ?? 0})`,
          result.xmlDisponivel && (result.parsed?.documentosTransportados.length ?? 0) > 0,
        ],
        ['modal', `Modal ${modalLabel(result.parsed?.modal)}`, result.xmlDisponivel && !!result.parsed?.modal],
        ['locais', 'Locais', result.xmlDisponivel],
        [
          'docAnt',
          `Doc. Anteriores (${result.parsed?.documentosAnteriores.length ?? 0})`,
          result.xmlDisponivel && (result.parsed?.documentosAnteriores.length ?? 0) > 0,
        ],
        ['seguro', 'Seguro', result.xmlDisponivel && !!result.parsed?.seguro],
        ['infoAd', 'Info Adicionais', result.xmlDisponivel],
        ['historico', `Histórico (${result.eventos?.length ?? 0})`, true],
      ]
    : [];

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
                  <Badge variant="blue">
                    {result.parsed.dadosGerais.tipoCteDescricao}
                  </Badge>
                  {result.parsed.protocoloAutorizacao?.cStat === '100' && (
                    <Badge variant="green">Autorizado</Badge>
                  )}
                </div>
                <div className="mb-4 font-mono text-xs text-slate-500">
                  {fmtChave(result.chave)}
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
                    {fmtChave(result.chave)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b border-slate-200">
              {tabs
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
              {tab === 'cte' && result.parsed && <AbaCte parsed={result.parsed} />}
              {tab === 'emitente' && result.parsed && (
                <AbaParticipante p={result.parsed.emitente} mostrarCRT />
              )}
              {tab === 'remetente' && result.parsed && (
                <AbaParticipante p={result.parsed.remetente} />
              )}
              {tab === 'expedidor' && result.parsed?.expedidor && (
                <AbaParticipante p={result.parsed.expedidor} />
              )}
              {tab === 'recebedor' && result.parsed?.recebedor && (
                <AbaParticipante p={result.parsed.recebedor} />
              )}
              {tab === 'destinatario' && result.parsed && (
                <AbaParticipante p={result.parsed.destinatario} mostrarISUF />
              )}
              {tab === 'tomador' && result.parsed && <AbaTomador parsed={result.parsed} />}
              {tab === 'locais' && result.parsed && <AbaLocais parsed={result.parsed} />}
              {tab === 'prestacao' && result.parsed && <AbaPrestacao parsed={result.parsed} />}
              {tab === 'tributos' && result.parsed && <AbaTributos parsed={result.parsed} />}
              {tab === 'carga' && result.parsed && <AbaCarga parsed={result.parsed} />}
              {tab === 'docs' && result.parsed && <AbaDocumentos parsed={result.parsed} />}
              {tab === 'modal' && result.parsed?.modal && (
                <AbaModal modal={result.parsed.modal} />
              )}
              {tab === 'docAnt' && result.parsed && <AbaDocAnteriores parsed={result.parsed} />}
              {tab === 'seguro' && result.parsed?.seguro && <AbaSeguro seguro={result.parsed.seguro} />}
              {tab === 'infoAd' && result.parsed && <AbaInfoAdicionais parsed={result.parsed} />}
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

// =================================================================
// HELPERS
// =================================================================

function modalLabel(modal: CteModal | undefined): string {
  if (!modal) return '';
  switch (modal.modalidade) {
    case '01': return 'Rodoviário';
    case '02': return 'Aéreo';
    case '03': return 'Aquaviário';
    case '04': return 'Ferroviário';
    case '05': return 'Dutoviário';
    case '06': return 'Multimodal';
    default: return '';
  }
}

function valorOuVazio(v?: string | null): string {
  return v && String(v).trim() ? String(v) : '-';
}

function Secao({
  titulo,
  children,
  cols = 2,
}: {
  titulo: string | null;
  children: React.ReactNode;
  cols?: 2 | 3 | 4;
}) {
  const colClass =
    cols === 4
      ? 'md:grid-cols-4'
      : cols === 3
        ? 'md:grid-cols-3'
        : 'md:grid-cols-2';
  return (
    <section className="mb-6 last:mb-0">
      {titulo && (
        <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
          {titulo}
        </h3>
      )}
      <dl className={`grid grid-cols-1 gap-x-8 gap-y-3 text-sm ${colClass}`}>{children}</dl>
    </section>
  );
}

// =================================================================
// ABA 1 — CT-e (resumo + situação + protocolo)
// =================================================================

function AbaCte({ parsed }: { parsed: CteParsed }) {
  const g = parsed.dadosGerais;
  const prot = parsed.protocoloAutorizacao;
  const v = parsed.valores;

  // Resolve o participante que efetivamente é o tomador (mesma lógica da
  // aba Tomador dedicada — mas aqui usamos só pra resumo).
  let tomadorRef: CteParticipante | null = null;
  switch (parsed.tomador) {
    case 'Remetente': tomadorRef = parsed.remetente; break;
    case 'Expedidor': tomadorRef = parsed.expedidor ?? null; break;
    case 'Recebedor': tomadorRef = parsed.recebedor ?? null; break;
    case 'Destinatário': tomadorRef = parsed.destinatario; break;
    case 'Outros': tomadorRef = parsed.tomadorOutros ?? null; break;
  }

  return (
    <>
      <Secao titulo="Identificação do CT-e" cols={4}>
        <Row label="Modelo" value={g.modelo} />
        <Row label="Série" value={g.serie} />
        <Row label="Número" value={g.numero} />
        <Row label="Data de Emissão" value={fmtDataHora(g.dataEmissao)} />
      </Secao>

      <Secao titulo="Valores" cols={3}>
        <Row label="Valor Total do Serviço" value={`R$ ${fmtNum(v.valorTotalPrestacao)}`} />
        <Row label="Base de Cálculo ICMS" value={`R$ ${fmtNum(v.icms?.vBC ?? 0)}`} />
        <Row label="Valor ICMS" value={`R$ ${fmtNum(v.icms?.vICMS ?? 0)}`} />
      </Secao>

      <Secao titulo="Emitente (Transportador)" cols={4}>
        <Row label="CNPJ" value={fmtCnpj(parsed.emitente.cnpj ?? parsed.emitente.cpf)} />
        <Row label="Nome / Razão Social" value={valorOuVazio(parsed.emitente.razaoSocial)} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(parsed.emitente.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(parsed.emitente.endereco?.uf)} />
      </Secao>

      <Secao titulo="Tomador do Serviço" cols={4}>
        <Row label="CNPJ" value={tomadorRef ? fmtCnpj(tomadorRef.cnpj ?? tomadorRef.cpf) : '-'} />
        <Row label="Nome / Razão Social" value={valorOuVazio(tomadorRef?.razaoSocial)} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(tomadorRef?.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(tomadorRef?.endereco?.uf)} />
        <Row label="Relação com a carga" value={parsed.tomador ?? '-'} wide />
      </Secao>

      <Secao titulo="Remetente" cols={4}>
        <Row label="CNPJ" value={fmtCnpj(parsed.remetente.cnpj ?? parsed.remetente.cpf)} />
        <Row label="Nome / Razão Social" value={valorOuVazio(parsed.remetente.razaoSocial)} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(parsed.remetente.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(parsed.remetente.endereco?.uf)} />
      </Secao>

      <Secao titulo="Destinatário" cols={4}>
        <Row label="CNPJ" value={fmtCnpj(parsed.destinatario.cnpj ?? parsed.destinatario.cpf)} />
        <Row label="Nome / Razão Social" value={valorOuVazio(parsed.destinatario.razaoSocial)} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(parsed.destinatario.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(parsed.destinatario.endereco?.uf)} />
      </Secao>

      <Secao titulo="Características" cols={4}>
        <Row label="Modal" value={`${g.modalidade} - ${g.modalidadeDescricao}`} />
        <Row label="Tipo de Serviço" value={`${g.tipoServico} - ${g.tipoServicoDescricao}`} />
        <Row label="Tipo do CT-e" value={`${g.tipoCte} - ${g.tipoCteDescricao}`} />
        <Row label="CFOP" value={g.cfop} />
        <Row label="Natureza da Operação" value={valorOuVazio(g.naturezaOperacao)} wide />
        <Row
          label="Tipo de Emissão"
          value={
            g.tipoEmissao
              ? `${g.tipoEmissao} - ${valorOuVazio(g.tipoEmissaoDescricao)}`
              : '-'
          }
        />
        <Row label="Ambiente" value={g.ambiente === '1' ? 'Produção' : 'Homologação'} />
        <Row
          label="Início da Prestação"
          value={
            g.ufInicio || g.municipioInicioNome
              ? `${g.ufInicio ?? ''} - ${g.municipioInicioNome ?? ''}`.trim().replace(/^- /, '')
              : '-'
          }
        />
        <Row
          label="Fim da Prestação"
          value={
            g.ufFim || g.municipioFimNome
              ? `${g.ufFim ?? ''} - ${g.municipioFimNome ?? ''}`.trim().replace(/^- /, '')
              : '-'
          }
        />
      </Secao>

      {(g.dataContingencia || g.justificativaContingencia) && (
        <Secao titulo="Contingência" cols={2}>
          <Row label="Data/Hora da Contingência" value={fmtDataHora(g.dataContingencia)} />
          <Row label="Justificativa" value={valorOuVazio(g.justificativaContingencia)} wide />
        </Secao>
      )}

      <Secao titulo="Chave de Acesso" cols={2}>
        <Row label="Chave" value={fmtChave(g.chave)} wide />
      </Secao>

      <Secao titulo="Situação atual / Protocolo de Autorização" cols={4}>
        <Row label="Protocolo" value={valorOuVazio(prot?.protocolo)} />
        <Row
          label="Status (cStat)"
          value={prot ? `${prot.cStat} - ${prot.motivo}` : '-'}
          wide
        />
        <Row label="Data da Autorização" value={fmtDataHora(prot?.dataRecebimento)} />
        <Row label="Versão do Aplicativo" value={valorOuVazio(prot?.versaoAplicacao)} />
        <Row label="Digest Value" value={valorOuVazio(prot?.digestValue)} wide />
      </Secao>
    </>
  );
}

// =================================================================
// ABAS 2-6 — Participantes (componente reutilizável)
// =================================================================

function AbaParticipante({
  p,
  mostrarCRT = false,
  mostrarISUF = false,
  relacaoComCarga,
}: {
  p: CteParticipante;
  mostrarCRT?: boolean;
  mostrarISUF?: boolean;
  /** Quando preenchido, mostra "Relação com a carga" como último campo (uso pela aba Tomador). */
  relacaoComCarga?: string | null;
}) {
  const e = p.endereco;

  // Endereço completo numa linha: "logradouro, número, complemento" — padrão Portal SEFAZ.
  const enderecoCompleto =
    [
      e?.logradouro,
      e?.numero,
      e?.complemento && e.complemento !== '-' && !/^\*+$/.test(e.complemento) ? e.complemento : null,
    ]
      .filter((v) => v && v !== '-')
      .join(', ') || '-';

  // Município "código - nome" combinado (Portal SEFAZ).
  const municipioFmt =
    e?.codigoMunicipio && e?.municipio
      ? `${e.codigoMunicipio} - ${e.municipio}`
      : e?.municipio || e?.codigoMunicipio || '-';

  // País "código - nome" combinado (Portal SEFAZ).
  const paisFmt =
    e?.codigoPais && e?.pais
      ? `${e.codigoPais} - ${e.pais}`
      : e?.pais || e?.codigoPais || '-';

  // Último campo da linha "País": Relação com a carga (Tomador) ou SUFRAMA (Destinatário) ou nada.
  let ultimoCampo: { label: string; value: string } | null = null;
  if (relacaoComCarga) {
    ultimoCampo = { label: 'Relação com a carga', value: relacaoComCarga };
  } else if (mostrarISUF) {
    ultimoCampo = { label: 'Inscrição SUFRAMA', value: valorOuVazio(p.inscricaoSUFRAMA) };
  }

  return (
    <Secao titulo={null} cols={2}>
      <Row label="Nome / Razão Social" value={valorOuVazio(p.razaoSocial)} />
      <Row label="Nome Fantasia" value={valorOuVazio(p.nomeFantasia)} />
      <Row
        label={p.cnpj ? 'CNPJ' : p.cpf ? 'CPF' : 'CNPJ/CPF'}
        value={fmtCnpj(p.cnpj ?? p.cpf)}
      />
      <Row label="Inscrição Estadual" value={valorOuVazio(p.inscricaoEstadual)} />
      {p.inscricaoEstadualST && (
        <>
          <Row label="IE Substituto Tributário" value={p.inscricaoEstadualST} />
          <Row label="" value="" />
        </>
      )}
      <Row label="Endereço" value={enderecoCompleto} />
      <Row label="Bairro / Distrito" value={valorOuVazio(e?.bairro)} />
      <Row label="Fone / Fax" value={fmtTelefone(e?.fone)} />
      <Row label="CEP" value={fmtCep(e?.cep)} />
      <Row label="Município" value={municipioFmt} />
      <Row label="UF" value={valorOuVazio(e?.uf)} />
      <Row label="País" value={paisFmt} />
      {ultimoCampo ? (
        <Row label={ultimoCampo.label} value={ultimoCampo.value} />
      ) : (
        <Row label="" value="" />
      )}
      {mostrarCRT && p.crt && (
        <Row
          label="Regime Tributário (CRT)"
          value={`${p.crt} - ${valorOuVazio(p.crtDescricao)}`}
          wide
        />
      )}
      {p.email && <Row label="E-mail" value={p.email} wide />}
    </Secao>
  );
}

// =================================================================
// ABA 7 — Tomador do Serviço
// =================================================================

function AbaTomador({ parsed }: { parsed: CteParsed }) {
  // O tomador real (Remetente / Expedidor / Recebedor / Destinatário) já está
  // exibido em sua aba própria. Aqui mostramos só o indicador + reaproveitamos
  // os dados do bloco correspondente como atalho.
  const nome = parsed.tomador;
  let participanteRef: CteParticipante | null = null;
  switch (nome) {
    case 'Remetente': participanteRef = parsed.remetente; break;
    case 'Expedidor': participanteRef = parsed.expedidor ?? null; break;
    case 'Recebedor': participanteRef = parsed.recebedor ?? null; break;
    case 'Destinatário': participanteRef = parsed.destinatario; break;
    case 'Outros': participanteRef = parsed.tomadorOutros ?? null; break;
  }

  return (
    <>
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
          <p className="text-xs text-amber-900">
            Tomador do serviço é o responsável por <strong>contratar o frete</strong> com o
            transportador (emitente do CT-e). Identifica quem deve a obrigação tributária.
          </p>
        </div>
      </div>
      {participanteRef ? (
        <AbaParticipante p={participanteRef} relacaoComCarga={nome ?? undefined} />
      ) : (
        <Secao titulo={null} cols={2}>
          <Row label="Relação com a carga" value={nome ?? '-'} />
          <Row label="" value="" />
          <Row
            label="Observação"
            value={`Tomador "${nome}" sem dados detalhados no XML (o XML deste CT-e não referencia o bloco do papel correspondente).`}
            wide
          />
        </Secao>
      )}
    </>
  );
}

// =================================================================
// ABA 8 — Locais (Início + Fim de Prestação)
// =================================================================

function AbaLocais({ parsed }: { parsed: CteParsed }) {
  const g = parsed.dadosGerais;
  return (
    <>
      <Secao titulo="Início da Prestação" cols={2}>
        <Row label="Município" value={valorOuVazio(g.municipioInicioNome)} />
        <Row label="UF" value={valorOuVazio(g.ufInicio)} />
        <Row label="Código IBGE" value={valorOuVazio(g.municipioInicioCodigo)} wide />
      </Secao>
      <Secao titulo="Fim da Prestação" cols={2}>
        <Row label="Município" value={valorOuVazio(g.municipioFimNome)} />
        <Row label="UF" value={valorOuVazio(g.ufFim)} />
        <Row label="Código IBGE" value={valorOuVazio(g.municipioFimCodigo)} wide />
      </Secao>
    </>
  );
}

// =================================================================
// ABA 9 — Prestação de Serviço
// =================================================================

function AbaPrestacao({ parsed }: { parsed: CteParsed }) {
  const v = parsed.valores;
  return (
    <>
      <Secao titulo="Valores da Prestação" cols={2}>
        <Row label="Valor Total da Prestação" value={`R$ ${fmtNum(v.valorTotalPrestacao)}`} />
        <Row label="Valor a Receber" value={`R$ ${fmtNum(v.valorReceber)}`} />
      </Secao>

      <section className="mb-6">
        <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Componentes do Frete
        </h3>
        {v.componentes.length === 0 ? (
          <div className="text-sm italic text-slate-500">Nenhum componente cadastrado.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Nome do Componente</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {v.componentes.map((c, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2">{c.nome}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(c.valor)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {fmtNum(v.componentes.reduce((s, c) => s + c.valor, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// =================================================================
// ABA 10 — Tributos
// =================================================================

function AbaTributos({ parsed }: { parsed: CteParsed }) {
  const v = parsed.valores;
  return (
    <>
      <Secao titulo="Total de Tributos" cols={2}>
        <Row label="vTotTrib (Total Aproximado de Tributos)" value={`R$ ${fmtNum(v.vTotTrib ?? 0)}`} wide />
      </Secao>

      {v.icms && <SecaoIcms icms={v.icms} />}

      {v.icmsUFFim && <SecaoIcmsUFFim icmsUFFim={v.icmsUFFim} />}

      {v.issqn && <SecaoIssqn issqn={v.issqn} />}

      {v.infTribFed && <SecaoInfTribFed infTribFed={v.infTribFed} />}

      {!v.icms && !v.icmsUFFim && !v.issqn && !v.infTribFed && (
        <div className="text-sm italic text-slate-500">
          Nenhum bloco de tributos foi encontrado no XML.
        </div>
      )}
    </>
  );
}

function SecaoIcms({ icms }: { icms: CteIcms }) {
  const isSN = !!icms.csosn;
  return (
    <Secao titulo={`ICMS ${isSN ? '(Simples Nacional)' : ''}`} cols={4}>
      {!isSN && <Row label="CST" value={valorOuVazio(icms.cst)} />}
      {isSN && <Row label="CSOSN" value={valorOuVazio(icms.csosn)} />}
      <Row label="Modalidade BC" value={valorOuVazio(icms.modalidadeBase)} />
      <Row label="Base de Cálculo (vBC)" value={`R$ ${fmtNum(icms.vBC ?? 0)}`} />
      <Row label="Alíquota (pICMS)" value={`${fmtNum(icms.pICMS ?? 0)} %`} />
      <Row label="Valor ICMS (vICMS)" value={`R$ ${fmtNum(icms.vICMS ?? 0)}`} />
      {icms.pRedBC != null && <Row label="% Redução BC" value={`${fmtNum(icms.pRedBC)} %`} />}
      {icms.vBCSTRet != null && <Row label="BC ST Retido" value={`R$ ${fmtNum(icms.vBCSTRet)}`} />}
      {icms.vICMSSTRet != null && <Row label="vICMS ST Retido" value={`R$ ${fmtNum(icms.vICMSSTRet)}`} />}
      {icms.vBCSubstituidoPorOutraUF != null && (
        <Row label="BC Substituído (Outra UF)" value={`R$ ${fmtNum(icms.vBCSubstituidoPorOutraUF)}`} />
      )}
      {icms.vICMSSubstituidoPorOutraUF != null && (
        <Row label="vICMS Outra UF" value={`R$ ${fmtNum(icms.vICMSSubstituidoPorOutraUF)}`} />
      )}
      {icms.pCredSN != null && (
        <Row label="% Crédito SN" value={`${fmtNum(icms.pCredSN)} %`} />
      )}
      {icms.vCredICMSSN != null && (
        <Row label="Valor Crédito ICMS SN" value={`R$ ${fmtNum(icms.vCredICMSSN)}`} />
      )}
    </Secao>
  );
}

function SecaoIcmsUFFim({ icmsUFFim }: { icmsUFFim: CteIcmsUFFim }) {
  return (
    <Secao titulo="ICMS — Partilha UF Destino (DIFAL / FCP)" cols={4}>
      <Row label="BC UF Fim" value={`R$ ${fmtNum(icmsUFFim.vBCUFFim ?? 0)}`} />
      <Row label="% FCP UF Fim" value={`${fmtNum(icmsUFFim.pFCPUFFim ?? 0)} %`} />
      <Row label="% ICMS UF Fim" value={`${fmtNum(icmsUFFim.pICMSUFFim ?? 0)} %`} />
      <Row label="% ICMS Inter" value={`${fmtNum(icmsUFFim.pICMSInter ?? 0)} %`} />
      <Row label="vFCP UF Fim" value={`R$ ${fmtNum(icmsUFFim.vFCPUFFim ?? 0)}`} />
      <Row label="vICMS UF Fim" value={`R$ ${fmtNum(icmsUFFim.vICMSUFFim ?? 0)}`} />
      <Row label="vICMS UF Início" value={`R$ ${fmtNum(icmsUFFim.vICMSUFIni ?? 0)}`} wide />
    </Secao>
  );
}

function SecaoIssqn({ issqn }: { issqn: CteIssqn }) {
  return (
    <Secao titulo="ISSQN" cols={4}>
      <Row label="Base de Cálculo" value={`R$ ${fmtNum(issqn.vBC ?? 0)}`} />
      <Row label="Alíquota" value={`${fmtNum(issqn.vAliq ?? 0)} %`} />
      <Row label="Valor ISSQN" value={`R$ ${fmtNum(issqn.vISSQN ?? 0)}`} />
      <Row label="Município Fato Gerador" value={valorOuVazio(issqn.cMunFG)} />
      <Row label="Código Lista Serviço" value={valorOuVazio(issqn.cListServ)} />
      <Row label="Código Serviço" value={valorOuVazio(issqn.cServico)} />
      <Row label="Valor Dedução" value={`R$ ${fmtNum(issqn.vDeducao ?? 0)}`} />
      <Row label="Outras Retenções" value={`R$ ${fmtNum(issqn.vOutro ?? 0)}`} />
      <Row label="Desconto Incondicional" value={`R$ ${fmtNum(issqn.vDescIncond ?? 0)}`} />
      <Row label="Desconto Condicional" value={`R$ ${fmtNum(issqn.vDescCond ?? 0)}`} />
      <Row
        label="Situação Tributária"
        value={
          issqn.cSitTrib
            ? `${issqn.cSitTrib} - ${valorOuVazio(SITUACAO_TRIBUTARIA_ISSQN_MAP[issqn.cSitTrib])}`
            : '-'
        }
      />
      <Row
        label="Indicador ISS"
        value={
          issqn.indISS
            ? `${issqn.indISS} - ${valorOuVazio(INDICADOR_ISS_MAP[issqn.indISS])}`
            : '-'
        }
      />
      <Row label="Indicador Incentivo" value={valorOuVazio(issqn.indIncentivo)} />
    </Secao>
  );
}

function SecaoInfTribFed({ infTribFed }: { infTribFed: CteInfTribFed }) {
  return (
    <Secao titulo="Tributos Federais (PIS / COFINS / IR / CSLL / INSS)" cols={4}>
      <Row label="vPIS" value={`R$ ${fmtNum(infTribFed.vPIS ?? 0)}`} />
      <Row label="vCOFINS" value={`R$ ${fmtNum(infTribFed.vCOFINS ?? 0)}`} />
      <Row label="vIR" value={`R$ ${fmtNum(infTribFed.vIR ?? 0)}`} />
      <Row label="vCSLL" value={`R$ ${fmtNum(infTribFed.vCSLL ?? 0)}`} />
      <Row label="vINSS" value={`R$ ${fmtNum(infTribFed.vINSS ?? 0)}`} />
      {infTribFed.infAdFisco && (
        <Row label="Informação Adicional Fisco" value={infTribFed.infAdFisco} wide />
      )}
    </Secao>
  );
}

// =================================================================
// ABA 11 — Carga
// =================================================================

function AbaCarga({ parsed }: { parsed: CteParsed }) {
  const c = parsed.carga;
  const lacresUnidTransp = parsed.unidadesTransporte.flatMap((u) => u.lacres);
  const lacresUnidCarga = parsed.unidadesCarga.flatMap((u) => u.lacres);
  const todosLacres = [...lacresUnidTransp, ...lacresUnidCarga];

  return (
    <>
      <Secao titulo="Informações da Carga" cols={2}>
        <Row label="Valor Total da Carga" value={`R$ ${fmtNum(c.valorCarga)}`} />
        <Row label="Produto Predominante" value={valorOuVazio(c.produtoPredominante)} />
        <Row
          label="Outras Características"
          value={valorOuVazio(c.outrasCaracteristicas)}
          wide
        />
      </Secao>

      <section className="mb-6">
        <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Quantidades
        </h3>
        {c.quantidades.length === 0 ? (
          <div className="text-sm italic text-slate-500">Sem quantidades cadastradas.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-2 text-right font-semibold">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {c.quantidades.map((q, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2">{q.tipoMedida}</td>
                    <td className="px-3 py-2">{q.descricao}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(q.quantidade, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {parsed.unidadesTransporte.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Unidades de Transporte
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold">Identificação</th>
                  <th className="px-3 py-2 text-left font-semibold">Lacres</th>
                  <th className="px-3 py-2 text-right font-semibold">% Rateio</th>
                </tr>
              </thead>
              <tbody>
                {parsed.unidadesTransporte.map((u, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      {u.tipoUnidade
                        ? `${u.tipoUnidade} - ${valorOuVazio(TIPO_UNIDADE_TRANSPORTE_MAP[u.tipoUnidade])}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 font-mono">{valorOuVazio(u.identificacao)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.lacres.length > 0 ? u.lacres.join(', ') : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">{u.qtdRat != null ? fmtNum(u.qtdRat) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {parsed.unidadesCarga.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Unidades de Carga
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold">Identificação</th>
                  <th className="px-3 py-2 text-left font-semibold">Lacres</th>
                  <th className="px-3 py-2 text-right font-semibold">% Rateio</th>
                </tr>
              </thead>
              <tbody>
                {parsed.unidadesCarga.map((u, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2">
                      {u.tipoUnidade
                        ? `${u.tipoUnidade} - ${valorOuVazio(TIPO_UNIDADE_CARGA_MAP[u.tipoUnidade])}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 font-mono">{valorOuVazio(u.identificacao)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {u.lacres.length > 0 ? u.lacres.join(', ') : '-'}
                    </td>
                    <td className="px-3 py-2 text-right">{u.qtdRat != null ? fmtNum(u.qtdRat) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {todosLacres.length > 0 && (
        <Secao titulo="Lacres (consolidado)" cols={2}>
          <Row label="Lacres" value={todosLacres.join(', ')} wide />
        </Secao>
      )}
    </>
  );
}

// =================================================================
// ABA 12 — Documentos Transportados
// =================================================================

function AbaDocumentos({ parsed }: { parsed: CteParsed }) {
  const docs = parsed.documentosTransportados;
  const [filtro, setFiltro] = useState('');
  const filtroLower = filtro.replace(/\D/g, '');

  const filtrados = filtroLower
    ? docs.filter(
        (d) =>
          (d.chaveNFe ?? '').includes(filtroLower) ||
          (d.numeroNF ?? '').includes(filtroLower) ||
          (d.numeroOutro ?? '').includes(filtroLower),
      )
    : docs;

  const totalNFe = docs.filter((d) => d.chaveNFe).length;
  const totalNF = docs.filter((d) => d.numeroNF && !d.chaveNFe).length;
  const totalOutros = docs.filter((d) => d.tipoOutro).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-700">
          Total: <strong>{docs.length}</strong> documento(s) — {totalNFe} NF-e ·{' '}
          {totalNF} NF mod1/1A · {totalOutros} outros
        </div>
        <div className="ml-auto">
          <input
            type="text"
            placeholder="Buscar por chave/número..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:ring-slate-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-left font-semibold">Chave / Número</th>
              <th className="px-3 py-2 text-right font-semibold">Valor (R$)</th>
              <th className="px-3 py-2 text-right font-semibold">Peso</th>
              <th className="px-3 py-2 text-center font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  Nenhum documento encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((d, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    {d.chaveNFe ? (
                      <Badge variant="blue">NF-e</Badge>
                    ) : d.numeroNF ? (
                      <Badge variant="gray">NF mod 1/1A</Badge>
                    ) : d.tipoOutro ? (
                      <Badge variant="purple">
                        {valorOuVazio(TIPO_DOC_OUTROS_MAP[d.tipoOutro] ?? d.tipoOutro)}
                      </Badge>
                    ) : (
                      <Badge variant="gray">?</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {d.chaveNFe
                      ? fmtChave(d.chaveNFe)
                      : d.numeroNF
                        ? `Nº ${d.numeroNF} Série ${valorOuVazio(d.serie)}`
                        : valorOuVazio(d.numeroOutro)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {d.valor != null ? fmtNum(d.valor) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {d.pesoTotal != null ? fmtNum(d.pesoTotal, 4) : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {d.chaveNFe && (
                      <a
                        href={`/fiscal/nfe/consulta?chave=${d.chaveNFe}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir em /fiscal/nfe/consulta"
                        className="inline-flex items-center text-xs text-slate-700 hover:text-slate-900"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// =================================================================
// ABA 13 — Modal específico
// =================================================================

function AbaModal({ modal }: { modal: CteModal }) {
  if (!modal) return <div className="text-sm italic text-slate-500">Modal não cadastrado.</div>;
  switch (modal.modalidade) {
    case '01': return <SecaoModalRodoviario modal={modal} />;
    case '02': return <SecaoModalAereo modal={modal} />;
    case '03': return <SecaoModalAquaviario modal={modal} />;
    case '04': return <SecaoModalFerroviario modal={modal} />;
    case '05': return <SecaoModalDutoviario modal={modal} />;
    case '06': return <SecaoModalMultimodal modal={modal} />;
  }
}

function SecaoVeiculo({ titulo, v }: { titulo: string; v: CteModalRodoviario['veiculo'] | NonNullable<CteModalRodoviario['reboques']>[number] }) {
  if (!v) return null;
  return (
    <Secao titulo={titulo} cols={4}>
      <Row label="Placa" value={valorOuVazio(v.placa)} />
      <Row label="UF Placa" value={valorOuVazio(v.ufPlaca)} />
      <Row label="RENAVAM" value={valorOuVazio(v.renavam)} />
      <Row
        label="Tipo Rodado"
        value={v.tipoRodado ? `${v.tipoRodado} - ${valorOuVazio(TIPO_RODADO_MAP[v.tipoRodado])}` : '-'}
      />
      <Row
        label="Tipo Carroceria"
        value={
          v.tipoCarroceria
            ? `${v.tipoCarroceria} - ${valorOuVazio(TIPO_CARROCERIA_MAP[v.tipoCarroceria])}`
            : '-'
        }
      />
      <Row label="Tara (kg)" value={v.tara != null ? fmtNum(v.tara, 0) : '-'} />
      <Row label="Capacidade (kg)" value={v.capacidadeKG != null ? fmtNum(v.capacidadeKG, 0) : '-'} />
      <Row label="Capacidade (m³)" value={v.capacidadeM3 != null ? fmtNum(v.capacidadeM3, 2) : '-'} />
      {v.proprietario && (
        <>
          <Row label="Proprietário CNPJ/CPF" value={fmtCnpj(v.proprietario.cnpj ?? v.proprietario.cpf)} wide />
          <Row label="Proprietário Razão Social" value={valorOuVazio(v.proprietario.razaoSocial)} wide />
          <Row label="Proprietário RNTRC" value={valorOuVazio(v.proprietario.rntrc)} />
          <Row label="Proprietário IE" value={valorOuVazio(v.proprietario.inscricaoEstadual)} />
          <Row label="Proprietário UF" value={valorOuVazio(v.proprietario.uf)} />
          <Row
            label="Tipo Proprietário"
            value={
              v.proprietario.tipoProprietario
                ? `${v.proprietario.tipoProprietario} - ${valorOuVazio(ROLE_OPCAO_TIPO_PROPRIETARIO[v.proprietario.tipoProprietario])}`
                : '-'
            }
          />
        </>
      )}
    </Secao>
  );
}

function SecaoModalRodoviario({ modal }: { modal: CteModalRodoviario }) {
  return (
    <>
      <Secao titulo="Modal Rodoviário — Identificação" cols={2}>
        <Row label="RNTRC do Emitente" value={valorOuVazio(modal.rntrc)} wide />
      </Secao>

      {modal.veiculo && <SecaoVeiculo titulo="Veículo Tração" v={modal.veiculo} />}

      {modal.reboques.length > 0 && (
        <>
          {modal.reboques.map((r, i) => (
            <SecaoVeiculo key={i} titulo={`Reboque ${i + 1}`} v={r} />
          ))}
        </>
      )}

      <section className="mb-6">
        <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Motoristas
        </h3>
        {modal.motoristas.length === 0 ? (
          <div className="text-sm italic text-slate-500">Nenhum motorista cadastrado no XML.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">CPF</th>
                  <th className="px-3 py-2 text-left font-semibold">Nome</th>
                </tr>
              </thead>
              <tbody>
                {modal.motoristas.map((m, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-mono">{fmtCnpj(m.cpf)}</td>
                    <td className="px-3 py-2">{valorOuVazio(m.nome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal.valesPedagio.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Vales-pedágio
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">CNPJ Fornecedor</th>
                  <th className="px-3 py-2 text-left font-semibold">CNPJ Responsável</th>
                  <th className="px-3 py-2 text-left font-semibold">Nº Comprovante</th>
                  <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {modal.valesPedagio.map((vp, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-mono">{fmtCnpj(vp.cnpjFornecedor)}</td>
                    <td className="px-3 py-2 font-mono">{fmtCnpj(vp.cnpjResponsavel)}</td>
                    <td className="px-3 py-2 font-mono">{valorOuVazio(vp.numeroComprovante)}</td>
                    <td className="px-3 py-2">
                      {vp.tipoVale
                        ? `${vp.tipoVale} - ${valorOuVazio(TIPO_VALE_PEDAGIO_MAP[vp.tipoVale])}`
                        : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {vp.valor != null ? fmtNum(vp.valor) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modal.ocorrencias.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Ocorrências
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {modal.ocorrencias.map((o, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2">{fmtDataHora(o.data)}</td>
                    <td className="px-3 py-2">{o.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function SecaoModalAereo({ modal }: { modal: CteModalAereo }) {
  return (
    <>
      <Secao titulo="Modal Aéreo" cols={2}>
        <Row label="Número Minuta (nMinu)" value={valorOuVazio(modal.numeroMinuta)} />
        <Row label="Nº Operacional AWB (nOCA)" value={valorOuVazio(modal.numeroOperacionalAWB)} />
        <Row label="Data Prevista de Entrega" value={fmtData(modal.dataPrevistaEntrega)} wide />
      </Secao>
      {modal.natCarga && (
        <Secao titulo="Natureza da Carga" cols={2}>
          <Row label="Dimensões" value={valorOuVazio(modal.natCarga.xDime)} />
          <Row
            label="Códigos de Manuseio"
            value={modal.natCarga.cInfManu.length > 0 ? modal.natCarga.cInfManu.join(', ') : '-'}
            wide
          />
        </Secao>
      )}
      {modal.tarifa && (
        <Secao titulo="Tarifa" cols={3}>
          <Row label="Classe (CL)" value={valorOuVazio(modal.tarifa.classeTarifa)} />
          <Row label="Código (cTar)" value={valorOuVazio(modal.tarifa.codigoTarifa)} />
          <Row
            label="Valor (vTar)"
            value={modal.tarifa.valorTarifa != null ? `R$ ${fmtNum(modal.tarifa.valorTarifa)}` : '-'}
          />
        </Secao>
      )}
    </>
  );
}

function SecaoModalAquaviario({ modal }: { modal: CteModalAquaviario }) {
  return (
    <>
      <Secao titulo="Modal Aquaviário" cols={2}>
        <Row label="Navio" value={valorOuVazio(modal.xNavio)} />
        <Row label="IRIN" value={valorOuVazio(modal.irinNavio)} />
        <Row
          label="Tipo Navegação"
          value={
            modal.tipoNavegacao
              ? `${modal.tipoNavegacao} - ${valorOuVazio(TIPO_NAVEGACAO_MAP[modal.tipoNavegacao])}`
              : '-'
          }
        />
        <Row label="Direção" value={valorOuVazio(modal.direcao)} />
        <Row label="Booking" value={valorOuVazio(modal.numeroBookings)} />
        <Row label="Nº CE Mercante" value={valorOuVazio(modal.numeroCE)} />
        <Row label="Nº BL (Bill of Lading)" value={valorOuVazio(modal.numeroBL)} wide />
        <Row label="vPrest" value={modal.vPrest != null ? `R$ ${fmtNum(modal.vPrest)}` : '-'} />
        <Row label="vAFRMM" value={modal.vAFRMM != null ? `R$ ${fmtNum(modal.vAFRMM)}` : '-'} />
      </Secao>
      {modal.balsas.length > 0 && (
        <Secao titulo="Balsas" cols={2}>
          {modal.balsas.map((b, i) => (
            <Row key={i} label={`Balsa ${i + 1}`} value={valorOuVazio(b.xBalsa)} />
          ))}
        </Secao>
      )}
      {modal.detContainers.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Containers
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Container</th>
                  <th className="px-3 py-2 text-left font-semibold">Lacres</th>
                  <th className="px-3 py-2 text-left font-semibold">NF-es</th>
                </tr>
              </thead>
              <tbody>
                {modal.detContainers.map((c, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-mono">{valorOuVazio(c.nCont)}</td>
                    <td className="px-3 py-2 text-xs">{c.lacres.join(', ') || '-'}</td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {c.detNFe.map((n) => n.chave ?? n.nNF).filter(Boolean).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function SecaoModalFerroviario({ modal }: { modal: CteModalFerroviario }) {
  return (
    <>
      <Secao titulo="Modal Ferroviário" cols={2}>
        <Row
          label="Tipo de Tráfego"
          value={
            modal.tipoTrafego
              ? `${modal.tipoTrafego} - ${valorOuVazio(TIPO_TRAFEGO_MAP[modal.tipoTrafego])}`
              : '-'
          }
        />
        <Row label="Fluxo Ferroviário" value={valorOuVazio(modal.fluxoFerroviario)} />
      </Secao>
      {modal.trafegoMutuo && (
        <Secao titulo="Tráfego Mútuo" cols={2}>
          <Row
            label="Responsável Faturamento"
            value={
              modal.trafegoMutuo.respFat
                ? `${modal.trafegoMutuo.respFat} - ${valorOuVazio(RESPONSAVEL_FATURAMENTO_MAP[modal.trafegoMutuo.respFat])}`
                : '-'
            }
          />
          <Row label="Ferrovia Emitente" value={valorOuVazio(modal.trafegoMutuo.ferrEmi)} />
          <Row label="Fluxo de Pagamento" value={valorOuVazio(modal.trafegoMutuo.fluxoPagamento)} />
          <Row
            label="ICMS de Transporte"
            value={modal.trafegoMutuo.icmsTransporte != null ? `R$ ${fmtNum(modal.trafegoMutuo.icmsTransporte)}` : '-'}
          />
          <Row label="Chave do CT-e Vinculado" value={valorOuVazio(modal.trafegoMutuo.chaveCTe)} wide />
        </Secao>
      )}
    </>
  );
}

function SecaoModalDutoviario({ modal }: { modal: CteModalDutoviario }) {
  return (
    <Secao titulo="Modal Dutoviário" cols={3}>
      <Row label="Valor da Tarifa (vTar)" value={modal.valorTarifa != null ? `R$ ${fmtNum(modal.valorTarifa)}` : '-'} />
      <Row label="Data de Início" value={fmtData(modal.dataInicio)} />
      <Row label="Data de Fim" value={fmtData(modal.dataFim)} />
    </Secao>
  );
}

function SecaoModalMultimodal({ modal }: { modal: CteModalMultimodal }) {
  return (
    <>
      <Secao titulo="Modal Multimodal" cols={2}>
        <Row label="COTM (Certificado OTM)" value={valorOuVazio(modal.cotm)} />
        <Row
          label="Indicador Negociável"
          value={modal.indicadorNegociavel === '1' ? 'Sim' : modal.indicadorNegociavel === '0' ? 'Não' : '-'}
        />
      </Secao>
      {modal.seguro && <AbaSeguro seguro={modal.seguro} />}
    </>
  );
}

// =================================================================
// ABA 14 — Documentos Anteriores / Substituição / Anulação
// =================================================================

function AbaDocAnteriores({ parsed }: { parsed: CteParsed }) {
  const docs = parsed.documentosAnteriores;
  if (docs.length === 0) {
    return (
      <div className="text-sm italic text-slate-500">
        Sem documentos anteriores referenciados.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Tipo</th>
            <th className="px-3 py-2 text-left font-semibold">Chave / Nº</th>
            <th className="px-3 py-2 text-left font-semibold">Modelo / Série</th>
            <th className="px-3 py-2 text-left font-semibold">CNPJ Emitente</th>
            <th className="px-3 py-2 text-left font-semibold">Data Emissão</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d, i) => (
            <tr key={i} className="border-t border-slate-200">
              <td className="px-3 py-2"><Badge variant="gray">{d.tipo}</Badge></td>
              <td className="px-3 py-2 font-mono text-xs">
                {d.chave ? fmtChave(d.chave) : valorOuVazio(d.numero)}
              </td>
              <td className="px-3 py-2">
                {[d.modelo, d.serie, d.subserie].filter(Boolean).join(' / ') || '-'}
              </td>
              <td className="px-3 py-2 font-mono">{fmtCnpj(d.cnpjEmitente)}</td>
              <td className="px-3 py-2">{fmtData(d.dataEmissao)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =================================================================
// ABA 15 — Seguro
// =================================================================

function AbaSeguro({ seguro }: { seguro: CteSeguro }) {
  return (
    <Secao titulo="Seguro da Carga" cols={2}>
      <Row
        label="Responsável pelo Seguro"
        value={
          seguro.responsavelSeguro
            ? `${seguro.responsavelSeguro} - ${valorOuVazio(seguro.responsavelDescricao)}`
            : '-'
        }
        wide
      />
      <Row label="Seguradora" value={valorOuVazio(seguro.nomeSeguradora)} />
      <Row label="CNPJ Seguradora" value={fmtCnpj(seguro.cnpjSeguradora)} />
      <Row label="Nº Apólice" value={valorOuVazio(seguro.numeroApolice)} />
      <Row label="Nº Averbação" value={valorOuVazio(seguro.numeroAverbacao)} />
      <Row label="Valor da Carga" value={seguro.valorCarga != null ? `R$ ${fmtNum(seguro.valorCarga)}` : '-'} />
      <Row label="Valor Averbado" value={seguro.valorAverbado != null ? `R$ ${fmtNum(seguro.valorAverbado)}` : '-'} />
    </Secao>
  );
}

// =================================================================
// ABA 16 — Informações Adicionais
// =================================================================

function AbaInfoAdicionais({ parsed }: { parsed: CteParsed }) {
  const i = parsed.infoAdicionais;
  return (
    <>
      <Secao titulo="Observações Gerais" cols={2}>
        <Row label="Observações ao destinatário (xObs)" value={valorOuVazio(i.observacoes)} wide />
        <Row label="Informações Adicionais Fisco (infAdFisco)" value={valorOuVazio(i.infAdFisco)} wide />
        <Row label="Informações Complementares (infCpl)" value={valorOuVazio(i.infCpl)} wide />
        <Row label="E-mail para entrega" value={valorOuVazio(i.emailEntrega)} wide />
      </Secao>

      {i.observacoesContribuinte.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Observações do Contribuinte ({i.observacoesContribuinte.length})
          </h3>
          <div className="space-y-2">
            {i.observacoesContribuinte.map((o, idx) => (
              <div key={idx} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                {o.xCampo && (
                  <div className="mb-1 text-xs font-semibold text-slate-600">Campo: {o.xCampo}</div>
                )}
                <div className="whitespace-pre-wrap text-slate-700">{o.xTexto}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {i.observacoesFiscais.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Observações do Fisco ({i.observacoesFiscais.length})
          </h3>
          <div className="space-y-2">
            {i.observacoesFiscais.map((o, idx) => (
              <div key={idx} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                {o.xCampo && (
                  <div className="mb-1 text-xs font-semibold text-amber-700">Campo: {o.xCampo}</div>
                )}
                <div className="whitespace-pre-wrap text-amber-900">{o.xTexto}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {i.autorizadosBaixarXml.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Autorizados a Baixar o XML ({i.autorizadosBaixarXml.length})
          </h3>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">CNPJ / CPF</th>
                </tr>
              </thead>
              <tbody>
                {i.autorizadosBaixarXml.map((a, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-mono">{fmtCnpj(a.cnpj ?? a.cpf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
