import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { PromptDialog } from '../components/PromptDialog';
import { useAuth } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import { fmtChaveMascara } from '../utils/format';

type PapelCapul = 'DEST' | 'TOMA' | 'REM' | 'EXPED' | 'RECEB' | 'AUTXML' | 'TERCEIRO';
type SchemaCte = 'procCTe' | 'procCTeSimp' | 'resCTe' | 'procEventoCTe' | 'resEventoCTe' | 'DESCONHECIDO';

interface CteDocumentoListItem {
  id: number;
  cnpjConsulente: string;
  ambiente: number;
  nsu: string;
  schema: SchemaCte;
  chave: string | null;
  modelo: number | null;
  dhEmi: string | null;
  papelCapul: PapelCapul | null;
  xmlBytes: number;
  recebidoEm: string;
  processadoEm: string | null;
  erroParse: string | null;
  protheusGravadoEm: string | null;
  protheusStatus: string | null;
  protheusErro: string | null;
  // Flags granulares (08/05/2026): fonte de verdade do retorno grvXML.
  // Status acima eh derivado, mas filtros avancados usam estas colunas.
  protheusGrvSucesso: boolean | null;
  protheusGrvXmlGravado: boolean | null;
  protheusGrvPendAmarracao: boolean | null;
  protheusGrvPrenotaFalhou: boolean | null;
  protheusGrvMensagem: string | null;
  protheusGrvJaExistia: boolean | null;
  // Overlay de resolução manual (08/05/2026)
  inconsistenciaResolvidaEm: string | null;
  inconsistenciaResolvidaPorNome: string | null;
  inconsistenciaObservacao: string | null;
}

interface ListResp {
  items: CteDocumentoListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CteEvento {
  id: number;
  chave: string;
  idEvento: string;
  tipoEvento: string;
  tpEventoNum: number;
  nSeqEvento: number;
  dhEvento: string;
  cStat: string;
  xMotivo: string;
  protocolo: string | null;
}

interface DetalheResp {
  documento: CteDocumentoListItem & {
    xml: string;
    xmlSha256: string;
    protheusTentativas?: number;
    protheusGrvRequest?: string | null;
  };
  eventos: CteEvento[];
}

const PAPEL_OPTIONS: { v: '' | PapelCapul; l: string; cor: string }[] = [
  { v: '', l: 'Todos', cor: '' },
  { v: 'TOMA', l: 'Tomador', cor: 'bg-blue-100 text-blue-800' },
  { v: 'DEST', l: 'Destinatário', cor: 'bg-green-100 text-green-800' },
  { v: 'REM', l: 'Remetente', cor: 'bg-amber-100 text-amber-800' },
  { v: 'EXPED', l: 'Expedidor', cor: 'bg-purple-100 text-purple-800' },
  { v: 'RECEB', l: 'Recebedor', cor: 'bg-cyan-100 text-cyan-800' },
  { v: 'AUTXML', l: 'Aut. XML', cor: 'bg-gray-100 text-gray-800' },
  { v: 'TERCEIRO', l: 'Terceiro', cor: 'bg-slate-100 text-slate-700' },
];

const SCHEMA_OPTIONS: { v: '' | SchemaCte; l: string }[] = [
  { v: '', l: 'Todos' },
  { v: 'procCTe', l: 'CT-e completo' },
  { v: 'procCTeSimp', l: 'CT-e simplificado' },
  { v: 'resCTe', l: 'Resumo CT-e' },
  { v: 'procEventoCTe', l: 'Evento (completo)' },
  { v: 'resEventoCTe', l: 'Evento (resumo)' },
  { v: 'DESCONHECIDO', l: '⚠️ Desconhecido' },
];

const PAGE_SIZE = 20;

export function CteRecebidosPage() {
  const toast = useToast();
  const { usuario } = useAuth();
  const confirm = useConfirm();
  const isAdmin = useMemo(
    () => usuario?.modulos?.some((m) => m.codigo === 'FISCAL' && m.role === 'ADMIN_TI'),
    [usuario],
  );

  const [items, setItems] = useState<CteDocumentoListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [papel, setPapel] = useState<'' | PapelCapul>('');
  const [schema, setSchema] = useState<'' | SchemaCte>('');
  const [ambiente, setAmbiente] = useState<'' | '1' | '2'>('');
  const [protheusStatus, setProtheusStatus] = useState<
    | ''
    | 'GRAVADO'
    | 'GRAVADO_PRENOTA_FALHOU'
    | 'GRAVADO_AGUARDANDO_AMARRACAO'
    | 'JA_EXISTIA'
    | 'FALHA_TECNICA'
    | 'PROTHEUS_DESISTIU'
    | 'NAO_APLICAVEL'
    | 'PENDENTE'
  >('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  // Recebimento (recebidoEm na base) — independente de Emissao (dhEmi).
  // Util pra "o que chegou hoje?" sem depender da data de emissao do CT-e.
  const [recebimentoInicio, setRecebimentoInicio] = useState('');
  const [recebimentoFim, setRecebimentoFim] = useState('');

  // Ordenacao por click no header (08/05/2026). null = ordem default
  // (recebidoEm desc do backend). Click: nenhum → desc → asc → nenhum.
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filtro de pendencias de correcao (08/05/2026)
  const [inconsistenciaFiltro, setInconsistenciaFiltro] = useState<
    'pendentes' | 'resolvidas' | 'todas'
  >('todas');

  // Modal detalhe
  const [detalhe, setDetalhe] = useState<DetalheResp | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Validacao YYYY-MM-DD — input type=date em alguns browsers mobile
  // aceita formatos livres (ex: "+052025-05-07") que viram dates malformadas
  // no toISOString. Sem essa guarda, useEffect disparava request a cada
  // keystroke do user, batendo rate-limit do throttler (429 em loop).
  const isDataValida = (d: string) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);

  const carregar = useCallback(async () => {
    if (
      !isDataValida(dataInicio) ||
      !isDataValida(dataFim) ||
      !isDataValida(recebimentoInicio) ||
      !isDataValida(recebimentoFim)
    ) {
      // Data invalida — nao chama backend (evita loop por keystroke)
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(PAGE_SIZE),
      };
      if (search) params.search = search.replace(/\D/g, '');
      if (papel) params.papel = papel;
      if (schema) params.schema = schema;
      if (ambiente) params.ambiente = ambiente;
      if (protheusStatus) params.protheusStatus = protheusStatus;
      if (dataInicio) params.dataInicio = new Date(dataInicio + 'T00:00:00').toISOString();
      if (dataFim) {
        const fim = new Date(dataFim + 'T23:59:59.999');
        params.dataFim = fim.toISOString();
      }
      if (recebimentoInicio) {
        params.recebimentoInicio = new Date(recebimentoInicio + 'T00:00:00').toISOString();
      }
      if (recebimentoFim) {
        params.recebimentoFim = new Date(recebimentoFim + 'T23:59:59.999').toISOString();
      }
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      if (inconsistenciaFiltro !== 'todas') {
        params.inconsistenciaFiltro = inconsistenciaFiltro;
      }
      const r = await fiscalApi.get<ListResp>('/cte/recebidos', { params });
      setItems(r.data.items);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } catch (err) {
      toast.error('Erro ao carregar CT-es', extractApiError(err) ?? undefined);
    } finally {
      setLoading(false);
    }
  }, [page, search, papel, schema, ambiente, protheusStatus, dataInicio, dataFim, recebimentoInicio, recebimentoFim, sortBy, sortOrder, inconsistenciaFiltro, toast]);

  // Click no header da coluna: nenhum → desc → asc → nenhum
  const toggleSort = (column: string) => {
    if (sortBy !== column) {
      setSortBy(column);
      setSortOrder('desc');
    } else if (sortOrder === 'desc') {
      setSortOrder('asc');
    } else {
      setSortBy(null);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const sortIcon = (column: string) => {
    if (sortBy !== column) return <span className="text-gray-300">↕</span>;
    return sortOrder === 'desc' ? <span>↓</span> : <span>↑</span>;
  };

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const limparFiltros = () => {
    setSearch('');
    setPapel('');
    setSchema('');
    setAmbiente('');
    setProtheusStatus('');
    setDataInicio('');
    setDataFim('');
    setRecebimentoInicio('');
    setRecebimentoFim('');
    setPage(1);
  };

  const aplicarFiltros = () => {
    setPage(1);
    void carregar();
  };

  const abrirDetalhe = async (id: number) => {
    setCarregandoDetalhe(true);
    setDetalhe(null);
    try {
      const r = await fiscalApi.get<DetalheResp>(`/cte/recebidos/${id}`);
      setDetalhe(r.data);
    } catch (err) {
      toast.error('Erro ao abrir detalhe', extractApiError(err) ?? undefined);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const [regravandoId, setRegravandoId] = useState<number | null>(null);
  const [regravandoBatch, setRegravandoBatch] = useState(false);

  // Re-tentar habilitado: precisa filtro de status (FALHA_TECNICA ou PROTHEUS_DESISTIU)
  // + janela de data obrigatoria (evita reprocessamento sem criterio temporal)
  const podeRegravarFalhas =
    (protheusStatus === 'FALHA_TECNICA' || protheusStatus === 'PROTHEUS_DESISTIU') &&
    !!dataInicio &&
    !!dataFim;

  const tooltipRegravar = !dataInicio || !dataFim
    ? 'Preencha dataInicio E dataFim no filtro de Emissao'
    : (protheusStatus !== 'FALHA_TECNICA' && protheusStatus !== 'PROTHEUS_DESISTIU')
      ? 'Selecione FALHA_TECNICA ou PROTHEUS_DESISTIU no filtro Status Protheus'
      : `Vai re-tentar TODOS os ${total} docs filtrados`;

  const regravarFalhasFiltradas = async () => {
    const ok = await confirm({
      title: 'Re-tentar gravação Protheus dos filtrados?',
      description:
        `Reseta status PROTHEUS_DESISTIU/FALHA_TECNICA pra null e dispara enriquecimento ` +
        `dos ${total} documentos filtrados (${protheusStatus}, dhEmi entre ${dataInicio} e ${dataFim}). ` +
        `NÃO consome SEFAZ. Pode demorar minutos pra muitas falhas.`,
      variant: 'warning',
      confirmLabel: `Re-tentar ${total} docs`,
    });
    if (!ok) return;
    if (!isDataValida(dataInicio) || !isDataValida(dataFim)) {
      toast.error('Datas inválidas', 'Use formato AAAA-MM-DD nos filtros de Emissão.');
      return;
    }
    setRegravandoBatch(true);
    try {
      const fim = new Date(dataFim + 'T23:59:59.999');
      const inicio = new Date(dataInicio + 'T00:00:00');
      const r = await fiscalApi.post<{
        docsResetados: number;
        enriquecimento: {
          protheusGravados: number;
          protheusJaExistia: number;
          protheusFalhas: number;
        };
      }>('/cte/distribuicao/regravar-falhas', {
        dataInicio: inicio.toISOString(),
        dataFim: fim.toISOString(),
        protheusStatus: [protheusStatus],
        papel: papel || undefined,
      });
      const e = r.data.enriquecimento;
      toast.success(
        'Re-gravação concluída',
        `${r.data.docsResetados} resetados · gravados=${e.protheusGravados} jaExistia=${e.protheusJaExistia} falhas=${e.protheusFalhas}`,
      );
      void carregar();
    } catch (err) {
      toast.error('Falha ao re-gravar', extractApiError(err) ?? undefined);
    } finally {
      setRegravandoBatch(false);
    }
  };

  const [marcandoResolvidaId, setMarcandoResolvidaId] = useState<number | null>(null);
  const [promptDocId, setPromptDocId] = useState<number | null>(null);

  const confirmarMarcarResolvida = async (observacao: string) => {
    const id = promptDocId;
    setPromptDocId(null);
    if (id === null) return;
    setMarcandoResolvidaId(id);
    try {
      await fiscalApi.post(`/cte/recebidos/${id}/marcar-resolvida`, {
        observacao: observacao.trim() || undefined,
      });
      toast.success('Inconsistência marcada como resolvida');
      if (detalhe?.documento.id === id) await abrirDetalhe(id);
      void carregar();
    } catch (err) {
      toast.error('Falha ao marcar', extractApiError(err) ?? undefined);
    } finally {
      setMarcandoResolvidaId(null);
    }
  };

  const desmarcarResolvida = async (id: number) => {
    const ok = await confirm({
      title: 'Desmarcar resolução?',
      description:
        'Isso vai remover o registro de "resolvida manualmente". Use só se marcou por engano.',
      variant: 'warning',
      confirmLabel: 'Desmarcar',
    });
    if (!ok) return;

    setMarcandoResolvidaId(id);
    try {
      await fiscalApi.post(`/cte/recebidos/${id}/desmarcar-resolvida`);
      toast.success('Resolução desmarcada');
      if (detalhe?.documento.id === id) await abrirDetalhe(id);
      void carregar();
    } catch (err) {
      toast.error('Falha ao desmarcar', extractApiError(err) ?? undefined);
    } finally {
      setMarcandoResolvidaId(null);
    }
  };

  const regravarLocal = async (id: number) => {
    setRegravandoId(id);
    try {
      const { data } = await fiscalApi.post<{
        ok: boolean;
        chave: string | null;
        statusAnterior: string | null;
        statusNovo: string | null;
        mensagem: string | null;
      }>(`/cte/recebidos/${id}/regravar-protheus-local`);
      if (data.ok) {
        toast.success(
          'Gravação retentada',
          `Status: ${data.statusAnterior ?? '—'} → ${data.statusNovo ?? '—'}`,
        );
      } else {
        toast.warning(
          `Status: ${data.statusAnterior ?? '—'} → ${data.statusNovo ?? '—'}`,
          data.mensagem ?? undefined,
        );
      }
      // Recarrega detalhe
      if (detalhe?.documento.id === id) await abrirDetalhe(id);
      void carregar();
    } catch (err) {
      toast.error('Falha ao regravar', extractApiError(err) ?? undefined);
    } finally {
      setRegravandoId(null);
    }
  };

  const imprimirDacte = async (id: number, chaveLabel?: string) => {
    try {
      const r = await fiscalApi.get(`/cte/recebidos/${id}/dacte`, {
        responseType: 'blob',
      });
      const blob = new Blob([r.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(
        'Falha ao gerar DACTE',
        extractApiError(err) ?? `CT-e ${chaveLabel ?? id}`,
      );
    }
  };

  const enriquecer = async () => {
    setLoading(true);
    try {
      const r = await fiscalApi.post<{
        varridos: number;
        enriquecidos: number;
        comAnomalia: number;
      }>('/cte/distribuicao/enriquecer');
      toast.success(
        'Enriquecimento concluído',
        `${r.data.varridos} varridos, ${r.data.enriquecidos} atualizados${
          r.data.comAnomalia > 0 ? `, ${r.data.comAnomalia} anomalias` : ''
        }`,
      );
      void carregar();
    } catch (err) {
      toast.error('Erro ao enriquecer', extractApiError(err) ?? undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper title="Consulta CT-e — Recebidos">
      <div className="space-y-4">
        {/* Header com info + ações */}
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm text-gray-600">
            <p>
              CT-es recebidos via SEFAZ Distribuição (modo distNSU). Capul é{' '}
              <strong>tomadora/destinatária</strong> — não emite CT-e. Documentos chegam
              automaticamente conforme transportadoras emitem contra a Capul.
            </p>
            <p className="mt-1">
              <Link
                to="/cte/consulta-por-chave"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Consulta por chave (limitada — Nacional não suporta)
                <ExternalLink size={14} />
              </Link>
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <span title="Aplica PapelDetector em CT-es ainda não classificados (papel_capul = NULL) e preenche TOMA/DEST/REM/EXPED/RECEB/AUTXML/TERCEIRO. NÃO consulta SEFAZ — apenas processa XMLs já recebidos. Cron automático roda toda hora no minuto 30; este botão força execução imediata.">
                <Button variant="ghost" onClick={enriquecer} disabled={loading}>
                  <RefreshCw size={16} className="mr-1" />
                  Enriquecer pendentes
                </Button>
              </span>
            )}
            <span title="Recarregar a listagem">
              <Button variant="ghost" onClick={() => carregar()} disabled={loading}>
                <RefreshCw size={16} />
              </Button>
            </span>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter size={16} />
            Filtros
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Chave (parcial)</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ex: 31250500..."
                className="w-full px-3 py-1.5 border rounded text-sm"
                onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Papel da Capul</label>
              <select
                value={papel}
                onChange={(e) => setPapel(e.target.value as any)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              >
                {PAPEL_OPTIONS.map((p) => (
                  <option key={p.v} value={p.v}>
                    {p.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Tipo de documento</label>
              <select
                value={schema}
                onChange={(e) => setSchema(e.target.value as any)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              >
                {SCHEMA_OPTIONS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Ambiente SEFAZ</label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as any)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="1">Produção</option>
                <option value="2">Homologação</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Status Protheus</label>
              <select
                value={protheusStatus}
                onChange={(e) => setProtheusStatus(e.target.value as any)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              >
                <option value="">Todos</option>
                <option value="GRAVADO">✓ GRAVADO</option>
                <option value="GRAVADO_PRENOTA_FALHOU">⚠ Pré-nota pendente</option>
                <option value="GRAVADO_AGUARDANDO_AMARRACAO">⚠ Aguarda amarração</option>
                <option value="JA_EXISTIA">✓ JA_EXISTIA</option>
                <option value="FALHA_TECNICA">✗ FALHA_TECNICA</option>
                <option value="PROTHEUS_DESISTIU">✗ PROTHEUS_DESISTIU</option>
                <option value="NAO_APLICAVEL">— N/A</option>
                <option value="PENDENTE">— Pendente (sem status)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Inconsistência</label>
              <select
                value={inconsistenciaFiltro}
                onChange={(e) => {
                  setInconsistenciaFiltro(e.target.value as any);
                  setPage(1);
                }}
                className="w-full px-3 py-1.5 border rounded text-sm"
              >
                <option value="todas">Todas</option>
                <option value="pendentes">⚠ Pendentes de correção</option>
                <option value="resolvidas">✓ Resolvidas manualmente</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Emissão (de)</label>
              <input
                type="date"
                value={dataInicio}
                min="2020-01-01"
                max="2099-12-31"
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Emissão (até)</label>
              <input
                type="date"
                value={dataFim}
                min="2020-01-01"
                max="2099-12-31"
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label
                className="block text-xs text-gray-600 mb-1"
                title="Data em que o CT-e chegou via distNSU na nossa base (recebido_em)"
              >
                Recebimento (de)
              </label>
              <input
                type="date"
                value={recebimentoInicio}
                min="2020-01-01"
                max="2099-12-31"
                onChange={(e) => setRecebimentoInicio(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              />
            </div>
            <div>
              <label
                className="block text-xs text-gray-600 mb-1"
                title="Data em que o CT-e chegou via distNSU na nossa base (recebido_em)"
              >
                Recebimento (até)
              </label>
              <input
                type="date"
                value={recebimentoFim}
                min="2020-01-01"
                max="2099-12-31"
                onChange={(e) => setRecebimentoFim(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t items-center">
            <Button onClick={aplicarFiltros} disabled={loading}>
              <Search size={16} className="mr-1" />
              Aplicar
            </Button>
            <Button variant="ghost" onClick={limparFiltros} disabled={loading}>
              Limpar
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span title={tooltipRegravar}>
                <Button
                  variant="primary"
                  onClick={regravarFalhasFiltradas}
                  disabled={!podeRegravarFalhas || loading || total === 0}
                  loading={regravandoBatch}
                >
                  <RefreshCw size={14} className="mr-1" />
                  Re-tentar falhas filtradas {podeRegravarFalhas && total > 0 ? `(${total})` : ''}
                </Button>
              </span>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-2 text-sm text-gray-600 border-b flex justify-between">
            <span>
              {total} resultado(s) — página {page} de {Math.max(totalPages, 1)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Chave</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('papelCapul')}
                  >
                    Papel Capul {sortIcon('papelCapul')}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('dhEmi')}
                  >
                    dh Emissão {sortIcon('dhEmi')}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('cnpjConsulente')}
                  >
                    CNPJ Consulente {sortIcon('cnpjConsulente')}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('nsu')}
                  >
                    NSU {sortIcon('nsu')}
                  </th>
                  <th className="px-3 py-2 text-left">Ambiente SEFAZ</th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('recebidoEm')}
                  >
                    Recebido em {sortIcon('recebidoEm')}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => toggleSort('protheusStatus')}
                  >
                    Protheus {sortIcon('protheusStatus')}
                  </th>
                  <th className="px-3 py-2 text-right">Tamanho</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-gray-500">
                      Nenhum CT-e encontrado.
                    </td>
                  </tr>
                )}
                {items.map((it) => {
                  const papelOpt = PAPEL_OPTIONS.find((p) => p.v === it.papelCapul);
                  return (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">
                        {it.chave ? (
                          <Link
                            to={`/cte/consulta-por-chave?chave=${it.chave}`}
                            className="text-blue-600 hover:underline"
                            title="Abrir consulta detalhada (17 abas — paridade com portal SEFAZ)"
                          >
                            {fmtChaveMascara(it.chave)}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{it.schema}</span>
                      </td>
                      <td className="px-3 py-2">
                        {it.papelCapul ? (
                          <span className={`text-xs px-2 py-0.5 rounded ${papelOpt?.cor ?? 'bg-gray-100'}`}>
                            {papelOpt?.l ?? it.papelCapul}
                          </span>
                        ) : it.processadoEm ? (
                          <span className="text-xs text-gray-400">sem papel</span>
                        ) : (
                          <span className="text-xs text-amber-600">aguardando enriquec.</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {it.dhEmi ? new Date(it.dhEmi).toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{it.cnpjConsulente}</td>
                      <td className="px-3 py-2 font-mono text-xs">{it.nsu}</td>
                      <td className="px-3 py-2">
                        <Badge variant={it.ambiente === 1 ? 'red' : 'blue'}>
                          {it.ambiente === 1 ? 'PROD' : 'HOM'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {new Date(it.recebidoEm).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {it.protheusStatus === 'GRAVADO' ? (
                          <span title={`Gravado em SZR010+SZQ010 ${it.protheusGravadoEm ? new Date(it.protheusGravadoEm).toLocaleString('pt-BR') : ''}`}>
                            <Badge variant="green">✓ GRAVADO</Badge>
                          </span>
                        ) : it.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ? (
                          it.inconsistenciaResolvidaEm ? (
                            <span title={`Resolvida manualmente por ${it.inconsistenciaResolvidaPorNome ?? '?'} em ${new Date(it.inconsistenciaResolvidaEm).toLocaleString('pt-BR')}${it.inconsistenciaObservacao ? ` — "${it.inconsistenciaObservacao}"` : ''}`}>
                              <Badge variant="green">✓ Pré-nota resolvida</Badge>
                            </span>
                          ) : (
                            <span title={it.protheusErro ?? 'XML gravado em SZR010+SZQ010, mas a pré-nota falhou. Conclua via UI no Protheus.'}>
                              <Badge variant="yellow">⚠ Pré-nota pendente</Badge>
                            </span>
                          )
                        ) : it.protheusStatus === 'GRAVADO_AGUARDANDO_AMARRACAO' ? (
                          it.inconsistenciaResolvidaEm ? (
                            <span title={`Resolvida manualmente por ${it.inconsistenciaResolvidaPorNome ?? '?'} em ${new Date(it.inconsistenciaResolvidaEm).toLocaleString('pt-BR')}${it.inconsistenciaObservacao ? ` — "${it.inconsistenciaObservacao}"` : ''}`}>
                              <Badge variant="green">✓ Amarração resolvida</Badge>
                            </span>
                          ) : (
                            <span title={it.protheusErro ?? 'XML gravado em SZR010+SZQ010 e pré-nota OK, mas falta amarrar com pedido de compra. Conclua via UI no Protheus.'}>
                              <Badge variant="yellow">⚠ Aguarda amarração</Badge>
                            </span>
                          )
                        ) : it.protheusStatus === 'JA_EXISTIA' ? (
                          <span title="XML já estava em SZR010 (importação manual prévia preservada pelo pré-check)">
                            <Badge variant="green">✓ JA_EXISTIA</Badge>
                          </span>
                        ) : it.protheusStatus === 'FALHA_TECNICA' ? (
                          <span title={it.protheusErro ?? 'Erro técnico — retry no próximo ciclo'}>
                            <Badge variant="red">✗ FALHA</Badge>
                          </span>
                        ) : it.protheusStatus === 'PROTHEUS_DESISTIU' ? (
                          <span title="Limite de 5 tentativas atingido — re-tente manual após cadastrar SA2">
                            <Badge variant="red">✗ DESISTIU</Badge>
                          </span>
                        ) : it.protheusStatus === 'NAO_APLICAVEL' ? (
                          <span title="Gravação não aplicável (ex: ambiente XML difere do Protheus)">
                            <Badge variant="gray">— N/A</Badge>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs" title="Ainda não tentou gravar (flag desligada ou doc novo)">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs">
                        {(it.xmlBytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex gap-1">
                          {(it.schema === 'procCTe' || it.schema === 'procCTeSimp') && (
                            <Button
                              variant="ghost"
                              onClick={() => imprimirDacte(it.id, it.chave ?? undefined)}
                              title="Imprimir DACTE"
                            >
                              <Printer size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            onClick={() => abrirDetalhe(it.id)}
                            disabled={carregandoDetalhe}
                            title="Ver detalhe"
                          >
                            <FileText size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-2 border-t flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={16} />
              </Button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalhe */}
      {(carregandoDetalhe || detalhe) && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-semibold">CT-e — Detalhe</h3>
              <div className="flex items-center gap-2">
                {detalhe &&
                  (detalhe.documento.schema === 'procCTe' ||
                    detalhe.documento.schema === 'procCTeSimp') && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        imprimirDacte(detalhe.documento.id, detalhe.documento.chave ?? undefined)
                      }
                    >
                      <Printer size={14} className="mr-1" />
                      Imprimir DACTE
                    </Button>
                  )}
                <button
                  onClick={() => setDetalhe(null)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {carregandoDetalhe && <p className="text-gray-500">Carregando...</p>}
              {detalhe && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Chave:</span>
                      <div className="font-mono text-xs">
                        {detalhe.documento.chave
                          ? fmtChaveMascara(detalhe.documento.chave)
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Schema:</span> {detalhe.documento.schema}
                    </div>
                    <div>
                      <span className="text-gray-500">Papel Capul:</span>{' '}
                      {detalhe.documento.papelCapul ?? <span className="text-gray-400">—</span>}
                    </div>
                    <div>
                      <span className="text-gray-500">CNPJ Consulente:</span>{' '}
                      <span className="font-mono">{detalhe.documento.cnpjConsulente}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">NSU:</span>{' '}
                      <span className="font-mono">{detalhe.documento.nsu}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">SHA-256:</span>{' '}
                      <span className="font-mono text-xs">{detalhe.documento.xmlSha256.slice(0, 16)}…</span>
                    </div>
                  </div>

                  {/* Bloco "Status Protheus" — só aparece se tem alguma info */}
                  {detalhe.documento.protheusStatus && (
                    <div className="border rounded p-3 bg-slate-50">
                      <h4 className="font-medium text-sm mb-2">Status Protheus (SZR010 + SZQ010)</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-500">Status:</span>{' '}
                          {detalhe.documento.protheusStatus === 'GRAVADO' ||
                          detalhe.documento.protheusStatus === 'JA_EXISTIA' ? (
                            <Badge variant="green">✓ {detalhe.documento.protheusStatus}</Badge>
                          ) : detalhe.documento.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ? (
                            <Badge variant="yellow">⚠ Pré-nota pendente</Badge>
                          ) : detalhe.documento.protheusStatus === 'GRAVADO_AGUARDANDO_AMARRACAO' ? (
                            <Badge variant="yellow">⚠ Aguarda amarração</Badge>
                          ) : detalhe.documento.protheusStatus === 'PROTHEUS_DESISTIU' ? (
                            <Badge variant="red">✗ DESISTIU (limite tentativas)</Badge>
                          ) : (
                            <Badge variant="red">✗ {detalhe.documento.protheusStatus}</Badge>
                          )}
                        </div>
                        {detalhe.documento.protheusGravadoEm && (
                          <div>
                            <span className="text-gray-500">Gravado em:</span>{' '}
                            {new Date(detalhe.documento.protheusGravadoEm).toLocaleString('pt-BR')}
                          </div>
                        )}
                        {typeof detalhe.documento.protheusTentativas === 'number' && (
                          <div>
                            <span className="text-gray-500">Tentativas:</span>{' '}
                            {detalhe.documento.protheusTentativas}
                            {detalhe.documento.protheusStatus === 'PROTHEUS_DESISTIU' && (
                              <span className="text-red-600 ml-1">(limite atingido)</span>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Flags granulares do retorno grvXML — só aparece se o
                          Protheus respondeu (sucesso/falha real, não skip). */}
                      {detalhe.documento.protheusGrvSucesso !== null && (
                        <div className="mt-3 border border-slate-200 rounded p-2 bg-white">
                          <h5 className="text-xs font-semibold text-slate-700 mb-1.5">
                            Resposta detalhada do Protheus:
                          </h5>
                          <ul className="text-xs space-y-0.5">
                            <li>
                              {detalhe.documento.protheusGrvSucesso ? '✅' : '❌'}{' '}
                              <strong>Sucesso geral:</strong>{' '}
                              {detalhe.documento.protheusGrvSucesso ? 'sim' : 'não'}
                            </li>
                            <li>
                              {detalhe.documento.protheusGrvXmlGravado ? '✅' : '❌'}{' '}
                              <strong>XML em SZR010+SZQ010:</strong>{' '}
                              {detalhe.documento.protheusGrvXmlGravado ? 'gravado' : 'não gravado'}
                            </li>
                            {detalhe.documento.protheusGrvJaExistia && (
                              <li>
                                ↻ <strong>Idempotência:</strong> XML já estava em SZR010+SZQ010 (gravado por execução prévia)
                              </li>
                            )}
                            <li>
                              {detalhe.documento.protheusGrvPrenotaFalhou ? '❌' : '✅'}{' '}
                              <strong>Pré-nota (U_PRENF/U_NFeSaida):</strong>{' '}
                              {detalhe.documento.protheusGrvPrenotaFalhou ? 'falhou' : 'ok'}
                            </li>
                            <li>
                              {detalhe.documento.protheusGrvPendAmarracao ? '⚠️' : '✅'}{' '}
                              <strong>Amarração com pedido:</strong>{' '}
                              {detalhe.documento.protheusGrvPendAmarracao ? 'pendente' : 'ok'}
                            </li>
                          </ul>
                        </div>
                      )}
                      {detalhe.documento.protheusErro && (
                        <div className="mt-2">
                          <span className="text-gray-500 text-xs">
                            {detalhe.documento.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ||
                            detalhe.documento.protheusStatus === 'GRAVADO_AGUARDANDO_AMARRACAO'
                              ? 'Mensagem do Protheus:'
                              : 'Último erro:'}
                          </span>
                          {detalhe.documento.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ||
                          detalhe.documento.protheusStatus === 'GRAVADO_AGUARDANDO_AMARRACAO' ? (
                            <pre className="mt-1 bg-yellow-50 border border-yellow-300 rounded p-2 text-xs text-yellow-900 whitespace-pre-wrap break-all">
                              {detalhe.documento.protheusErro}
                            </pre>
                          ) : (
                            <pre className="mt-1 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800 whitespace-pre-wrap break-all">
                              {detalhe.documento.protheusErro}
                            </pre>
                          )}
                        </div>
                      )}
                      {(detalhe.documento.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ||
                        detalhe.documento.protheusStatus === 'GRAVADO_AGUARDANDO_AMARRACAO') && (
                        detalhe.documento.inconsistenciaResolvidaEm ? (
                          // Já marcado como resolvido manualmente
                          <div className="mt-3 rounded border border-green-300 bg-green-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-xs text-green-900 flex-1">
                                <p className="font-semibold mb-1">✓ Inconsistência resolvida manualmente no Protheus</p>
                                <p>
                                  Por <strong>{detalhe.documento.inconsistenciaResolvidaPorNome ?? '?'}</strong>
                                  {' '}em{' '}
                                  {new Date(detalhe.documento.inconsistenciaResolvidaEm).toLocaleString('pt-BR')}
                                </p>
                                {detalhe.documento.inconsistenciaObservacao && (
                                  <p className="mt-1 italic text-green-700">
                                    "{detalhe.documento.inconsistenciaObservacao}"
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="secondary"
                                onClick={() => desmarcarResolvida(detalhe.documento.id)}
                                loading={marcandoResolvidaId === detalhe.documento.id}
                              >
                                Desmarcar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Pendente — bloco amarelo + botão de marcar
                          <div className="mt-3 rounded border border-yellow-300 bg-yellow-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <span className="text-xs text-yellow-900 flex-1">
                                {detalhe.documento.protheusStatus === 'GRAVADO_PRENOTA_FALHOU' ? (
                                  <>
                                    <strong>Sucesso parcial:</strong> XML em SZR010+SZQ010 (XMLCAB/XMLIT) OK,
                                    mas a pré-nota (U_PRENF/U_NFeSaida) falhou. Conclua manualmente via UI no
                                    Protheus — re-tentar aqui não ajuda (root cause é validação no ERP).
                                  </>
                                ) : (
                                  <>
                                    <strong>Sucesso parcial:</strong> XML em SZR010+SZQ010 e pré-nota OK,
                                    mas falta amarrar com pedido de compra. Conclua manualmente via UI no
                                    Protheus — re-tentar aqui não ajuda.
                                  </>
                                )}
                              </span>
                              <Button
                                variant="primary"
                                onClick={() => setPromptDocId(detalhe.documento.id)}
                                loading={marcandoResolvidaId === detalhe.documento.id}
                              >
                                ✓ Marcar resolvida
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                      {(detalhe.documento.protheusStatus === 'FALHA_TECNICA' ||
                        detalhe.documento.protheusStatus === 'PROTHEUS_DESISTIU') && (
                        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-amber-900">
                            Re-tentar gravação no Protheus (sem consumir SEFAZ — usa o XML do
                            cache local). Útil após cadastrar SA2 da transportadora ou quando
                            equipe Protheus resolver bug de duplicação.
                          </span>
                          <Button
                            variant="primary"
                            onClick={() => regravarLocal(detalhe.documento.id)}
                            loading={regravandoId === detalhe.documento.id}
                          >
                            <RefreshCw size={14} className="mr-1" />
                            Re-tentar
                          </Button>
                        </div>
                      )}
                      {detalhe.documento.protheusGrvRequest && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500 text-xs">
                              Request enviado ao Protheus (debug — copiar pra equipe Protheus):
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(detalhe.documento.protheusGrvRequest ?? '');
                                toast.success('JSON copiado pra área de transferência');
                              }}
                              className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200"
                            >
                              📋 Copiar JSON
                            </button>
                          </div>
                          <pre className="bg-slate-100 border border-slate-300 rounded p-2 text-xs text-slate-700 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                            {detalhe.documento.protheusGrvRequest}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {detalhe.eventos.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Eventos vinculados ({detalhe.eventos.length})</h4>
                      <div className="border rounded divide-y">
                        {detalhe.eventos.map((ev) => (
                          <div key={ev.id} className="p-2 text-xs">
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {ev.tipoEvento} (tp={ev.tpEventoNum})
                              </span>
                              <span className="text-gray-500">
                                {new Date(ev.dhEvento).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <div className="text-gray-600">
                              cStat={ev.cStat} • {ev.xMotivo}
                              {ev.protocolo && ` • protocolo=${ev.protocolo}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-sm mb-2">XML completo</h4>
                    <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto max-h-96">
                      {detalhe.documento.xml}
                    </pre>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <PromptDialog
        open={promptDocId !== null}
        title="Marcar inconsistência como resolvida"
        description="Confirma que a pendência foi resolvida manualmente no Protheus?"
        label="Observação"
        placeholder='Ex: "cadastrado SA2 da BRASPRESS e concluí pré-nota"'
        inputType="textarea"
        rows={3}
        maxLength={500}
        confirmLabel="Marcar resolvida"
        onConfirm={confirmarMarcarResolvida}
        onCancel={() => setPromptDocId(null)}
      />
    </PageWrapper>
  );
}
