import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Copy, Sparkles, AlertTriangle, Database, UserSearch, Info, Building2, GitCompareArrows, MapPin, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { extractApiError } from '../utils/errors';
import { Row } from '../components/Row';
import { fmtCnpj, fmtCep } from '../utils/format';
import type {
  CadastroConsultaResult,
  CruzamentoIeProtheusSefaz,
  InscricaoEstadualSefaz,
  SituacaoCadastral,
  StatusCruzamentoIe,
  VinculoProtheus,
} from '../types';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const SITUACAO_VARIANT: Record<SituacaoCadastral, 'green' | 'yellow' | 'red' | 'gray'> = {
  HABILITADO: 'green',
  NAO_HABILITADO: 'red',
  SUSPENSO: 'yellow',
  INAPTO: 'red',
  BAIXADO: 'red',
  DESCONHECIDO: 'gray',
};

const SITUACAO_LABEL: Record<SituacaoCadastral, string> = {
  HABILITADO: 'Habilitado',
  NAO_HABILITADO: 'Não habilitado',
  SUSPENSO: 'Suspenso',
  INAPTO: 'Inapto',
  BAIXADO: 'Baixado',
  DESCONHECIDO: 'Desconhecido',
};

const CRUZAMENTO_VARIANT: Record<StatusCruzamentoIe, 'green' | 'red' | 'yellow'> = {
  AMBOS: 'green',
  APENAS_PROTHEUS: 'red',
  APENAS_SEFAZ: 'yellow',
};

const CRUZAMENTO_LABEL: Record<StatusCruzamentoIe, string> = {
  AMBOS: 'Protheus + SEFAZ',
  APENAS_PROTHEUS: 'Apenas Protheus',
  APENAS_SEFAZ: 'Apenas SEFAZ',
};

export function CadastroConsultaPage() {
  const [searchParams] = useSearchParams();
  const [documento, setDocumento] = useState('');
  // UF começa vazia (modo auto): o backend deduz a UF a partir dos vínculos
  // Protheus. Se o CNPJ não existir no Protheus, o backend pede UF explícita.
  const [uf, setUf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CadastroConsultaResult | null>(null);
  const [copied, setCopied] = useState(false);
  const autoTriggeredRef = useRef<string | null>(null);

  const docDigits = documento.replace(/\D/g, '');

  async function consultar(cnpjLimpo: string, ufAlvo: string | null) {
    if (cnpjLimpo.length !== 11 && cnpjLimpo.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).');
      return;
    }
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      setLoading(true);
      const { data } = await fiscalApi.post<CadastroConsultaResult>('/cadastro/consulta', {
        cnpj: cnpjLimpo,
        uf: ufAlvo,
      });
      setResult(data);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao consultar CNPJ na SEFAZ.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    // UF vazia é permitida: backend tentará inferir a partir dos vínculos Protheus.
    await consultar(docDigits, uf || null);
  }

  /**
   * Deep-link via query params: outras telas (ex: Divergências) enviam o
   * usuário para cá já preenchido. Se `auto=1`, dispara a consulta
   * automaticamente. A ref evita re-disparo se o componente re-renderizar.
   */
  useEffect(() => {
    const cnpjParam = searchParams.get('cnpj');
    const ufParam = searchParams.get('uf');
    const auto = searchParams.get('auto');
    if (!cnpjParam) return;

    const cnpjLimpo = cnpjParam.replace(/\D/g, '');
    setDocumento(cnpjLimpo);
    const ufFinal = ufParam ? ufParam.toUpperCase() : uf;
    if (ufParam) setUf(ufFinal);

    if (auto === '1' && autoTriggeredRef.current !== cnpjLimpo) {
      autoTriggeredRef.current = cnpjLimpo;
      consultar(cnpjLimpo, ufFinal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleCopyForCadastro() {
    if (!result) return;
    const e = result.endereco;
    const text = [
      `Razão social: ${result.razaoSocial ?? ''}`,
      `Nome fantasia: ${result.nomeFantasia ?? ''}`,
      `CNPJ: ${fmtCnpj(result.cnpj)}`,
      `Inscrição estadual: ${result.inscricaoEstadual ?? ''}`,
      `CNAE: ${result.cnae ?? ''}`,
      `Logradouro: ${e?.logradouro ?? ''}, ${e?.numero ?? ''} ${e?.complemento ?? ''}`,
      `Bairro: ${e?.bairro ?? ''}`,
      `Município: ${e?.municipio ?? ''}`,
      `UF: ${result.uf}`,
      `CEP: ${fmtCep(e?.cep)}`,
      `Situação SEFAZ: ${SITUACAO_LABEL[result.situacao]}`,
      `Data da consulta: ${new Date().toLocaleString('pt-BR')}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <PageWrapper title="Consulta Cadastral (CCC / Sintegra)">
      <p className="mb-4 text-xs text-slate-500">
        Verifique a situação cadastral de um contribuinte no SEFAZ — use para validar um novo
        cliente/fornecedor antes de cadastrá-lo no Protheus, ou para auditar um cadastro existente.
        {' '}
        <span className="text-slate-600">Para auditoria de cadastro já existente, deixe a UF em branco — o sistema descobre as UFs a partir dos vínculos Protheus (até 5).</span>
      </p>

      <form
        onSubmit={handleConsultar}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-80">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              CNPJ ou CPF
            </label>
            <input
              type="text"
              value={documento}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
                if (raw.length <= 11) {
                  setDocumento(raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
                } else {
                  setDocumento(raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'));
                }
              }}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tracking-tight focus:border-slate-500 focus:ring-slate-500"
              required
            />
          </div>
          <div className="w-28">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              UF <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
              title="Deixe em branco para consultar todas as UFs onde o contribuinte tem vínculo no Protheus"
            >
              <option value="">— auto —</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button type="submit" loading={loading}>
              Consultar
            </Button>
          </div>
        </div>
      </form>

      {error && <ErrorDisplay error={error} documento={docDigits} />}

      {result && (
        <div className="space-y-5">
          {/* Banner de estado Protheus */}
          <ProtheusStatusBanner result={result} />

          {/* Vínculos SA1010 / SA2010 — cards lado a lado */}
          {result.vinculosProtheus.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {result.vinculosProtheus.map((v: VinculoProtheus) => (
                <div
                  key={v.origem}
                  className={`rounded-lg border p-4 ${
                    v.bloqueado
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-blue-200 bg-blue-50/40'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={v.bloqueado ? 'red' : 'blue'}>
                      {v.origemDescricao} ({v.origem})
                    </Badge>
                    {v.bloqueado && <Badge variant="red">Bloqueado</Badge>}
                  </div>
                  <div className="text-sm text-slate-900">
                    <div>
                      <span className="text-xs text-slate-500">Código:</span>{' '}
                      <code className="font-mono">{v.codigo}/{v.loja}</code>
                      <span className="ml-2 text-xs text-slate-500">Filial:</span>{' '}
                      <code className="font-mono">{v.filial}</code>
                    </div>
                    {v.razaoSocial && (
                      <div className="mt-1 text-xs text-slate-600">
                        Razão social no Protheus: {v.razaoSocial}
                      </div>
                    )}
                    {v.inscricaoEstadual && (
                      <div className="text-xs text-slate-600">IE no Protheus: {v.inscricaoEstadual}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Divergências entre SA1010 e SA2010 */}
          {result.divergenciasEntreTabelas.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                Divergências entre Cliente (SA1010) e Fornecedor (SA2010)
              </div>
              <p className="mb-3 text-xs text-amber-800">
                Os dados abaixo diferem entre as duas tabelas do Protheus. Recomenda-se
                corrigir no ERP para manter a consistência.
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-amber-800">
                    <th className="py-1 pr-3 font-semibold">Campo</th>
                    <th className="py-1 pr-3 font-semibold">SA1010 (Cliente)</th>
                    <th className="py-1 font-semibold">SA2010 (Fornecedor)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.divergenciasEntreTabelas.map((d, i) => (
                    <tr key={i} className="border-t border-amber-200">
                      <td className="py-1.5 pr-3 font-medium">{d.campo}</td>
                      <td className="py-1.5 pr-3 font-mono">{d.valorSA1010 ?? '(vazio)'}</td>
                      <td className="py-1.5 font-mono">{d.valorSA2010 ?? '(vazio)'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dados SEFAZ (fonte de verdade) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dados oficiais do SEFAZ
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={SITUACAO_VARIANT[result.situacao]}>
                {SITUACAO_LABEL[result.situacao]}
              </Badge>
              {result.mudouSituacao && result.situacaoAnterior && (
                <Badge variant="purple">
                  Mudou de {SITUACAO_LABEL[result.situacaoAnterior]} → {SITUACAO_LABEL[result.situacao]}
                </Badge>
              )}
              {result.dataSituacao && (
                <span className="text-xs text-slate-500">Situação desde {result.dataSituacao}</span>
              )}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Razão social" value={result.razaoSocial ?? '-'} wide />
              {result.nomeFantasia && <Row label="Nome fantasia" value={result.nomeFantasia} wide />}
              <Row label="CNPJ" value={fmtCnpj(result.cnpj)} />
              <Row label="Inscrição estadual" value={result.inscricaoEstadual ?? '-'} />
              <Row label="CNAE principal" value={result.cnae ?? '-'} />
              <Row label="Início de atividade" value={result.inicioAtividade ?? '-'} />
              {result.dataFimAtividade && (
                <Row label="Fim de atividade" value={result.dataFimAtividade} />
              )}
              {result.regimeApuracao && (
                <Row label="Regime de apuração" value={result.regimeApuracao} />
              )}
              {result.ieDestinatario && (
                <Row label="IE como destinatário (NF-e)" value={result.ieDestinatario} />
              )}
              {result.ieDestinatarioCTe && (
                <Row label="IE como destinatário (CT-e)" value={result.ieDestinatarioCTe} />
              )}
              {result.endereco && (
                <>
                  <Row
                    label="Endereço"
                    value={`${result.endereco.logradouro ?? ''}, ${result.endereco.numero ?? ''} - ${result.endereco.bairro ?? ''}`}
                    wide
                  />
                  <Row label="Município / UF" value={`${result.endereco.municipio ?? ''} / ${result.uf}`} />
                  <Row label="CEP" value={fmtCep(result.endereco.cep)} />
                </>
              )}
            </div>

          </div>

          {/* Avisos de auditoria multi-UF */}
          <MultiUfBanners result={result} />

          {/* Detalhamento por IE — só faz sentido quando há mais de uma.
              Produtor rural com várias propriedades, empresa com IEs por
              filial: cada IE tem endereço/CNAE/regime específicos que são
              necessários para cadastrar individualmente no Protheus. */}
          {result.inscricoesSefaz.length > 1 && (
            <InscricoesEstaduaisDetalhadasCard
              inscricoes={result.inscricoesSefaz}
              ufPrincipal={result.uf}
              iePrincipal={result.inscricaoEstadual}
            />
          )}

          {/* Cruzamento de IEs Protheus × SEFAZ */}
          {result.cruzamentoInscricoes.length > 0 && (
            <CruzamentoInscricoesCard
              cruzamento={result.cruzamentoInscricoes}
              ufsConsultadas={result.ufsConsultadas}
            />
          )}

          <ReceitaFederalCard result={result} />

          {/* Bloco de cadastro — só aparece no caso "novo" */}
          {!result.jaCadastradoNoProtheus && !result.enriquecimentoProtheusFalhou && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-900">
                <Sparkles className="h-4 w-4" />
                Pronto para cadastrar no Protheus
              </div>
              <p className="mb-3 text-xs text-emerald-800">
                Os dados acima foram obtidos diretamente do SEFAZ (e da Receita Federal, quando disponível)
                e estão atualizados. Use-os para preencher o cadastro do cliente/fornecedor no Protheus.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCopyForCadastro}
                leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              >
                {copied ? 'Copiado!' : 'Copiar dados formatados'}
              </Button>
            </div>
          )}
        </div>
      )}
    </PageWrapper>
  );
}

function MultiUfBanners({ result }: { result: CadastroConsultaResult }) {
  const multiUf = result.ufsConsultadas.length > 1;
  const temIgnoradas = result.ufsIgnoradasPorCap.length > 0;
  const temFalhas = result.ufsComFalha.length > 0;
  if (!multiUf && !temIgnoradas && !temFalhas) return null;

  return (
    <div className="space-y-2">
      {multiUf && (
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Consulta multi-UF executada. Consultadas {result.ufsConsultadas.length} SEFAZs:
            {' '}
            <span className="font-mono font-semibold">
              {result.ufsConsultadas.join(', ')}
            </span>
            . UFs inferidas a partir dos vínculos Protheus deste contribuinte.
          </div>
        </div>
      )}
      {temIgnoradas && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">UFs não consultadas (cap de proteção SEFAZ)</div>
            <div className="mt-0.5">
              Este contribuinte tem vínculo em mais de 5 UFs. Para preservar o orçamento
              diário de consultas SEFAZ, as UFs abaixo não foram consultadas nesta chamada —
              faça uma consulta individual selecionando cada uma no filtro de UF:
              {' '}
              <span className="font-mono font-semibold">
                {result.ufsIgnoradasPorCap.join(', ')}
              </span>
              .
            </div>
          </div>
        </div>
      )}
      {temFalhas && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">
              Falha técnica em {result.ufsComFalha.length} UF
              {result.ufsComFalha.length > 1 ? 's' : ''}
            </div>
            <ul className="mt-1 space-y-0.5">
              {result.ufsComFalha.map((f) => (
                <li key={f.uf}>
                  <span className="font-mono font-semibold">{f.uf}</span>: {f.erro}
                </li>
              ))}
            </ul>
            <div className="mt-1 text-[11px]">
              Os dados das outras UFs permanecem válidos. Tente novamente em alguns minutos.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InscricoesEstaduaisDetalhadasCard({
  inscricoes,
  ufPrincipal,
  iePrincipal,
}: {
  inscricoes: InscricaoEstadualSefaz[];
  ufPrincipal: string;
  iePrincipal: string | null;
}) {
  // Ordena: primeiro a IE habilitada/principal, depois as demais por UF + IE.
  const ordenadas = [...inscricoes].sort((a, b) => {
    const aPrincipal = a.inscricaoEstadual === iePrincipal && a.uf === ufPrincipal;
    const bPrincipal = b.inscricaoEstadual === iePrincipal && b.uf === ufPrincipal;
    if (aPrincipal && !bPrincipal) return -1;
    if (!aPrincipal && bPrincipal) return 1;
    if (a.uf !== b.uf) return a.uf.localeCompare(b.uf);
    return a.inscricaoEstadual.localeCompare(b.inscricaoEstadual);
  });

  // Estado de expansão por IE — operador clica na linha que quer ver. Set
  // permite múltiplas IEs abertas simultaneamente sem fechar as anteriores.
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set());

  function toggleIe(key: string) {
    setExpandidas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandirTodas() {
    setExpandidas(new Set(ordenadas.map((ie) => `${ie.uf}-${ie.inscricaoEstadual}`)));
  }

  function recolherTodas() {
    setExpandidas(new Set());
  }

  const todasExpandidas = expandidas.size === ordenadas.length && ordenadas.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <MapPin className="h-3.5 w-3.5" />
          Inscrições estaduais ({inscricoes.length})
        </div>
        <button
          type="button"
          onClick={todasExpandidas ? recolherTodas : expandirTodas}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
        >
          {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
        </button>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        Clique em uma linha para ver os dados completos daquela inscrição (razão social,
        endereço, CNAE, regime). Cada IE costuma ter dados próprios — útil para produtor
        rural com várias propriedades ou empresa com filiais.
      </p>

      <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {ordenadas.map((ie) => {
          const key = `${ie.uf}-${ie.inscricaoEstadual}`;
          const ehPrincipal =
            ie.inscricaoEstadual === iePrincipal && ie.uf === ufPrincipal;
          const aberta = expandidas.has(key);
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => toggleIe(key)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
              >
                {aberta ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className="font-mono text-sm font-semibold text-slate-900">
                  {ie.inscricaoEstadual}
                </span>
                <Badge variant="gray">{ie.uf}</Badge>
                <Badge variant={SITUACAO_VARIANT[ie.situacao]}>
                  {SITUACAO_LABEL[ie.situacao]}
                </Badge>
                {ehPrincipal && <Badge variant="blue">Principal</Badge>}
                {ie.nomeFantasia && (
                  <span className="ml-2 truncate text-xs text-slate-600">
                    {ie.nomeFantasia}
                  </span>
                )}
                {ie.dfeHabilitados.length > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-500">
                    <FileText className="h-3 w-3" />
                    {ie.dfeHabilitados.join(' · ')}
                  </span>
                )}
              </button>

              {aberta && (
                <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-4">
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                    {/* Situação IE — combina código cSit + label legível, igual portal SEFAZ.
                        cSit oficial: 0=Não habilitado, 1=Habilitado, 2=Suspenso, 3=Inapto, 4=Baixado, 5=Nulo. */}
                    <Row
                      label="Situação IE"
                      value={`${ie.cSit ?? '?'} - ${SITUACAO_LABEL[ie.situacao]}`}
                    />
                    {ie.dataSituacao && (
                      <Row label="Situação desde (dUltSit)" value={ie.dataSituacao} />
                    )}
                    {ie.razaoSocial && (
                      <Row label="Razão social (xNome)" value={ie.razaoSocial} wide />
                    )}
                    {ie.nomeFantasia && (
                      <Row label="Nome fantasia (xFant)" value={ie.nomeFantasia} wide />
                    )}
                    {ie.cnae && <Row label="CNAE principal" value={ie.cnae} />}
                    {ie.regimeApuracao && (
                      <Row label="Regime de apuração (xRegApur)" value={ie.regimeApuracao} />
                    )}
                    {ie.inicioAtividade && (
                      <Row label="Início de atividade (dIniAtiv)" value={ie.inicioAtividade} />
                    )}
                    {ie.dataFimAtividade && (
                      <Row label="Fim de atividade (dFimAtiv)" value={ie.dataFimAtividade} />
                    )}
                    {/* IE atual — sempre visível (não escondemos quando igual à IE consultada),
                        para o operador ver explícito que o CCC confirmou que não houve substituição. */}
                    {ie.ieAtual && (
                      <Row
                        label="IE atual (IEAtual)"
                        value={
                          ie.ieAtual === ie.inscricaoEstadual
                            ? `${ie.ieAtual} (sem substituição)`
                            : `${ie.ieAtual} (substituição registrada)`
                        }
                      />
                    )}
                    {ie.ieDestinatario && (
                      <Row label="IE como destinatário NF-e (indCredNFe)" value={ie.ieDestinatario} />
                    )}
                    {ie.ieDestinatarioCTe && (
                      <Row label="IE como destinatário CT-e (indCredCTe)" value={ie.ieDestinatarioCTe} />
                    )}
                    {ie.dfeHabilitados.length > 0 && (
                      <Row label="DFe habilitados" value={ie.dfeHabilitados.join(', ')} />
                    )}
                    {ie.endereco && (
                      <>
                        <Row
                          label="Endereço"
                          value={`${ie.endereco.logradouro ?? ''}${ie.endereco.numero ? ', ' + ie.endereco.numero : ''}${ie.endereco.bairro ? ' - ' + ie.endereco.bairro : ''}` || '-'}
                          wide
                        />
                        <Row
                          label="Município / UF"
                          value={`${ie.endereco.municipio ?? '-'} / ${ie.uf}`}
                        />
                        {ie.endereco.cep && <Row label="CEP" value={fmtCep(ie.endereco.cep)} />}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-500">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          Campos como <em>Tipo IE (Produtor Rural)</em>, <em>Porte da Empresa</em>,
          <em> Crédito Presumido</em> e <em>Tipo Produtor</em> aparecem apenas no portal
          SVRS (enriquecimento interno SEFAZ) — não são retornados pelo serviço SOAP
          oficial CCC v4. Se precisar deles, consulte direto no Cadastro Centralizado
          do portal.
        </span>
      </p>
    </div>
  );
}

function CruzamentoInscricoesCard({
  cruzamento,
  ufsConsultadas,
}: {
  cruzamento: CruzamentoIeProtheusSefaz[];
  ufsConsultadas: string[];
}) {
  const totalAmbos = cruzamento.filter((c) => c.status === 'AMBOS').length;
  const totalApenasProtheus = cruzamento.filter((c) => c.status === 'APENAS_PROTHEUS').length;
  const totalApenasSefaz = cruzamento.filter((c) => c.status === 'APENAS_SEFAZ').length;
  const temAlerta = cruzamento.some((c) => c.alertas.length > 0);
  // Mostra coluna UF quando há mais de uma SEFAZ consultada OU quando há
  // diversidade de UFs nos vínculos Protheus (mesmo que só 1 SEFAZ).
  const ufsNoCruzamento = new Set<string>();
  for (const c of cruzamento) {
    if (c.sefaz?.uf) ufsNoCruzamento.add(c.sefaz.uf);
    for (const v of c.vinculosProtheus) {
      if (v.uf) ufsNoCruzamento.add(v.uf);
    }
  }
  const mostrarColunaUF = ufsConsultadas.length > 1 || ufsNoCruzamento.size > 1;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <GitCompareArrows className="h-3.5 w-3.5" />
        Cruzamento de inscrições estaduais — Protheus × SEFAZ
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant="gray">{cruzamento.length} IE{cruzamento.length > 1 ? 's' : ''} no total</Badge>
        {totalAmbos > 0 && (
          <Badge variant="green">{totalAmbos} em ambos</Badge>
        )}
        {totalApenasProtheus > 0 && (
          <Badge variant="red">{totalApenasProtheus} só no Protheus</Badge>
        )}
        {totalApenasSefaz > 0 && (
          <Badge variant="yellow">{totalApenasSefaz} só no SEFAZ</Badge>
        )}
      </div>

      {temAlerta && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Há divergências entre o cadastro do Protheus e o CCC/SEFAZ. Revise os itens
            destacados abaixo — cada linha traz orientação específica para regularização.
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-3">Inscrição estadual</th>
              {mostrarColunaUF && <th className="py-2 pr-3">UF</th>}
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">SEFAZ</th>
              <th className="py-2 pr-3">Protheus</th>
              <th className="py-2">Observações</th>
            </tr>
          </thead>
          <tbody>
            {cruzamento.map((c) => {
              const ufsDaLinha = new Set<string>();
              if (c.sefaz?.uf) ufsDaLinha.add(c.sefaz.uf);
              for (const v of c.vinculosProtheus) {
                if (v.uf) ufsDaLinha.add(v.uf);
              }
              const ufsTexto = Array.from(ufsDaLinha).sort().join(', ') || '-';
              return (
                <tr key={c.inscricaoEstadual} className="border-b border-slate-100 align-top">
                  <td className="py-2.5 pr-3 font-mono text-slate-900">{c.inscricaoEstadual}</td>
                  {mostrarColunaUF && (
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-700">{ufsTexto}</td>
                  )}
                  <td className="py-2.5 pr-3">
                    <Badge variant={CRUZAMENTO_VARIANT[c.status]}>
                      {CRUZAMENTO_LABEL[c.status]}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-700">
                    {c.sefaz ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant={SITUACAO_VARIANT[c.sefaz.situacao]}>
                          {SITUACAO_LABEL[c.sefaz.situacao]}
                        </Badge>
                        {c.sefaz.dataSituacao && (
                          <span className="text-[11px] text-slate-500">
                            desde {c.sefaz.dataSituacao}
                          </span>
                        )}
                        {c.sefaz.regimeApuracao && (
                          <span className="text-[11px] text-slate-500">
                            Regime: {c.sefaz.regimeApuracao}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="italic text-slate-400">não encontrado</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-700">
                    {c.vinculosProtheus.length > 0 ? (
                      <div className="space-y-1">
                        {c.vinculosProtheus.map((v) => (
                          <div
                            key={`${v.origem}-${v.codigo}-${v.loja}-${v.filial}`}
                            className="flex items-center gap-1.5"
                          >
                            <Badge variant={v.bloqueado ? 'red' : 'blue'}>
                              {v.origem}
                            </Badge>
                            <code className="font-mono text-[11px] text-slate-600">
                              {v.codigo}/{v.loja}
                            </code>
                            {v.uf && (
                              <span className="font-mono text-[11px] text-slate-400">
                                {v.uf}
                              </span>
                            )}
                            {v.bloqueado && (
                              <span className="text-[11px] text-red-600">bloqueado</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="italic text-slate-400">sem vínculo</span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-slate-700">
                    {c.alertas.length > 0 ? (
                      <ul className="space-y-1">
                        {c.alertas.map((a, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-amber-800">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Check className="h-3.5 w-3.5" /> consistente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReceitaFederalCard({ result }: { result: CadastroConsultaResult }) {
  // Caso CPF: aviso explicativo de que APIs públicas não cobrem CPF
  if (!result.enriquecimentoReceitaDisponivel && result.enriquecimentoReceitaMotivo) {
    const isCpf = result.cnpj.length === 11;
    return (
      <div className="rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">
                {isCpf ? 'Dados adicionais da Receita Federal — não disponível para CPF' : 'Receita Federal indisponível'}
              </h3>
              <p className="text-xs text-blue-700 mt-0.5">
                Os dados acima vêm apenas do SEFAZ (Cadastro Centralizado de Contribuintes).
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700 space-y-2">
          <p className="text-xs">{result.enriquecimentoReceitaMotivo}</p>
          {isCpf && (
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <strong>Por que isso acontece?</strong> As APIs públicas gratuitas
              (<em>BrasilAPI</em> e <em>ReceitaWS</em>) fornecem apenas dados de
              <strong> CNPJ</strong>. Para consulta completa de <strong>CPF</strong> (situação,
              nome na Receita, porte), seria necessário contratar a
              <strong> API Serpro</strong> (paga, cobrança por consulta). Avalie com o setor
              fiscal se essa necessidade é frequente para justificar a contratação.
            </div>
          )}
        </div>
      </div>
    );
  }

  const r = result.dadosReceita;
  if (!r) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Dados complementares da Receita Federal
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">
            {r.razaoSocial ?? '-'}
          </span>
        </div>
        {r.situacao && (
          <Badge
            variant={
              r.situacao.toUpperCase().includes('ATIVA')
                ? 'green'
                : r.situacao.toUpperCase().includes('SUSP')
                ? 'yellow'
                : 'red'
            }
          >
            {r.situacao}
          </Badge>
        )}
        {r.porte && <Badge variant="gray">{r.porte}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        {r.nomeFantasia && <Row label="Nome fantasia (Receita)" value={r.nomeFantasia} wide />}
        {r.dataAbertura && <Row label="Data de abertura" value={r.dataAbertura} />}
        {r.dataSituacao && <Row label="Data da situação" value={r.dataSituacao} />}
        {r.motivoSituacao && <Row label="Motivo situação" value={r.motivoSituacao} wide />}
        {r.naturezaJuridica && <Row label="Natureza jurídica" value={r.naturezaJuridica} wide />}
        {r.capitalSocial !== null && (
          <Row
            label="Capital social"
            value={`R$ ${r.capitalSocial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          />
        )}
        {r.cnaeFiscal && (
          <Row
            label="CNAE fiscal (Receita)"
            value={`${r.cnaeFiscal}${r.cnaeFiscalDescricao ? ' — ' + r.cnaeFiscalDescricao : ''}`}
            wide
          />
        )}
        {r.telefone && <Row label="Telefone" value={r.telefone} />}
        {r.email && <Row label="E-mail" value={r.email} />}
      </div>

      {r.cnaesSecundarios.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            CNAEs secundários ({r.cnaesSecundarios.length})
          </div>
          <ul className="space-y-1 text-xs text-slate-600">
            {r.cnaesSecundarios.slice(0, 8).map((c, idx) => (
              <li key={idx}>
                <span className="font-mono text-slate-500">{c.codigo}</span> — {c.descricao}
              </li>
            ))}
            {r.cnaesSecundarios.length > 8 && (
              <li className="italic text-slate-400">
                … e mais {r.cnaesSecundarios.length - 8} CNAE(s)
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>
          Fonte:{' '}
          <strong className="text-slate-600">
            {r.fonte === 'BRASILAPI' ? 'BrasilAPI' : 'ReceitaWS'}
          </strong>{' '}
          (API pública gratuita)
        </span>
        <span>
          Consultado em{' '}
          {new Date(r.consultadoEm).toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
}

function ProtheusStatusBanner({ result }: { result: CadastroConsultaResult }) {
  if (result.enriquecimentoProtheusFalhou) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-amber-900">
            Vínculo com o Protheus não verificado
          </div>
          <div className="mt-1 text-xs text-amber-800">
            Os dados do SEFAZ foram obtidos com sucesso, mas a API do Protheus estava
            indisponível no momento — não conseguimos confirmar se este CNPJ já está em
            SA1010 (clientes) ou SA2010 (fornecedores). Tente novamente mais tarde.
          </div>
        </div>
      </div>
    );
  }

  if (result.jaCadastradoNoProtheus) {
    const nVinculos = result.vinculosProtheus.length;
    return (
      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-blue-900">
            Contribuinte cadastrado no Protheus
            {nVinculos === 2 && ' — encontrado em AMBAS as tabelas (Cliente e Fornecedor)'}
            {nVinculos === 1 &&
              ` — ${result.vinculosProtheus[0]?.origemDescricao} (${result.vinculosProtheus[0]?.origem})`}
          </div>
          <div className="mt-1 text-xs text-blue-800">
            {nVinculos === 2
              ? 'Este CNPJ existe em SA1010 (Clientes) e SA2010 (Fornecedores) simultaneamente. Os detalhes de cada cadastro estão nos cards abaixo.'
              : `Código ${result.vinculosProtheus[0]?.codigo}/${result.vinculosProtheus[0]?.loja}${
                  result.vinculosProtheus[0]?.filial
                    ? ` — filial ${result.vinculosProtheus[0].filial}`
                    : ' — cadastro compartilhado entre filiais'
                }.`}
            {result.divergenciasEntreTabelas.length > 0 && (
              <span className="ml-1 font-semibold text-amber-800">
                ⚠ {result.divergenciasEntreTabelas.length} divergência(s) entre as tabelas detectada(s).
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <div className="flex-1 text-sm">
        <div className="font-semibold text-emerald-900">
          Novo contribuinte — não cadastrado no Protheus
        </div>
        <div className="mt-1 text-xs text-emerald-800">
          Este CNPJ não foi encontrado em SA1010 nem SA2010. Os dados do SEFAZ abaixo estão
          prontos para você usar no próximo cadastro de cliente/fornecedor no ERP.
        </div>
      </div>
    </div>
  );
}

function ErrorDisplay({ error, documento }: { error: string; documento: string }) {
  const isNotFound = error.includes('encontrado') || error.includes('404');
  const isCpf = documento.length === 11;
  const isIndisponivel = error.includes('indispon') || error.includes('500') || error.includes('timeout');

  if (isNotFound) {
    return (
      <div className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <UserSearch className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                {isCpf ? 'CPF' : 'CNPJ'} nao encontrado no cadastro de contribuintes
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {isCpf ? documento.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : documento.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que isso significa?</h4>
            {isCpf ? (
              <p className="text-sm text-slate-700">
                O cadastro de contribuintes da SEFAZ (CCC/Sintegra) contem apenas <strong>contribuintes de ICMS</strong>: empresas, produtores rurais e outras entidades com inscricao estadual ativa. CPFs de pessoas fisicas comuns nao constam nessa base.
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                O CNPJ informado nao foi localizado no cadastro de contribuintes da SEFAZ para a UF selecionada. Isso pode significar que a empresa nao possui inscricao estadual nesse estado, ou que o cadastro esta em situacao que nao permite consulta.
              </p>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              {isCpf ? (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    Se for um <strong>produtor rural</strong> (pessoa fisica com IE), verifique se a UF esta correta.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    Se for uma pessoa fisica comum, o CCC nao oferece dados — use outras fontes de consulta.
                  </li>
                </>
              ) : (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    Confirme se a <strong>UF</strong> selecionada e a do endereco da empresa.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    Se o ambiente esta em <strong>Homologacao</strong>, a base pode estar incompleta. Mude para Producao no Dashboard.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400 mt-0.5">•</span>
                    Verifique se o CNPJ esta correto (14 digitos).
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (isIndisponivel) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">SEFAZ indisponivel</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <p className="text-xs text-red-700 mt-2">Tente novamente em alguns minutos. Se o problema persistir, verifique o certificado A1 no Configurador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div>
          <h3 className="text-sm font-semibold text-red-900">Falha na consulta</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
        </div>
      </div>
    </div>
  );
}

