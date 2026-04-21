import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  Lock,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { extractApiError } from '../utils/errors';
import { downloadExcel, formatDataCurto } from '../utils/export';
import type { VinculoProtheus } from '../types';

type Criticidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
type StatusDiv = 'ABERTA' | 'RESOLVIDA' | 'IGNORADA';

interface Divergencia {
  id: string;
  contribuinteId: string;
  campo: string;
  valorProtheus: string | null;
  valorSefaz: string | null;
  criticidade: Criticidade;
  status: StatusDiv;
  detectadaEm: string;
  resolvidaEm: string | null;
  resolvidaPor: string | null;
}

interface ContribuinteAgrupado {
  contribuinte: {
    id: string;
    cnpj: string;
    uf: string;
    razaoSocial: string | null;
    nomeFantasia: string | null;
    inscricaoEstadual: string | null;
    situacao: string;
    enderecoMunicipio: string | null;
    vinculosProtheus: VinculoProtheus[] | null;
  };
  divergencias: Divergencia[];
  total: number;
  criticidadeMax: Criticidade;
  detectadaEmMaisAntiga: string;
}

interface ListAgrupadaResp {
  total: number;
  totalDivergencias: number;
  take: number;
  skip: number;
  items: ContribuinteAgrupado[];
}

const CAMPOS_DISPONIVEIS = [
  { v: '', l: 'Todos' },
  { v: 'razao_social', l: 'Razão social' },
  { v: 'inscricao_estadual', l: 'Inscrição estadual' },
  { v: 'endereco_municipio', l: 'Município' },
  { v: 'endereco_cep', l: 'CEP' },
  { v: 'cnae', l: 'CNAE' },
  { v: 'situacao', l: 'Situação' },
];

const CAMPO_LABEL: Record<string, string> = {
  razao_social: 'Razão social',
  inscricao_estadual: 'IE',
  endereco_municipio: 'Município',
  endereco_cep: 'CEP',
  endereco_logradouro: 'Logradouro',
  endereco_bairro: 'Bairro',
  endereco_numero: 'Número',
  cnae: 'CNAE',
  situacao: 'Situação',
  nome_fantasia: 'Nome fantasia',
  regime_tributario: 'Regime tributário',
};

export function DivergenciasListPage() {
  const [data, setData] = useState<ListAgrupadaResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusDiv | ''>('ABERTA');
  const [filtroCriticidade, setFiltroCriticidade] = useState<Criticidade | ''>('');
  const [filtroUf, setFiltroUf] = useState('');
  const [filtroCampo, setFiltroCampo] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [atuandoEm, setAtuandoEm] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroCriticidade) params.set('criticidade', filtroCriticidade);
      if (filtroUf) params.set('uf', filtroUf);
      if (filtroCampo) params.set('campo', filtroCampo);
      params.set('limit', '200');
      const { data: resp } = await fiscalApi.get<ListAgrupadaResp>(
        `/divergencias/por-contribuinte?${params.toString()}`,
      );
      setData(resp);
    } catch (err) {
      toast.error('Falha ao carregar divergências', extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filtroStatus, filtroCriticidade, filtroUf, filtroCampo, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleExpand(id: string) {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAcaoEmLote(item: ContribuinteAgrupado, acao: 'resolver-todas' | 'ignorar-todas') {
    const resolvendo = acao === 'resolver-todas';
    const ok = await confirm({
      title: resolvendo
        ? `Marcar TODAS as ${item.total} divergências como resolvidas?`
        : `Ignorar TODAS as ${item.total} divergências deste contribuinte?`,
      description: resolvendo
        ? `Confirma que o cadastro do Protheus de ${item.contribuinte.razaoSocial ?? item.contribuinte.cnpj} foi atualizado para bater com o SEFAZ em todos os campos? Esta ação não pode ser revertida em lote.`
        : 'As divergências ficarão arquivadas como ignoradas (falsos positivos). Mantém trilha de auditoria.',
      variant: resolvendo ? 'info' : 'warning',
      confirmLabel: resolvendo ? 'Resolver todas' : 'Ignorar todas',
    });
    if (!ok) return;
    try {
      setAtuandoEm(item.contribuinte.id);
      const { data: resp } = await fiscalApi.patch<{ divergenciasAtualizadas: number }>(
        `/divergencias/por-contribuinte/${item.contribuinte.id}/${acao}`,
        {},
      );
      toast.success(
        resolvendo ? 'Divergências resolvidas' : 'Divergências ignoradas',
        `${resp.divergenciasAtualizadas} divergência(s) atualizadas para ${item.contribuinte.razaoSocial ?? item.contribuinte.cnpj}.`,
      );
      await load();
    } catch (err) {
      toast.error('Falha na ação em lote', extractApiError(err));
    } finally {
      setAtuandoEm(null);
    }
  }

  async function handleAcaoIndividual(divId: string, novoStatus: 'RESOLVIDA' | 'IGNORADA') {
    try {
      await fiscalApi.patch(`/divergencias/${divId}`, { status: novoStatus });
      toast.success(novoStatus === 'RESOLVIDA' ? 'Divergência resolvida' : 'Divergência ignorada');
      await load();
    } catch (err) {
      toast.error('Falha ao atualizar', extractApiError(err));
    }
  }

  function handleExportar() {
    if (!data || data.items.length === 0) {
      toast.info('Nada a exportar', 'Não há divergências com os filtros atuais.');
      return;
    }
    setExportando(true);
    try {
      const headers = [
        'CNPJ',
        'UF',
        'Razão Social',
        'Nome Fantasia',
        'Vínculos Protheus',
        'IE Protheus',
        'Município',
        'Situação SEFAZ',
        'Campo divergente',
        'Valor Protheus',
        'Valor SEFAZ',
        'Criticidade',
        'Status',
        'Detectada em',
        'Resolvida em',
        'Nº divergências do CNPJ',
      ];

      // Cada linha = 1 divergência, mas todas divergências do mesmo CNPJ
      // ficam juntas — organização reflete o fluxo de correção no ERP.
      const rows: (string | number | null | undefined)[][] = [];
      for (const item of data.items) {
        // Formata vínculos como "A05762-0001 (C) | E01047-0001 (F)" — códigos
        // que o setor de cadastro usa para encontrar o registro no Protheus.
        const vinculosStr = (item.contribuinte.vinculosProtheus ?? [])
          .map(
            (v) =>
              `${v.codigo}-${v.loja} (${v.origem === 'SA1010' ? 'C' : 'F'}${v.bloqueado ? ' BLOQ' : ''})`,
          )
          .join(' | ');

        for (const d of item.divergencias) {
          rows.push([
            item.contribuinte.cnpj,
            item.contribuinte.uf,
            item.contribuinte.razaoSocial ?? '',
            item.contribuinte.nomeFantasia ?? '',
            vinculosStr,
            item.contribuinte.inscricaoEstadual ?? '',
            item.contribuinte.enderecoMunicipio ?? '',
            item.contribuinte.situacao,
            CAMPO_LABEL[d.campo] ?? d.campo,
            d.valorProtheus ?? '',
            d.valorSefaz ?? '',
            d.criticidade,
            d.status,
            formatDataCurto(d.detectadaEm),
            formatDataCurto(d.resolvidaEm),
            item.total,
          ]);
        }
      }

      const agora = new Date().toISOString().slice(0, 10);
      downloadExcel(
        `divergencias_protheus_sefaz_${agora}`,
        'Divergências',
        headers,
        rows,
      );
      toast.success('Exportado', `${rows.length} divergência(s) em ${data.items.length} contribuinte(s).`);
    } catch (err) {
      toast.error('Falha ao exportar', err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setExportando(false);
    }
  }

  const statsTopo = useMemo(() => {
    if (!data) return null;
    const porCriticidade = { CRITICA: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 };
    for (const item of data.items) {
      porCriticidade[item.criticidadeMax]++;
    }
    return porCriticidade;
  }, [data]);

  return (
    <PageWrapper title="Divergências Protheus × SEFAZ">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Discrepâncias entre o cadastro do Protheus (SA1010/SA2010) e os dados oficiais do SEFAZ
        detectadas no cruzamento cadastral. Agrupadas por contribuinte — mesma entidade com
        múltiplos campos divergentes aparece como uma linha única expansível, facilitando o
        ajuste completo no ERP de uma só vez.
      </div>

      {/* Filtros + Export */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <FilterSelect
          label="Status"
          value={filtroStatus}
          options={[
            { v: '', l: 'Todos' },
            { v: 'ABERTA', l: 'Abertas' },
            { v: 'RESOLVIDA', l: 'Resolvidas' },
            { v: 'IGNORADA', l: 'Ignoradas' },
          ]}
          onChange={(v) => setFiltroStatus(v as StatusDiv | '')}
        />
        <FilterSelect
          label="Criticidade"
          value={filtroCriticidade}
          options={[
            { v: '', l: 'Todas' },
            { v: 'CRITICA', l: 'Crítica' },
            { v: 'ALTA', l: 'Alta' },
            { v: 'MEDIA', l: 'Média' },
            { v: 'BAIXA', l: 'Baixa' },
          ]}
          onChange={(v) => setFiltroCriticidade(v as Criticidade | '')}
        />
        <FilterSelect
          label="Campo"
          value={filtroCampo}
          options={CAMPOS_DISPONIVEIS}
          onChange={setFiltroCampo}
        />
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <span className="font-medium">UF:</span>
          <input
            type="text"
            value={filtroUf}
            onChange={(e) => setFiltroUf(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            placeholder="MG"
            className="w-16 rounded border border-slate-300 px-2 py-1 font-mono uppercase"
          />
        </label>

        <div className="ml-auto">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={handleExportar}
            loading={exportando}
            disabled={!data || data.items.length === 0}
          >
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Stats agregados */}
      {data && data.items.length > 0 && (
        <div className="mb-4 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm">
          <span>
            <strong className="text-slate-900">{data.totalDivergencias}</strong> divergência(s) em{' '}
            <strong className="text-slate-900">{data.total}</strong> contribuinte(s)
          </span>
          {statsTopo && (
            <div className="flex items-center gap-2">
              {statsTopo.CRITICA > 0 && (
                <Badge variant="red">{statsTopo.CRITICA} crítica(s)</Badge>
              )}
              {statsTopo.ALTA > 0 && <Badge variant="red">{statsTopo.ALTA} alta(s)</Badge>}
              {statsTopo.MEDIA > 0 && <Badge variant="yellow">{statsTopo.MEDIA} média(s)</Badge>}
              {statsTopo.BAIXA > 0 && <Badge variant="gray">{statsTopo.BAIXA} baixa(s)</Badge>}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          Nenhuma divergência encontrada com os filtros atuais.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="w-8 px-2 py-2"></th>
                <th className="px-4 py-2">CNPJ / UF</th>
                <th className="px-4 py-2">Razão social</th>
                <th className="px-4 py-2">Campos divergentes</th>
                <th className="px-4 py-2">Criticidade</th>
                <th className="px-4 py-2">Detectada</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            {data.items.map((item, idx) => {
              const aberto = expandidos.has(item.contribuinte.id);
              return (
                <ContribuinteRow
                  key={item.contribuinte.id}
                  item={item}
                  index={idx}
                  aberto={aberto}
                  atuando={atuandoEm === item.contribuinte.id}
                  onToggle={() => toggleExpand(item.contribuinte.id)}
                  onAcaoLote={handleAcaoEmLote}
                  onAcaoIndividual={handleAcaoIndividual}
                />
              );
            })}
          </table>
        </div>
      )}
    </PageWrapper>
  );
}

/**
 * Linha principal da tabela — um contribuinte com suas N divergências.
 * Se aberto, renderiza linha adicional com a tabela de detalhe (campo por campo).
 */
function ContribuinteRow({
  item,
  index,
  aberto,
  atuando,
  onToggle,
  onAcaoLote,
  onAcaoIndividual,
}: {
  item: ContribuinteAgrupado;
  index: number;
  aberto: boolean;
  atuando: boolean;
  onToggle: () => void;
  onAcaoLote: (item: ContribuinteAgrupado, acao: 'resolver-todas' | 'ignorar-todas') => void;
  onAcaoIndividual: (divId: string, status: 'RESOLVIDA' | 'IGNORADA') => void;
}) {
  // Campos únicos das divergências — badge por tipo com cor baseada na criticidade
  // mais alta daquele campo específico.
  const campoAgrupado = new Map<string, Criticidade>();
  for (const d of item.divergencias) {
    const atual = campoAgrupado.get(d.campo);
    if (!atual || CRITICIDADE_PESO[d.criticidade] > CRITICIDADE_PESO[atual]) {
      campoAgrupado.set(d.campo, d.criticidade);
    }
  }
  const camposBadges = Array.from(campoAgrupado.entries());
  const temAbertas = item.divergencias.some((d) => d.status === 'ABERTA');

  const vinculos = item.contribuinte.vinculosProtheus ?? [];
  const primeiroVinculo = vinculos[0];
  const demaisVinculos = vinculos.length - 1;

  /*
   * Algumas linhas de `cadastro_contribuinte.vinculos_protheus` vêm incompletas
   * do worker do cruzamento (só loja/codigo/filial/origem, sem razaoSocial nem
   * inscricaoEstadual). Mas o dado EXISTE — está em `divergencia.valorProtheus`
   * para os campos razao_social / inscricao_estadual.
   *
   * Aqui a UI faz o "best-effort merge": se o vínculo não trouxer o campo,
   * usamos o valor Protheus da divergência correspondente. Se não houver
   * divergência daquele campo (porque Protheus bate com SEFAZ), o valor
   * canônico é o próprio `contribuinte.razaoSocial` / `inscricaoEstadual`
   * (que é alimentado do SEFAZ, mas é idêntico ao Protheus nesse cenário).
   *
   * Backlog: corrigir o worker para gravar vinculos_protheus completos.
   */
  const divRazao = item.divergencias.find((d) => d.campo === 'razao_social');
  const divIE = item.divergencias.find((d) => d.campo === 'inscricao_estadual');
  const razaoProtheus =
    divRazao?.valorProtheus ??
    primeiroVinculo?.razaoSocial ??
    item.contribuinte.razaoSocial ??
    null;
  const ieProtheus =
    divIE?.valorProtheus ??
    primeiroVinculo?.inscricaoEstadual ??
    item.contribuinte.inscricaoEstadual ??
    null;

  // Zebra-stripe por contribuinte (não por linha de divergência): linhas do
  // MESMO contribuinte (principal + expansão) compartilham a mesma cor de
  // fundo, e contribuintes consecutivos alternam entre branco e cinza claro.
  // Quando expandido, o grupo inteiro vai para um tom azul-claro + borda
  // lateral colorida amarrando visualmente "tudo isso é 1 CNPJ".
  //
  // Truque: cada contribuinte vira seu próprio <tbody>. HTML permite múltiplos
  // tbody numa table, e <tbody> aceita border-left nativamente (coisa que <tr>
  // não faz de forma confiável em tabelas). Também fica mais semântico.
  const corFundoGrupo = aberto
    ? 'bg-blue-50'
    : index % 2 === 0
      ? 'bg-white'
      : 'bg-slate-50';
  const bordaLateral = aberto
    ? 'border-l-4 border-l-capul-500'
    : 'border-l-4 border-l-transparent';
  const bordaTopoGrupo = index > 0 ? 'border-t-[3px] border-t-slate-200' : '';

  return (
    <tbody className={`${corFundoGrupo} ${bordaLateral} ${bordaTopoGrupo} transition-colors`}>
      <tr
        className="cursor-pointer text-xs hover:brightness-[0.97]"
        onClick={onToggle}
      >
        <td className="px-2 py-3 text-center text-slate-400">
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
        <td className="px-4 py-3 font-mono text-slate-800">
          {item.contribuinte.cnpj}
          <span className="ml-1 text-slate-400">/{item.contribuinte.uf}</span>
        </td>
        <td className="px-4 py-3 text-slate-800">
          {/*
            Razão social + identificação Protheus inline. Padrão: "A05762-0001  RAZÃO"
            com chip Cliente/Fornecedor. Se tiver múltiplos vínculos (empresa é cliente
            E fornecedor, múltiplas lojas), mostra um contador "+N" que fica explícito
            na expansão.
          */}
          {primeiroVinculo ? (
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight text-slate-800">
                {primeiroVinculo.codigo}-{primeiroVinculo.loja}
              </span>
              <span
                className="font-medium text-slate-900"
                title={
                  divRazao
                    ? `Protheus: ${razaoProtheus ?? '—'}\nSEFAZ: ${item.contribuinte.razaoSocial ?? '—'}`
                    : undefined
                }
              >
                {razaoProtheus ?? '-'}
              </span>
              <span
                className={`rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                  primeiroVinculo.origem === 'SA1010'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}
                title={
                  primeiroVinculo.origemDescricao ??
                  (primeiroVinculo.origem === 'SA1010' ? 'Cliente' : 'Fornecedor')
                }
              >
                {primeiroVinculo.origem === 'SA1010' ? 'C' : 'F'}
              </span>
              {primeiroVinculo.bloqueado && (
                <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-red-700" title="Bloqueado no Protheus">
                  <Lock className="h-2.5 w-2.5" /> BLOQ
                </span>
              )}
              {demaisVinculos > 0 && (
                <span
                  className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                  title={`Mais ${demaisVinculos} vínculo(s) — expanda para ver`}
                >
                  +{demaisVinculos}
                </span>
              )}
            </div>
          ) : (
            <div className="font-medium">{item.contribuinte.razaoSocial ?? '-'}</div>
          )}
          {item.contribuinte.nomeFantasia &&
            item.contribuinte.nomeFantasia !== item.contribuinte.razaoSocial && (
              <div className="mt-0.5 text-[10px] text-slate-500">
                {item.contribuinte.nomeFantasia}
              </div>
            )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {camposBadges.map(([campo, crit]) => (
              <span
                key={campo}
                className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  crit === 'CRITICA' || crit === 'ALTA'
                    ? 'bg-red-100 text-red-700'
                    : crit === 'MEDIA'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-700'
                }`}
                title={`${CAMPO_LABEL[campo] ?? campo} — ${crit}`}
              >
                {CAMPO_LABEL[campo] ?? campo}
              </span>
            ))}
            <span className="ml-1 text-[10px] text-slate-400">({item.total})</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant={corCriticidade(item.criticidadeMax)}>{item.criticidadeMax}</Badge>
        </td>
        <td className="px-4 py-3 text-slate-500">{formatDataCurto(item.detectadaEmMaisAntiga)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {temAbertas ? (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                onClick={() => onAcaoLote(item, 'resolver-todas')}
                loading={atuando}
                disabled={atuando}
              >
                Resolver todas
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onAcaoLote(item, 'ignorar-todas')}
                disabled={atuando}
              >
                Ignorar todas
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Todas tratadas
            </span>
          )}
        </td>
      </tr>
      {aberto && (
        <tr>
          <td></td>
          <td colSpan={6} className="px-4 py-4 space-y-4">
            {/* Link para Consulta Cadastral — abre /cadastro com cnpj+uf já
                preenchidos e dispara consulta automaticamente. Permite ao
                analista ver a situação atual na SEFAZ sem perder o contexto
                desta lista (se abrir com Ctrl+click, vai para nova aba). */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-xs text-blue-900">
                Precisa confirmar a situação atual na SEFAZ antes de ajustar no Protheus?
              </span>
              <Link
                to={`/cadastro?cnpj=${item.contribuinte.cnpj}&uf=${item.contribuinte.uf}&auto=1`}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-900"
              >
                <Search className="h-3.5 w-3.5" />
                Consultar cadastro no SEFAZ
              </Link>
            </div>

            {vinculos.length > 0 && (
              <VinculosProtheusTabela
                vinculos={vinculos}
                razaoFallback={razaoProtheus}
                ieFallback={ieProtheus}
              />
            )}

            <DetalheDivergencias
              divergencias={item.divergencias}
              onAcao={onAcaoIndividual}
            />
          </td>
        </tr>
      )}
    </tbody>
  );
}

/**
 * Tabela interna mostrando todos os vínculos do contribuinte com as tabelas
 * SA1010 (clientes) e SA2010 (fornecedores) do Protheus. Mesmo CNPJ pode ter
 * múltiplos vínculos quando a entidade é cliente E fornecedor, ou tem
 * múltiplos códigos (cadastro duplicado — comum em bases legadas).
 */
function VinculosProtheusTabela({
  vinculos,
  razaoFallback,
  ieFallback,
}: {
  vinculos: VinculoProtheus[];
  razaoFallback: string | null;
  ieFallback: string | null;
}) {
  // Mapa visual: SA1010 → Cliente, SA2010 → Fornecedor. Dataset legado às vezes
  // não traz `origemDescricao`, então derivamos para garantir consistência visual.
  const labelOrigem = (v: VinculoProtheus) =>
    v.origemDescricao ?? (v.origem === 'SA1010' ? 'Cliente' : 'Fornecedor');

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Vínculos no Protheus ({vinculos.length})
      </div>
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2">Origem</th>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Loja</th>
            <th className="px-3 py-2">Razão social no Protheus</th>
            <th className="px-3 py-2">IE no Protheus</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {vinculos.map((v, i) => {
            const razao = v.razaoSocial ?? razaoFallback;
            const ie = v.inscricaoEstadual ?? ieFallback;
            return (
              <tr
                key={`${v.origem}-${v.codigo}-${v.loja}-${i}`}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      v.origem === 'SA1010'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {labelOrigem(v)}
                  </span>
                  <span className="ml-1 text-[10px] text-slate-400">({v.origem})</span>
                </td>
                <td className="px-3 py-2 font-mono font-semibold text-slate-800">{v.codigo}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{v.loja}</td>
                <td className="px-3 py-2 text-slate-700">{razao ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{ie ?? '—'}</td>
                <td className="px-3 py-2">
                  {v.bloqueado ? (
                    <span className="inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      <Lock className="h-3 w-3" /> Bloqueado
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700">Ativo</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tabela interna mostrando cada divergência lado a lado (Protheus × SEFAZ),
 * útil quando o analista quer resolver apenas uma das divergências (ex: um
 * campo já foi ajustado, o outro não).
 */
function DetalheDivergencias({
  divergencias,
  onAcao,
}: {
  divergencias: Divergencia[];
  onAcao: (divId: string, status: 'RESOLVIDA' | 'IGNORADA') => void;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2">Campo</th>
            <th className="px-3 py-2">Valor Protheus</th>
            <th className="px-3 py-2">Valor SEFAZ</th>
            <th className="px-3 py-2">Criticidade</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {divergencias.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 last:border-b-0">
              <td className="px-3 py-2 font-medium text-slate-800">
                {CAMPO_LABEL[d.campo] ?? d.campo}
              </td>
              <td className="px-3 py-2 font-mono text-slate-700">{d.valorProtheus ?? '—'}</td>
              <td className="px-3 py-2 font-mono text-slate-700">{d.valorSefaz ?? '—'}</td>
              <td className="px-3 py-2">
                <Badge variant={corCriticidade(d.criticidade)}>{d.criticidade}</Badge>
              </td>
              <td className="px-3 py-2">
                {d.status === 'ABERTA' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    Aberta
                  </span>
                ) : (
                  <Badge variant={d.status === 'RESOLVIDA' ? 'green' : 'gray'}>{d.status}</Badge>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {d.status === 'ABERTA' ? (
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onAcao(d.id, 'RESOLVIDA')}
                      className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Resolver
                    </button>
                    <button
                      onClick={() => onAcao(d.id, 'IGNORADA')}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Ignorar
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">
                    {d.resolvidaEm ? formatDataCurto(d.resolvidaEm) : '-'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; l: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

const CRITICIDADE_PESO: Record<Criticidade, number> = {
  CRITICA: 4,
  ALTA: 3,
  MEDIA: 2,
  BAIXA: 1,
};

function corCriticidade(c: Criticidade): 'red' | 'yellow' | 'blue' | 'gray' {
  if (c === 'CRITICA' || c === 'ALTA') return 'red';
  if (c === 'MEDIA') return 'yellow';
  return 'gray';
}
