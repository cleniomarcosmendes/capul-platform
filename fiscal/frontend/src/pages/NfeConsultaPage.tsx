import { Fragment, useEffect, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileText,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { ErrorCard } from '../components/ErrorCard';
import { OrigemBadge } from '../components/OrigemBadge';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import { Row } from '../components/Row';
import {
  fmtCep,
  fmtChave,
  fmtCnpj,
  fmtData,
  fmtDataHora,
  fmtNum,
  fmtTelefone,
} from '../utils/format';
import type {
  NfeConsultaResult,
  NfeEventoDetalheResponse,
  NfeParticipante,
  NfeParsed,
  NfeProduto,
} from '../types';

interface FilialResumo {
  codigo: string;
  nomeFantasia: string;
  cnpj: string | null;
  isDefault?: boolean;
}

type Tab =
  | 'nfe'
  | 'emitente'
  | 'destinatario'
  | 'produtos'
  | 'totais'
  | 'transporte'
  | 'cobranca'
  | 'infoAdicionais';

export function NfeConsultaPage() {
  const [chave, setChave] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NfeConsultaResult | null>(null);
  const [tab, setTab] = useState<Tab>('nfe');
  const [eventoIdAberto, setEventoIdAberto] = useState<string | null>(null);
  const toast = useToast();
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
        // Se a filial atualmente selecionada nao esta na lista de acessiveis,
        // ajusta para a default do usuario (ou primeira da lista).
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
    const chaveLimpa = chave.replace(/\D/g, '');
    if (!/^\d{44}$/.test(chaveLimpa)) {
      setError('Chave deve ter exatamente 44 dígitos numéricos.');
      return;
    }
    try {
      setLoading(true);
      const { data } = await fiscalApi.post<NfeConsultaResult>('/nfe/consulta', {
        chave: chaveLimpa,
        filial: filialSelecionada,
      });
      setResult(data);
      setTab('nfe');
    } catch (err) {
      setError(extractApiError(err, 'Falha ao consultar NF-e.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadXml() {
    if (!result) return;
    const r = await fiscalApi.get(`/nfe/${result.chave}/filial/${result.filial}/xml`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${result.chave}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownloadDanfe() {
    if (!result) return;
    const r = await fiscalApi.get(`/nfe/${result.chave}/filial/${result.filial}/danfe`, {
      responseType: 'blob',
    });
    const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `DANFE_${result.chave}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAtualizarStatus() {
    if (!result) return;
    try {
      setLoading(true);
      const { data: statusData } = await fiscalApi.post<{
        cStat: string;
        xMotivo: string;
        protocolo: string | null;
        dataRecebimento: string | null;
        eventosAnStatus?: 'OK' | 'VAZIO' | 'ERRO' | 'NAO_AUTORIZADO';
        eventosAnMensagem?: string | null;
      }>(`/nfe/${result.chave}/filial/${result.filial}/atualizar-status`);

      toast.success(
        `Status atualizado — cStat ${statusData.cStat}`,
        statusData.xMotivo + (statusData.protocolo ? ` · Protocolo ${statusData.protocolo}` : ''),
      );

      // Feedback específico sobre a busca de eventos no Ambiente Nacional
      if (statusData.eventosAnStatus === 'NAO_AUTORIZADO') {
        toast.error(
          'Eventos AN não autorizados',
          `O certificado digital atual não pode consultar eventos do destinatário desta NF-e no Ambiente Nacional.${statusData.eventosAnMensagem ? ' SEFAZ: ' + statusData.eventosAnMensagem : ''}`,
        );
      } else if (statusData.eventosAnStatus === 'ERRO') {
        toast.error(
          'Falha ao buscar eventos AN',
          statusData.eventosAnMensagem ?? 'Consulta ao Ambiente Nacional indisponível no momento.',
        );
      } else if (statusData.eventosAnStatus === 'VAZIO') {
        // SEFAZ retornou cStat=138 mas sem procEventoNFe — cenário típico
        // quando os eventos já foram "consumidos" por outro sistema da
        // CAPUL (Monitor NFe do Protheus). Uma vez consumidos, o SEFAZ
        // distDFe não os devolve novamente, nem via consChNFe.
        toast.info(
          'SEFAZ não devolveu eventos adicionais',
          'Os eventos do Ambiente Nacional (Ciência, CT-e, MDF-e) podem já ter sido consumidos pelo Monitor NF-e do Protheus. Consulte o ERP para a timeline completa.',
        );
      }

      const { data } = await fiscalApi.post<NfeConsultaResult>('/nfe/consulta', {
        chave: result.chave,
        filial: result.filial,
      });
      setResult(data);
    } catch (err) {
      toast.error(
        'Falha ao atualizar status',
        extractApiError(err, 'Tente novamente em alguns minutos.'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageWrapper title="Consulta NF-e Completa">
      <form
        onSubmit={handleConsultar}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:hidden"
      >
        <p className="mb-3 text-xs text-slate-500">
          Informe a chave de acesso (44 dígitos). O XML será buscado primeiro no Protheus; se não
          existir, será baixado do SEFAZ e gravado no monitor de NF-e automaticamente.
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
              title="CNPJ usado como consulente na chamada SEFAZ NFeDistribuicaoDFe"
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
                value={chave}
                onChange={(e) => setChave(e.target.value.replace(/\D/g, '').slice(0, 44))}
                placeholder="31260400000000000000550010000000011000000010"
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

      {error && <ErrorCard error={error} context="nfe" />}

      {result && (
        <div
          className={`space-y-6 transition-opacity ${
            chave && chave !== result.chave ? 'opacity-50' : 'opacity-100'
          }`}
        >
          {chave && chave !== result.chave && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 print:hidden">
              Resultado abaixo refere-se à chave anterior. Clique em{' '}
              <span className="font-semibold">Consultar</span> para atualizar.
            </div>
          )}
          <div className="print:hidden">
            <OrigemBadge
              status={result.protheusStatus}
              tipoDocumento="nfe"
              chave={result.chave}
              filial={result.filial}
              onReexecutar={(novo) => setResult({ ...result, protheusStatus: novo })}
            />
          </div>

          {/* Dados Gerais — sempre visível, replica o header do portal SEFAZ */}
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Dados Gerais
            </h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-[1fr_160px_120px]">
              <Row label="Chave de Acesso" value={fmtChave(result.chave)} />
              <Row label="Número" value={result.parsed.dadosGerais.numero} />
              <Row label="Versão XML" value={result.parsed.dadosGerais.versaoXml ?? '4.00'} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Badge variant={result.parsed.dadosGerais.ambiente === '1' ? 'green' : 'yellow'}>
                {result.parsed.dadosGerais.ambiente === '1' ? 'Produção' : 'Homologação'}
              </Badge>
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
                onClick={handleDownloadDanfe}
              >
                Baixar DANFE
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={handleAtualizarStatus}
                loading={loading}
              >
                Atualizar status no SEFAZ
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Printer className="h-4 w-4" />}
                onClick={() => window.print()}
              >
                Imprimir
              </Button>
            </div>
          </section>

          {/* Abas — 8 como o portal SEFAZ */}
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b border-slate-200 print:hidden">
              {(
                [
                  ['nfe', 'NFe'],
                  ['emitente', 'Emitente'],
                  ['destinatario', 'Destinatário'],
                  ['produtos', 'Produtos e Serviços'],
                  ['totais', 'Totais'],
                  ['transporte', 'Transporte'],
                  ['cobranca', 'Cobrança'],
                  ['infoAdicionais', 'Informações Adicionais'],
                ] as [Tab, string][]
              ).map(([k, label]) => (
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
              {tab === 'nfe' && (
                <AbaNfe parsed={result.parsed} onAbrirEvento={setEventoIdAberto} />
              )}
              {tab === 'emitente' && <AbaParticipante p={result.parsed.emitente} tipo="emitente" />}
              {tab === 'destinatario' && (
                <AbaParticipante p={result.parsed.destinatario} tipo="destinatario" />
              )}
              {tab === 'produtos' && <AbaProdutos parsed={result.parsed} />}
              {tab === 'totais' && <AbaTotais parsed={result.parsed} />}
              {tab === 'transporte' && <AbaTransporte parsed={result.parsed} />}
              {tab === 'cobranca' && <AbaCobranca parsed={result.parsed} />}
              {tab === 'infoAdicionais' && <AbaInfoAdicionais parsed={result.parsed} />}
            </div>
          </div>

          {/* Em modo de impressão, exibimos todas as abas em sequência */}
          <div className="hidden print:block">
            <SecaoImpressao titulo="Dados da NF-e">
              <AbaNfe parsed={result.parsed} onAbrirEvento={() => undefined} />
            </SecaoImpressao>
            <SecaoImpressao titulo="Emitente">
              <AbaParticipante p={result.parsed.emitente} tipo="emitente" />
            </SecaoImpressao>
            <SecaoImpressao titulo="Destinatário">
              <AbaParticipante p={result.parsed.destinatario} tipo="destinatario" />
            </SecaoImpressao>
            <SecaoImpressao titulo="Produtos e Serviços">
              <AbaProdutos parsed={result.parsed} />
            </SecaoImpressao>
            <SecaoImpressao titulo="Totais">
              <AbaTotais parsed={result.parsed} />
            </SecaoImpressao>
            <SecaoImpressao titulo="Transporte">
              <AbaTransporte parsed={result.parsed} />
            </SecaoImpressao>
            <SecaoImpressao titulo="Cobrança">
              <AbaCobranca parsed={result.parsed} />
            </SecaoImpressao>
            <SecaoImpressao titulo="Informações Adicionais">
              <AbaInfoAdicionais parsed={result.parsed} />
            </SecaoImpressao>
          </div>

          {eventoIdAberto && (
            <EventoDetalheModal
              chave={result.chave}
              filial={result.filial}
              eventoId={eventoIdAberto}
              onClose={() => setEventoIdAberto(null)}
            />
          )}
        </div>
      )}
    </PageWrapper>
  );
}

// ============================================================================
// Helpers de layout
// ============================================================================

function Secao({
  titulo,
  children,
  cols = 2,
}: {
  titulo: string;
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
      <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        {titulo}
      </h3>
      <dl className={`grid grid-cols-1 gap-x-8 gap-y-3 text-sm ${colClass}`}>{children}</dl>
    </section>
  );
}

function SecaoImpressao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-3 border-b-2 border-slate-900 pb-1 text-base font-bold text-slate-900">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function valorOuVazio(v?: string | null): string {
  return v && v.trim() ? v : '-';
}

// ============================================================================
// Aba NFe — replica a primeira aba do portal SEFAZ (resumo + situação atual)
// ============================================================================

function AbaNfe({
  parsed,
  onAbrirEvento,
}: {
  parsed: NfeParsed;
  onAbrirEvento: (eventoId: string) => void;
}) {
  const g = parsed.dadosGerais;
  const e = parsed.emitente;
  const d = parsed.destinatario;
  const t = parsed.totais;
  const prot = parsed.protocoloAutorizacao;

  return (
    <>
      <Secao titulo="Dados da NF-e" cols={4}>
        <Row label="Modelo" value={g.modelo} />
        <Row label="Série" value={g.serie} />
        <Row label="Número" value={g.numero} />
        <Row label="Data de Emissão" value={fmtDataHora(g.dataEmissao)} />
        <Row
          label="Data/Hora de Saída ou da Entrada"
          value={fmtDataHora(g.dataSaidaEntrada)}
          wide
        />
        <Row label="Valor Total da Nota Fiscal" value={fmtNum(t.valorNota)} />
      </Secao>

      <Secao titulo="Emitente" cols={4}>
        <Row label="CNPJ" value={fmtCnpj(e.cnpj ?? e.cpf)} />
        <Row label="Nome / Razão Social" value={e.razaoSocial} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(e.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(e.endereco.uf)} />
      </Secao>

      <Secao titulo="Destinatário" cols={4}>
        <Row label="CNPJ" value={fmtCnpj(d.cnpj ?? d.cpf)} />
        <Row label="Nome / Razão Social" value={d.razaoSocial} wide />
        <Row label="Inscrição Estadual" value={valorOuVazio(d.inscricaoEstadual)} />
        <Row label="UF" value={valorOuVazio(d.endereco.uf)} />
        <Row
          label="Destino da Operação"
          value={valorOuVazio(
            g.indicadorDestino
              ? `${g.indicadorDestino} - ${g.indicadorDestinoDescricao ?? ''}`
              : null,
          )}
        />
        <Row
          label="Consumidor Final"
          value={valorOuVazio(
            g.consumidorFinal
              ? `${g.consumidorFinal} - ${g.consumidorFinalDescricao ?? ''}`
              : null,
          )}
        />
        <Row
          label="Presença do Comprador"
          value={valorOuVazio(
            g.indicadorPresenca
              ? `${g.indicadorPresenca} - ${g.indicadorPresencaDescricao ?? ''}`
              : null,
          )}
          wide
        />
      </Secao>

      <Secao titulo="Emissão" cols={4}>
        <Row
          label="Processo"
          value={valorOuVazio(
            `${g.processoEmissao}${g.processoEmissaoDescricao ? ' - ' + g.processoEmissaoDescricao : ''}`,
          )}
          wide
        />
        <Row label="Versão do Processo" value={valorOuVazio(g.versaoProcesso)} />
        <Row label="Tipo de Emissão" value="1 - Normal" />
        <Row label="Finalidade" value={`${g.finalidade} - ${g.finalidadeDescricao}`} />
        <Row label="Natureza da Operação" value={g.naturezaOperacao} wide />
        <Row
          label="Indicador de Intermediador/Marketplace"
          value={valorOuVazio(
            g.indicadorIntermediador
              ? `${g.indicadorIntermediador} - ${g.indicadorIntermediadorDescricao ?? ''}`
              : null,
          )}
          wide
        />
        <Row
          label="Tipo da Operação"
          value={`${g.tipoOperacao} - ${g.tipoOperacaoDescricao}`}
        />
        <Row label="Digest Value da NF-e" value={valorOuVazio(g.digestValue)} wide />
      </Secao>

      <section className="mb-0">
        <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Situação Atual:{' '}
          <span className="text-slate-900">
            {prot ? (prot.cStat === '100' ? 'AUTORIZADA' : prot.motivo) : 'Sem protocolo'}
          </span>
          <span className="ml-2 text-slate-500 normal-case">
            (Ambiente de autorização:{' '}
            {g.ambiente === '1' ? 'produção' : 'homologação'})
          </span>
        </h3>

        {parsed.eventos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">Eventos da NF-e</th>
                  <th className="py-2 pr-4">Protocolo</th>
                  <th className="py-2 pr-4">Data Autorização</th>
                  <th className="py-2 pr-4">Data Inclusão AN</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {parsed.eventos.map((ev) => (
                  <tr key={ev.id ?? `${ev.tipoEvento}-${ev.dataEvento}`} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{rotuloEvento(ev)}</td>
                    <td className="py-2 pr-4 font-mono">
                      {ev.protocolo && ev.id && ev.possuiDetalhe ? (
                        <button
                          type="button"
                          onClick={() => onAbrirEvento(ev.id!)}
                          className="text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900 hover:decoration-solid"
                          title="Ver detalhes do evento"
                        >
                          {ev.protocolo}
                        </button>
                      ) : (
                        ev.protocolo ?? '-'
                      )}
                    </td>
                    <td className="py-2 pr-4">{fmtDataHora(ev.dataEvento)}</td>
                    <td className="py-2 pr-4">{fmtDataHora(ev.dataEvento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs italic text-slate-500 print:hidden">
              Eventos posteriores (cancelamento, CC-e, ciência, MDF-e vinculado, CT-e vinculado) são obtidos clicando em
              &quot;Atualizar status no SEFAZ&quot;.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Nenhum evento registrado.{' '}
            <span className="italic">
              Clique em &quot;Atualizar status no SEFAZ&quot; para carregar a timeline completa.
            </span>
          </p>
        )}
      </section>
    </>
  );
}

const ROTULO_EVENTO_MAP: Record<string, string> = {
  AUTORIZACAO: 'Autorização de Uso',
  '110110': 'Carta de Correção (CC-e)',
  '110111': 'Cancelamento',
  '110112': 'Cancelamento por substituição',
  '210200': 'Confirmação da Operação',
  '210210': 'Ciência da Operação pelo Destinatário',
  '210220': 'Desconhecimento da Operação',
  '210240': 'Operação não Realizada',
  '310610': 'MDF-e Autorizado com CT-e',
  '310620': 'Cancelamento de MDF-e vinculado ao CT-e',
  '510620': 'CT-e Autorizado',
};

function rotuloEvento(ev: { tipoEvento: string; descricao: string }): string {
  if (ev.tipoEvento === 'AUTORIZACAO') return ROTULO_EVENTO_MAP.AUTORIZACAO;
  return ROTULO_EVENTO_MAP[ev.tipoEvento] ?? ev.descricao ?? `Evento ${ev.tipoEvento}`;
}

// ============================================================================
// Aba Emitente / Destinatário
// ============================================================================

function AbaParticipante({
  p,
  tipo,
}: {
  p: NfeParticipante;
  tipo: 'emitente' | 'destinatario';
}) {
  const titulo = tipo === 'emitente' ? 'Dados do Emitente' : 'Dados do Destinatário';
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">{titulo}</h2>
      <Secao titulo="Identificação">
        <Row label="Nome / Razão Social" value={p.razaoSocial} wide />
        <Row label="Nome Fantasia" value={valorOuVazio(p.nomeFantasia)} wide />
        <Row label="CNPJ" value={fmtCnpj(p.cnpj ?? p.cpf)} />
        <Row
          label="Endereço"
          value={
            p.endereco.logradouro
              ? `${p.endereco.logradouro}${p.endereco.numero ? ', ' + p.endereco.numero : ''}${p.endereco.complemento ? ' - ' + p.endereco.complemento : ''}`
              : '-'
          }
        />
        <Row label="Bairro / Distrito" value={valorOuVazio(p.endereco.bairro)} />
        <Row label="CEP" value={fmtCep(p.endereco.cep)} />
        <Row
          label="Município"
          value={
            p.endereco.codigoMunicipio && p.endereco.municipio
              ? `${p.endereco.codigoMunicipio} - ${p.endereco.municipio}`
              : valorOuVazio(p.endereco.municipio)
          }
        />
        <Row label="Telefone" value={fmtTelefone(p.endereco.telefone)} />
        <Row label="UF" value={valorOuVazio(p.endereco.uf)} />
        <Row
          label="País"
          value={
            p.endereco.codigoPais && p.endereco.pais
              ? `${p.endereco.codigoPais} - ${p.endereco.pais}`
              : valorOuVazio(p.endereco.pais)
          }
        />
      </Secao>

      {tipo === 'emitente' ? (
        <Secao titulo="Fiscal">
          <Row label="Inscrição Estadual" value={valorOuVazio(p.inscricaoEstadual)} />
          <Row
            label="Inscrição Estadual do Substituto Tributário"
            value={valorOuVazio(p.inscricaoEstadualSubstituto)}
          />
          <Row label="Inscrição Municipal" value={valorOuVazio(p.inscricaoMunicipal)} />
          <Row
            label="Município da Ocorrência do Fato Gerador do ICMS"
            value="-"
          />
          <Row label="CNAE Fiscal" value={valorOuVazio(p.cnae)} />
          <Row
            label="Código de Regime Tributário"
            value={
              p.regimeTributario
                ? `${p.regimeTributario} - ${p.regimeTributarioDescricao ?? ''}`
                : '-'
            }
          />
        </Secao>
      ) : (
        <Secao titulo="Fiscal">
          <Row
            label="Indicador IE"
            value={
              p.indicadorIE
                ? `${p.indicadorIE} - ${p.indicadorIEDescricao ?? ''}`
                : '-'
            }
          />
          <Row label="Inscrição Estadual" value={valorOuVazio(p.inscricaoEstadual)} />
          <Row label="Inscrição SUFRAMA" value={valorOuVazio(p.suframa)} />
          <Row label="IM" value={valorOuVazio(p.inscricaoMunicipal)} />
          <Row label="E-mail" value={valorOuVazio(p.email)} wide />
        </Secao>
      )}
    </>
  );
}

// ============================================================================
// Aba Produtos e Serviços
// ============================================================================

function AbaProdutos({ parsed }: { parsed: NfeParsed }) {
  const [expandido, setExpandido] = useState<number | null>(null);
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">
        Produtos e Serviços
      </h2>
      <p className="mb-3 text-center text-[11px] text-slate-500 print:hidden">
        Clique na linha para ver detalhes (impostos, CST, EAN, pedido de compra).
      </p>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-24" />
            <col className="w-14" />
            <col className="w-28" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2">Nº</th>
              <th className="px-3 py-2">Descrição</th>
              <th className="px-3 py-2 text-right">Qtde</th>
              <th className="px-3 py-2">UN</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-center print:hidden" aria-label="Detalhar" />
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {parsed.produtos.map((p) => {
              const aberto = expandido === p.item;
              return (
                <Fragment key={p.item}>
                  <tr
                    onClick={() => setExpandido(aberto ? null : p.item)}
                    className={`cursor-pointer border-b border-slate-100 align-top transition-colors ${
                      aberto ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-3 py-2.5">{p.item}</td>
                    <td className="px-3 py-2.5">
                      <div className="truncate font-medium" title={p.descricao}>
                        {p.descricao}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-500">
                        Cód: <span className="font-mono">{p.codigo}</span>
                        {p.ncm && (
                          <>
                            {' · '}NCM: <span className="font-mono">{p.ncm}</span>
                          </>
                        )}
                        {' · '}CFOP: <span className="font-mono">{p.cfop}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {fmtNum(p.quantidadeComercial, 4)}
                    </td>
                    <td className="px-3 py-2.5">{p.unidadeComercial}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {fmtNum(p.valorTotalBruto)}
                    </td>
                    <td className="px-3 py-2.5 text-center print:hidden">
                      <ChevronDown
                        className={`mx-auto h-4 w-4 text-slate-400 transition-transform ${
                          aberto ? 'rotate-180 text-slate-700' : ''
                        }`}
                      />
                    </td>
                  </tr>
                  {aberto && (
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <td colSpan={6} className="px-4 py-4">
                        <DetalheProduto produto={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DetalheProduto({ produto: p }: { produto: NfeProduto }) {
  const icms = p.impostos.icms ?? {};
  const ibs = p.impostos.ibsCbs;

  return (
    <div className="space-y-5">
      {/* Dados do Produto */}
      <SubSecao titulo="Dados do Produto">
        <GridRow cols={3}>
          <Row label="Código do Produto" value={valorOuVazio(p.codigo)} />
          <Row label="Código NCM" value={valorOuVazio(p.ncm)} />
          <Row label="Código CEST" value={valorOuVazio(p.cest)} />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Indicador de Escala Relevante"
            value={
              p.indEscala
                ? `${p.indEscala} - ${p.indEscalaDescricao ?? ''}`
                : '-'
            }
          />
          <Row
            label="CNPJ do Fabricante da Mercadoria"
            value={fmtCnpj(p.cnpjFabricante)}
          />
          <Row
            label="Código de Benefício Fiscal na UF"
            value={valorOuVazio(p.cBenef)}
          />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Código EX da TIPI" value={valorOuVazio(p.exTipi)} />
          <Row label="CFOP" value={valorOuVazio(p.cfop)} />
          <Row
            label="Outras Despesas Acessórias"
            value={fmtNum(p.valorOutros ?? 0)}
          />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Valor do Desconto" value={fmtNum(p.valorDesconto ?? 0)} />
          <Row label="Valor Total do Frete" value={fmtNum(p.valorFrete ?? 0)} />
          <Row label="Valor do Seguro" value={fmtNum(p.valorSeguro ?? 0)} />
        </GridRow>
        <GridRow cols={1}>
          <Row
            label="Indicador de Composição do Valor Total da NF-e"
            value={
              p.indTotal
                ? `${p.indTotal} - ${p.indTotalDescricao ?? ''}`
                : '-'
            }
            wide
          />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Código EAN Comercial" value={valorOuVazio(p.ean)} />
          <Row label="Unidade Comercial" value={valorOuVazio(p.unidadeComercial)} />
          <Row label="Quantidade Comercial" value={fmtNum(p.quantidadeComercial, 4)} />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Código EAN Tributável" value={valorOuVazio(p.eanTributavel)} />
          <Row label="Unidade Tributável" value={valorOuVazio(p.unidadeTributavel)} />
          <Row
            label="Quantidade Tributável"
            value={fmtNum(p.quantidadeTributavel ?? null, 4)}
          />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Valor unitário de comercialização"
            value={fmtNum(p.valorUnitarioComercial, 10)}
          />
          <Row
            label="Valor unitário de tributação"
            value={fmtNum(p.valorUnitarioTributavel ?? null, 10)}
          />
          <Row label="Número da FCI" value={valorOuVazio(p.nFci)} />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Número do pedido de compra" value={valorOuVazio(p.pedidoCompra)} />
          <Row label="Item do pedido de compra" value={valorOuVazio(p.numeroItemPedido)} />
          <Row
            label="Valor Aproximado dos Tributos"
            value={fmtNum(p.valorAproximadoTributosItem ?? null)}
          />
        </GridRow>
      </SubSecao>

      {/* ICMS Normal e ST */}
      <SubSecao titulo="ICMS Normal e ST">
        <GridRow cols={3}>
          <Row
            label="Origem da Mercadoria"
            value={
              icms.orig ? `${icms.orig} - ${icms.origDescricao ?? ''}` : '-'
            }
          />
          <Row
            label="Tributação do ICMS"
            value={icms.cst ? `${icms.cst} - ${icms.cstDescricao ?? ''}` : '-'}
          />
          <Row
            label="Modalidade Definição da BC ICMS NORMAL"
            value={
              icms.modBC
                ? `${icms.modBC} - ${icms.modBCDescricao ?? ''}`
                : '-'
            }
          />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Base de Cálculo do ICMS Normal"
            value={fmtNum(icms.base ?? 0)}
          />
          <Row
            label="Alíquota do ICMS Normal"
            value={fmtNum(icms.aliquota ?? null, 4)}
          />
          <Row label="Valor do ICMS Normal" value={fmtNum(icms.valor ?? 0)} />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Valor da Base de Cálculo do FCP"
            value={fmtNum(icms.baseFcp ?? 0)}
          />
          <Row
            label="Percentual do Fundo de Combate à Pobreza (FCP)"
            value={fmtNum(icms.percentualFcp ?? null, 4)}
          />
          <Row
            label="Valor do Fundo de Combate à Pobreza (FCP)"
            value={fmtNum(icms.valorFcp ?? 0)}
          />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Base de Cálculo do ICMS ST"
            value={fmtNum(icms.baseST ?? 0)}
          />
          <Row
            label="Alíquota do ICMS ST"
            value={fmtNum(icms.aliquotaST ?? null, 4)}
          />
          <Row label="Valor do ICMS ST" value={fmtNum(icms.valorST ?? 0)} />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Valor da Base de Cálculo do FCP retido por Substituição Tributária"
            value={fmtNum(icms.baseFcpST ?? 0)}
          />
          <Row
            label="Percentual do FCP retido por Substituição Tributária"
            value={fmtNum(icms.percentualFcpST ?? null, 4)}
          />
          <Row
            label="Valor do FCP retido por Substituição Tributária"
            value={fmtNum(icms.valorFcpST ?? 0)}
          />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Percentual Redução de BC do ICMS ST"
            value={fmtNum(icms.percentualReducaoBCST ?? null, 4)}
          />
          <Row
            label="Percentual do MVA do ICMS ST"
            value={fmtNum(icms.percentualMvaST ?? null, 4)}
          />
          <Row
            label="Modalidade Definição da BC ICMS ST"
            value={
              icms.modBCST
                ? `${icms.modBCST} - ${icms.modBCSTDescricao ?? ''}`
                : '-'
            }
          />
        </GridRow>
        <GridRow cols={2}>
          <Row
            label="Valor do ICMS-ST desonerado"
            value={fmtNum(icms.valorIcmsSTDesonerado ?? 0)}
          />
          <Row
            label="Motivo da desoneração do ICMS-ST"
            value={valorOuVazio(icms.motivoDesoneracaoST)}
          />
        </GridRow>
      </SubSecao>

      {/* IBSCBS */}
      {ibs && (
        <>
          <SubSecao titulo="IBSCBS">
            <GridRow cols={3}>
              <Row label="CST" value={valorOuVazio(ibs.cst)} />
              <Row label="cClassTrib" value={valorOuVazio(ibs.cClassTrib)} />
              <Row
                label="Operação de Doação"
                value={
                  ibs.operacaoDoacao === '1'
                    ? 'SIM'
                    : ibs.operacaoDoacao === '0'
                      ? 'NÃO'
                      : '-'
                }
              />
            </GridRow>
            <GridRow cols={1}>
              <Row label="Valor da BC" value={fmtNum(ibs.base ?? 0, 3)} wide />
            </GridRow>
          </SubSecao>

          <SubSecao titulo="IBS Estadual">
            <GridRow cols={1}>
              <Row
                label="Alíquota do IBS da UF"
                value={fmtNum(ibs.aliquotaIbsUF ?? null, 4)}
                wide
              />
            </GridRow>
            <GridRow cols={1}>
              <Row
                label="Valor do IBS de competência das UF"
                value={fmtNum(ibs.valorIbsUF ?? 0, 3)}
                wide
              />
            </GridRow>
          </SubSecao>

          <SubSecao titulo="IBS Municipal">
            <GridRow cols={1}>
              <Row
                label="Alíquota do IBS do Município"
                value={fmtNum(ibs.aliquotaIbsMun ?? null, 4)}
                wide
              />
            </GridRow>
            <GridRow cols={1}>
              <Row
                label="Valor do IBS Municipal"
                value={fmtNum(ibs.valorIbsMun ?? 0, 3)}
                wide
              />
            </GridRow>
            <GridRow cols={1}>
              <Row
                label="Valor do IBS"
                value={fmtNum(ibs.valorIbsTotal ?? 0, 3)}
                wide
              />
            </GridRow>
          </SubSecao>

          <SubSecao titulo="CBS">
            <GridRow cols={1}>
              <Row
                label="Alíquota da CBS"
                value={fmtNum(ibs.aliquotaCbs ?? null, 4)}
                wide
              />
            </GridRow>
            <GridRow cols={1}>
              <Row
                label="Valor da CBS"
                value={fmtNum(ibs.valorCbs ?? 0, 3)}
                wide
              />
            </GridRow>
          </SubSecao>
        </>
      )}

      {/* PIS */}
      <SubSecao titulo="PIS">
        <GridRow cols={1}>
          <Row
            label="CST"
            value={
              p.impostos.pisCst
                ? `${p.impostos.pisCst} - Operação Tributável`
                : '-'
            }
            wide
          />
        </GridRow>
        <GridRow cols={3}>
          <Row label="Base de Cálculo" value={fmtNum(p.impostos.pisBase ?? 0)} />
          <Row label="Alíquota" value={fmtNum(p.impostos.pisAliquota ?? null, 4)} />
          <Row label="Valor" value={fmtNum(p.impostos.pisValor ?? 0)} />
        </GridRow>
      </SubSecao>

      {/* COFINS */}
      <SubSecao titulo="COFINS">
        <GridRow cols={1}>
          <Row
            label="CST"
            value={
              p.impostos.cofinsCst
                ? `${p.impostos.cofinsCst} - Operação Tributável`
                : '-'
            }
            wide
          />
        </GridRow>
        <GridRow cols={3}>
          <Row
            label="Base de Cálculo"
            value={fmtNum(p.impostos.cofinsBase ?? 0)}
          />
          <Row
            label="Alíquota"
            value={fmtNum(p.impostos.cofinsAliquota ?? null, 4)}
          />
          <Row label="Valor" value={fmtNum(p.impostos.cofinsValor ?? 0)} />
        </GridRow>
      </SubSecao>

      {/* IPI — só mostra se tiver dado */}
      {(p.impostos.ipiValor ?? 0) > 0 && (
        <SubSecao titulo="IPI">
          <GridRow cols={3}>
            <Row label="CST" value={valorOuVazio(p.impostos.ipiCst)} />
            <Row
              label="Alíquota"
              value={fmtNum(p.impostos.ipiAliquota ?? null, 4)}
            />
            <Row label="Valor" value={fmtNum(p.impostos.ipiValor ?? 0)} />
          </GridRow>
        </SubSecao>
      )}

      {p.informacoesAdicionais && (
        <SubSecao titulo="Informações Adicionais do Item">
          <div className="whitespace-pre-wrap text-xs text-slate-700">
            {p.informacoesAdicionais}
          </div>
        </SubSecao>
      )}
    </div>
  );
}

function SubSecao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <h4 className="rounded-t bg-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700">
        {titulo}
      </h4>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

function GridRow({
  cols,
  children,
}: {
  cols: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const cls =
    cols === 1 ? 'md:grid-cols-1' : cols === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3';
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-2 ${cls}`}>{children}</dl>
  );
}

// ============================================================================
// Aba Totais
// ============================================================================

function AbaTotais({ parsed }: { parsed: NfeParsed }) {
  const t = parsed.totais;
  const ibs = t.ibsCbs;
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">Totais</h2>

      <Secao titulo="ICMS" cols={4}>
        <Row label="Base de Cálculo ICMS" value={fmtNum(t.baseCalculoIcms)} />
        <Row label="Valor do ICMS" value={fmtNum(t.valorIcms)} />
        <Row label="Valor do ICMS Desonerado" value={fmtNum(t.valorIcmsDesonerado)} />
        <Row label="Valor Total do FCP" value={fmtNum(t.valorFcp)} />
        <Row label="Base de Cálculo ICMS ST" value={fmtNum(t.baseCalculoIcmsSt)} />
        <Row label="Valor ICMS Substituição" value={fmtNum(t.valorIcmsSt)} />
        <Row label="Valor Total do FCP ST" value={fmtNum(t.valorFcpSt)} />
        <Row
          label="Valor do FCP retido anteriormente por ST"
          value={fmtNum(t.valorFcpStRetido)}
          wide
        />
      </Secao>

      {ibs && (
        <Secao titulo="IBSCBS" cols={3}>
          <Row label="Base de Cálculo do IBS e CBS" value={fmtNum(ibs.baseCalculo)} wide />
          <Row label="IBS Estadual - Diferimento" value={fmtNum(ibs.ibsEstadualDiferimento)} />
          <Row
            label="IBS Estadual - Devolução de Tributo"
            value={fmtNum(ibs.ibsEstadualDevolucao)}
          />
          <Row label="IBS Estadual - Valor do IBS" value={fmtNum(ibs.ibsEstadualValor)} />
          <Row label="IBS Municipal - Diferimento" value={fmtNum(ibs.ibsMunicipalDiferimento)} />
          <Row
            label="IBS Municipal - Devolução de Tributo"
            value={fmtNum(ibs.ibsMunicipalDevolucao)}
          />
          <Row label="IBS Municipal - Valor do IBS" value={fmtNum(ibs.ibsMunicipalValor)} />
          <Row label="IBS - Total" value={fmtNum(ibs.ibsTotal)} />
          <Row label="Crédito Presumido - IBS" value={fmtNum(ibs.ibsCreditoPresumido)} />
          <Row
            label="Crédito Presumido Condição Suspensiva - IBS"
            value={fmtNum(ibs.ibsCreditoPresumidoCondSus)}
          />
          <Row label="CBS - Diferimento" value={fmtNum(ibs.cbsDiferimento)} />
          <Row label="CBS - Devolução de Tributo" value={fmtNum(ibs.cbsDevolucao)} />
          <Row label="CBS - Valor Total" value={fmtNum(ibs.cbsValor)} />
          <Row label="CBS - Crédito Presumido" value={fmtNum(ibs.cbsCreditoPresumido)} />
          <Row
            label="CBS - Crédito Presumido Condição Suspensiva"
            value={fmtNum(ibs.cbsCreditoPresumidoCondSus)}
          />
        </Secao>
      )}

      <Secao titulo="Totais da Nota" cols={4}>
        <Row label="Valor Total dos Produtos" value={fmtNum(t.valorProdutos)} />
        <Row label="Valor do Frete" value={fmtNum(t.valorFrete)} />
        <Row label="Valor do Seguro" value={fmtNum(t.valorSeguro)} />
        <Row label="Valor Total dos Descontos" value={fmtNum(t.valorDesconto)} />
        <Row label="Valor Total do II" value={fmtNum(t.valorII)} />
        <Row label="Valor Total do IPI" value={fmtNum(t.valorIpi)} />
        <Row label="Valor do IPI Devolvido" value={fmtNum(t.valorIpiDevolvido)} />
        <Row label="Valor do PIS" value={fmtNum(t.valorPis)} />
        <Row label="Valor da COFINS" value={fmtNum(t.valorCofins)} />
        <Row label="Outras Despesas Acessórias" value={fmtNum(t.valorOutros)} />
        <Row label="Valor Total da NF-e" value={fmtNum(t.valorNota)} />
        <Row
          label="Valor Aproximado dos Tributos"
          value={fmtNum(t.valorTotalTributos ?? 0)}
        />
      </Secao>
    </>
  );
}

// ============================================================================
// Aba Transporte
// ============================================================================

function AbaTransporte({ parsed }: { parsed: NfeParsed }) {
  const tr = parsed.transporte;
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">
        Dados do Transporte
      </h2>

      <Secao titulo="Modalidade do Frete">
        <Row
          label="Modalidade"
          value={`${tr.modalidadeFrete} - ${tr.modalidadeFreteDescricao}`}
          wide
        />
      </Secao>

      {tr.transportador && (
        <Secao titulo="Transportador" cols={3}>
          <Row label="CNPJ" value={fmtCnpj(tr.transportador.cnpj ?? tr.transportador.cpf)} />
          <Row
            label="Razão Social / Nome"
            value={valorOuVazio(tr.transportador.razaoSocial)}
            wide
          />
          <Row
            label="Inscrição Estadual"
            value={valorOuVazio(tr.transportador.inscricaoEstadual)}
          />
          <Row
            label="Endereço Completo"
            value={valorOuVazio(tr.transportador.endereco)}
            wide
          />
          <Row label="Município" value={valorOuVazio(tr.transportador.municipio)} />
          <Row label="UF" value={valorOuVazio(tr.transportador.uf)} />
        </Secao>
      )}

      {tr.veiculo && (tr.veiculo.placa || tr.veiculo.uf) && (
        <Secao titulo="Veículo" cols={3}>
          <Row label="Placa" value={valorOuVazio(tr.veiculo.placa)} />
          <Row label="UF" value={valorOuVazio(tr.veiculo.uf)} />
          <Row label="RNTC" value={valorOuVazio(tr.veiculo.rntc)} />
        </Secao>
      )}

      {tr.volumes.length > 0 && (
        <section>
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Volumes
          </h3>
          {tr.volumes.map((v, i) => (
            <div key={i} className="mb-4 rounded border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-xs font-semibold text-slate-700">Volume {i + 1}</div>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
                <Row label="Quantidade" value={fmtNum(v.quantidade ?? 0, 0)} />
                <Row label="Espécie" value={valorOuVazio(v.especie)} />
                <Row label="Marca dos Volumes" value={valorOuVazio(v.marca)} />
                <Row label="Numeração" value={valorOuVazio(v.numeracao)} />
                <Row label="Peso Líquido" value={fmtNum(v.pesoLiquido ?? 0, 3)} />
                <Row label="Peso Bruto" value={fmtNum(v.pesoBruto ?? 0, 3)} />
              </dl>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

// ============================================================================
// Aba Cobrança
// ============================================================================

function AbaCobranca({ parsed }: { parsed: NfeParsed }) {
  const c = parsed.cobranca;
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">Dados de Cobrança</h2>

      {c.fatura && (
        <Secao titulo="Fatura" cols={3}>
          <Row label="Número" value={valorOuVazio(c.fatura.numero)} />
          <Row label="Valor Original" value={fmtNum(c.fatura.valorOriginal ?? 0)} />
          <Row label="Valor do Desconto" value={fmtNum(c.fatura.valorDesconto ?? 0)} />
          <Row label="Valor Líquido" value={fmtNum(c.fatura.valorLiquido ?? 0)} wide />
        </Secao>
      )}

      {c.duplicatas.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Duplicatas
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">Número</th>
                  <th className="py-2 pr-4">Vencimento</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {c.duplicatas.map((d, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono">{valorOuVazio(d.numero)}</td>
                    <td className="py-2 pr-4">{fmtData(d.vencimento)}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {fmtNum(d.valor ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {c.formasPagamento.length > 0 && (
        <section>
          <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
            Formas de Pagamento
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">Ind. Forma de Pagamento</th>
                  <th className="py-2 pr-4">Meio de Pagamento</th>
                  <th className="py-2 pr-4">Descrição do Meio de Pagamento</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="text-slate-800">
                {c.formasPagamento.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-4">
                      {p.indicadorPagamento
                        ? `${p.indicadorPagamento} - ${p.indicadorPagamentoDescricao ?? ''}`
                        : '-'}
                    </td>
                    <td className="py-2 pr-4">
                      {p.meioPagamento
                        ? `${p.meioPagamento} - ${p.meioPagamentoDescricao ?? ''}`
                        : '-'}
                    </td>
                    <td className="py-2 pr-4">{valorOuVazio(p.descricaoMeioPagamento)}</td>
                    <td className="py-2 pr-4 text-right font-mono">
                      {fmtNum(p.valorPagamento ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!c.fatura && c.duplicatas.length === 0 && c.formasPagamento.length === 0 && (
        <p className="text-sm text-slate-500">Sem dados de cobrança no XML.</p>
      )}
    </>
  );
}

// ============================================================================
// Aba Informações Adicionais
// ============================================================================

function AbaInfoAdicionais({ parsed }: { parsed: NfeParsed }) {
  const i = parsed.informacoesAdicionais;
  const aut = parsed.autorizadosXml;
  return (
    <>
      <h2 className="mb-4 text-center text-base font-semibold text-slate-800">
        Informações Adicionais
      </h2>

      <Secao titulo="Formato de Impressão DANFE">
        <Row
          label="Formato"
          value={
            i?.formatoImpressaoDanfe
              ? `${i.formatoImpressaoDanfe} - ${i.formatoImpressaoDanfeDescricao ?? ''}`
              : '-'
          }
          wide
        />
      </Secao>

      {aut.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Autorizados a acessar o XML da NF-e
          </h3>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            {aut.map((a, idx) => (
              <Row
                key={idx}
                label={a.cnpj ? `Autorizado ${idx + 1} - CNPJ` : `Autorizado ${idx + 1} - CPF`}
                value={fmtCnpj(a.cnpj ?? a.cpf)}
              />
            ))}
          </dl>
        </section>
      )}

      {i?.informacoesComplementares && (
        <section className="mb-6">
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Informações Complementares de Interesse do Contribuinte
          </h3>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Descrição
            </div>
            <div className="whitespace-pre-wrap text-xs text-slate-800">
              {i.informacoesComplementares}
            </div>
          </div>
        </section>
      )}

      {i?.informacoesFisco && (
        <section>
          <h3 className="mb-3 border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Informações Adicionais de Interesse do Fisco
          </h3>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <div className="whitespace-pre-wrap text-xs text-slate-800">{i.informacoesFisco}</div>
          </div>
        </section>
      )}

      {!i?.informacoesComplementares &&
        !i?.informacoesFisco &&
        !i?.formatoImpressaoDanfe &&
        aut.length === 0 && (
          <p className="text-sm text-slate-500">Sem informações adicionais no XML.</p>
        )}
    </>
  );
}

// ============================================================================
// Modal de detalhe do evento — replica a tela da imagem 2 (Ciência da Operação,
// Detalhes do Evento, Autorização pela SEFAZ).
// ============================================================================

function EventoDetalheModal({
  chave,
  filial,
  eventoId,
  onClose,
}: {
  chave: string;
  filial: string;
  eventoId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<NfeEventoDetalheResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErro(null);
    fiscalApi
      .get<NfeEventoDetalheResponse>(`/nfe/${chave}/filial/${filial}/eventos/${eventoId}`)
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch((err) => {
        if (alive) setErro(extractApiError(err, 'Falha ao carregar detalhe do evento.'));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chave, filial, eventoId]);

  // ESC fecha o modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const det = data?.detalhe;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-slate-800">
            {data ? rotuloEvento({ tipoEvento: data.tipoEvento, descricao: data.descricao }) : 'Detalhe do Evento'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {loading && <p className="text-sm text-slate-500">Carregando detalhes…</p>}
          {erro && <ErrorCard error={erro} />}
          {data && !loading && !erro && (
            <>
              {det ? (
                <>
                  <h3 className="mb-3 text-center text-sm font-semibold text-slate-700">
                    {det.tipoEventoDescricao}
                  </h3>
                  <Secao titulo="Cabeçalho do Evento" cols={3}>
                    <Row
                      label="Órgão Recepção do Evento"
                      value={
                        det.orgaoRecepcao
                          ? `${det.orgaoRecepcao}${det.orgaoRecepcaoDescricao ? ' - ' + det.orgaoRecepcaoDescricao : ''}`
                          : '-'
                      }
                    />
                    <Row label="Ambiente" value={det.ambienteDescricao} />
                    <Row label="Versão" value={valorOuVazio(det.versao)} />
                    <Row label="Chave de Acesso" value={fmtChave(det.chave)} wide />
                    <Row label="Id do Evento" value={valorOuVazio(det.idEvento)} wide />
                    <Row
                      label="Autor Evento (CNPJ / CPF)"
                      value={fmtCnpj(det.autorCnpj ?? det.autorCpf)}
                    />
                    <Row label="Data Evento" value={fmtDataHora(det.dataEvento)} wide />
                    <Row
                      label="Tipo de Evento"
                      value={det.tipoEventoDescricao}
                    />
                    <Row
                      label="Sequencial do Evento"
                      value={String(det.sequencial)}
                    />
                  </Secao>

                  <Secao titulo="Detalhes do Evento">
                    <Row
                      label="Descrição do Evento"
                      value={valorOuVazio(det.descricaoEvento)}
                    />
                    <Row label="Versão" value={valorOuVazio(det.versaoEvento)} />
                    <Row
                      label="Justificativa"
                      value={valorOuVazio(det.justificativa)}
                      wide
                    />
                  </Secao>

                  <section>
                    <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Autorização pela SEFAZ
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-3">
                      <Row
                        label="Mensagem de Autorização"
                        value={valorOuVazio(det.autorizacaoMensagem)}
                      />
                      <Row
                        label="Protocolo"
                        value={valorOuVazio(det.autorizacaoProtocolo)}
                      />
                      <Row
                        label="Data/Hora Autorização"
                        value={fmtDataHora(det.autorizacaoDataHora)}
                      />
                    </dl>
                  </section>
                </>
              ) : (
                // Fallback quando for AUTORIZACAO (sem procEventoNFe salvo): exibe o que temos.
                <Secao titulo="Autorização de Uso" cols={2}>
                  <Row label="Tipo de Evento" value="Autorização de Uso" />
                  <Row label="Data/Hora" value={fmtDataHora(data.dataEvento)} />
                  <Row label="Protocolo" value={valorOuVazio(data.protocolo)} />
                  <Row label="Status (cStat)" value={valorOuVazio(data.cStat)} />
                  <Row
                    label="Motivo (xMotivo)"
                    value={valorOuVazio(data.xMotivo)}
                    wide
                  />
                </Secao>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
