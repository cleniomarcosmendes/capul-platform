import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, Copy, Sparkles, AlertTriangle, Database, UserSearch, Info, Building2, GitCompareArrows, MapPin, ChevronDown, ChevronRight, FileText, Printer, Hourglass, Network, ShieldAlert, ShieldOff } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { extractApiError, extractApiErrorCode } from '../utils/errors';
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

interface ReceitaLocalData {
  cnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacao: string | null;
  dataSituacao: string | null;
  naturezaJuridica: string | null;
  porte: string | null;
  capitalSocial: number | null;
  cnaeFiscal: string | null;
  cnaeFiscalDescricao: string | null;
  endereco: {
    logradouro: string | null; numero: string | null; bairro: string | null;
    municipio: string | null; uf: string | null; cep: string | null;
  } | null;
  telefone: string | null;
  email: string | null;
  // F1.9 Camada 2+3
  dataAbertura: string | null;
  motivoSituacao: string | null;
  cnaesSecundarios: Array<{ codigo: string; descricao: string }>;
  situacaoEspecial: string | null;
  dataSituacaoEspecial: string | null;
  qualificacaoResponsavel: string | null;
  enteFederativo: string | null;
  paisEstab: string | null;
  socios: Array<{
    tipo: string; nome: string | null; documento: string | null;
    qualificacao: string | null; dataEntrada: string | null;
    pais: string | null; faixaEtaria: string | null; representante: string | null;
  }>;
}
interface ConsultaLocalResp {
  fonte: 'RFB_LOCAL';
  encontrado: boolean;
  cnpj: string;
  versaoRfb: string | null;
  importadaEm: string | null;
  /** QSA omitido por falta de capability de sócio (LGPD, F3). */
  sociosRestrito?: boolean;
  dados: ReceitaLocalData | null;
}

export function CadastroConsultaPage() {
  const [searchParams] = useSearchParams();
  const [documento, setDocumento] = useState('');
  // UF começa vazia (modo auto): o backend deduz a UF a partir dos vínculos
  // Protheus. Se o CNPJ não existir no Protheus, o backend pede UF explícita.
  const [uf, setUf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [result, setResult] = useState<CadastroConsultaResult | null>(null);
  const [copied, setCopied] = useState(false);
  const autoTriggeredRef = useRef<string | null>(null);

  // Duas formas de consulta — devem ficar EXPLÍCITAS na tela:
  //  • 'local'  = base RFB Dados Abertos (foto mensal, instantânea, ZERO
  //               certificado/SEFAZ). Padrão no drill-down da Inteligência
  //               Cadastral (triagem em massa não pode queimar cota SEFAZ).
  //  • 'sefaz'  = CCC/Sintegra ao vivo, usa certificado A1 + cota SEFAZ.
  const [modo, setModo] = useState<'local' | 'sefaz'>(
    searchParams.get('fonte') === 'local' ? 'local' : 'sefaz',
  );
  const [local, setLocal] = useState<ConsultaLocalResp | null>(null);
  // CPF digitado no modo Base local: os Dados Abertos da RFB são só CNPJ
  // (não publicam PF/produtor rural). Em vez de erro seco, guardamos o CPF
  // e oferecemos trocar p/ SEFAZ ao vivo (lá produtor rural consulta por CPF).
  const [cpfBloqueadoLocal, setCpfBloqueadoLocal] = useState<string | null>(null);

  const docDigits = documento.replace(/\D/g, '');

  async function consultar(cnpjLimpo: string, ufAlvo: string | null) {
    if (cnpjLimpo.length !== 11 && cnpjLimpo.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).');
      return;
    }
    setError(null);
    setErrorCode(null);
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
      setErrorCode(extractApiErrorCode(err));
    } finally {
      setLoading(false);
    }
  }

  /** Consulta SÓ na base RFB local — sem certificado, sem SEFAZ. */
  async function consultarLocal(cnpjLimpo: string) {
    if (cnpjLimpo.length === 11) {
      // CPF: a base RFB Dados Abertos é só CNPJ (PF/produtor rural não
      // consta). Não é erro do usuário — oferece o caminho SEFAZ ao vivo.
      setCpfBloqueadoLocal(cnpjLimpo);
      setError(null);
      setResult(null);
      setLocal(null);
      return;
    }
    if (cnpjLimpo.length !== 14) {
      setError('Informe um CNPJ de 14 dígitos.');
      return;
    }
    setError(null);
    setErrorCode(null);
    setResult(null);
    setLocal(null);
    setCpfBloqueadoLocal(null);
    setCopied(false);
    try {
      setLoading(true);
      const { data } = await fiscalApi.post<ConsultaLocalResp>('/cadastro/consulta-local', {
        cnpj: cnpjLimpo,
      });
      setLocal(data);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao consultar a base RFB local.'));
      setErrorCode(extractApiErrorCode(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === 'local') {
      await consultarLocal(docDigits);
      return;
    }
    // UF vazia é permitida: backend tentará inferir a partir dos vínculos Protheus.
    await consultar(docDigits, uf || null);
  }

  /**
   * Imprime comprovante CCC da IE principal (a do card "Dados oficiais SEFAZ").
   * Sempre visível, independente de o CNPJ ter 1 IE ou várias. Para o caso de
   * múltiplas IEs há também botão por linha no card detalhado.
   */
  async function imprimirIePrincipal() {
    if (!result || !result.inscricaoEstadual) return;
    try {
      const r = await fiscalApi.get('/cadastro/comprovante-ie-pdf', {
        params: {
          cnpj: result.cnpj,
          uf: result.uf,
          ie: result.inscricaoEstadual,
          filial: result.vinculosProtheus[0]?.filial ?? '',
        },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Falha ao gerar comprovante.';
      alert(msg);
    }
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
      if (searchParams.get('fonte') === 'local') {
        consultarLocal(cnpjLimpo);
      } else {
        consultar(cnpjLimpo, ufFinal);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleCopyForCadastro() {
    if (!result) return;
    const e = result.endereco;
    // Label CPF/CNPJ conforme o documento (produtor rural tem 11 dígitos).
    const docLabel = (result.cnpj?.length ?? 0) === 11 ? 'CPF' : 'CNPJ';
    const text = [
      `Razão social: ${result.razaoSocial ?? ''}`,
      `Nome fantasia: ${result.nomeFantasia ?? ''}`,
      `${docLabel}: ${fmtCnpj(result.cnpj)}`,
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

      {/* Duas formas de consulta — EXPLÍCITAS */}
      <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => { setModo('local'); setResult(null); setError(null); setCpfBloqueadoLocal(null); }}
          className={modo === 'local'
            ? 'rounded-md bg-capul-600 px-3 py-1.5 font-medium text-white'
            : 'rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-50'}
        >
          <Database className="mr-1 inline h-4 w-4" /> Base local (RFB)
        </button>
        <button
          type="button"
          onClick={() => { setModo('sefaz'); setLocal(null); setError(null); setCpfBloqueadoLocal(null); }}
          className={modo === 'sefaz'
            ? 'rounded-md bg-capul-600 px-3 py-1.5 font-medium text-white'
            : 'rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-50'}
        >
          <AlertTriangle className="mr-1 inline h-4 w-4" /> SEFAZ ao vivo (certificado)
        </button>
      </div>

      {modo === 'local' ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <Database className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Base RFB local (Dados Abertos).</strong> Foto mensal — instantânea,
            sem certificado e sem consumir cota SEFAZ.
            {local?.versaoRfb && (
              <> Versão <strong>{local.versaoRfb}</strong>
                {local.importadaEm && <> · importada em {new Date(local.importadaEm).toLocaleString('pt-BR')}</>}.</>
            )}{' '}
            <strong>Pode estar desatualizada</strong> — para o dado em tempo real, use a
            consulta SEFAZ ao vivo.
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>SEFAZ ao vivo (CCC/Sintegra).</strong> Dado em tempo real — porém{' '}
            <strong>usa o certificado A1 e consome cota SEFAZ</strong> (rate-limit · limite
            2.000/dia · circuit breaker). Para triagem em massa, prefira a base local.
          </div>
        </div>
      )}

      <form
        onSubmit={handleConsultar}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-80">
            <label className="mb-1 block text-xs font-medium text-slate-700">
              {modo === 'local' ? 'CNPJ' : 'CNPJ ou CPF'}
              {modo === 'local' && (
                <span className="ml-1 font-normal text-slate-400">(base local é só CNPJ)</span>
              )}
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
              placeholder={modo === 'local' ? '00.000.000/0000-00 (só CNPJ)' : '000.000.000-00 ou 00.000.000/0000-00'}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tracking-tight focus:border-slate-500 focus:ring-slate-500"
              required
            />
          </div>
          {modo === 'sefaz' && (
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
          )}
          <div>
            <Button type="submit" loading={loading}>
              Consultar
            </Button>
          </div>
        </div>
      </form>

      {error && <ErrorDisplay error={error} errorCode={errorCode} documento={docDigits} />}

      {/* Ponte SEFAZ → base local: quando a consulta SEFAZ não retorna nada
          (CNPJ sem Inscrição Estadual é o caso típico), oferece a base RFB.
          Espelha a ponte inversa (CPF no modo local → SEFAZ). Só p/ CNPJ —
          a base RFB Dados Abertos não cobre CPF. */}
      {modo === 'sefaz' && error && docDigits.length === 14 && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="flex items-center gap-1.5 font-medium">
            <Database className="h-4 w-4 flex-shrink-0" />
            Pode haver dados na base RFB local
          </p>
          <p className="mt-1 text-xs text-sky-800">
            A SEFAZ não retornou nada — o CNPJ pode não ter Inscrição Estadual.
            A <strong>base RFB (Dados Abertos da Receita)</strong> costuma ter os
            dados cadastrais (razão social, situação, endereço, CNAE, sócios).
            {' '}<strong>Atenção:</strong> é uma <strong>foto mensal</strong>, não
            é consulta on-line — pode estar desatualizada em relação à Receita.
          </p>
          <div className="mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setModo('local'); consultarLocal(docDigits); }}
            >
              Consultar na base RFB local
            </Button>
          </div>
        </div>
      )}

      {modo === 'local' && cpfBloqueadoLocal && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Isto é um CPF — a base local não cobre pessoa física.</p>
          <p className="mt-1 text-xs">
            Os Dados Abertos da RFB são uma base <strong>só de CNPJ</strong>: pessoa
            física e <strong>produtor rural</strong> (que se identifica por CPF) não
            constam aqui. Mas o <strong>SEFAZ ao vivo</strong> consulta produtor rural
            por CPF (+ UF) — a Inscrição Estadual fica atrelada ao CPF.
          </p>
          <div className="mt-2">
            <Button
              size="sm"
              onClick={() => {
                const cpf = cpfBloqueadoLocal;
                setCpfBloqueadoLocal(null);
                setModo('sefaz');
                setLocal(null);
                setError(null);
                consultar(cpf, null);
              }}
            >
              Consultar no SEFAZ ao vivo (certificado)
            </Button>
          </div>
        </div>
      )}

      {modo === 'local' && local && (
        <PainelLocal
          local={local}
          onConsultarSefaz={() => {
            setModo('sefaz');
            setLocal(null);
            setError(null);
            consultar(local.cnpj, null);
          }}
        />
      )}

      {modo === 'sefaz' && result && (
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
            <div className="mb-1 flex items-start justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Dados oficiais do SEFAZ
              </div>
              {/* Imprimir comprovante CCC da IE principal — sempre visível,
                  independente do CNPJ ter 1 ou múltiplas IEs. Pra múltiplas
                  IEs há botão por linha no card detalhado abaixo. */}
              {result.inscricaoEstadual && (
                <button
                  type="button"
                  onClick={imprimirIePrincipal}
                  title={`Imprimir comprovante CCC da IE ${result.inscricaoEstadual} (${result.uf})`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm hover:bg-amber-100"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir Comprovante CCC
                </button>
              )}
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
              {/* Situação CPF/CNPJ na Receita Federal — fonte distinta da Situação IE.
                  CNPJ: vem do BrasilAPI/ReceitaWS. CPF: limitação intransponível (LGPD).
                  Inferimos pelo número de dígitos do `result.cnpj` (campo único que
                  guarda ambos no backend). */}
              {result.cnpj.replace(/\D/g, '').length === 14 ? (
                <Row
                  label="Situação CNPJ (Receita)"
                  value={
                    result.dadosReceita?.situacao
                      ? result.dadosReceita.situacao +
                        (result.dadosReceita.dataSituacao ? ` desde ${result.dadosReceita.dataSituacao}` : '')
                      : 'Não disponível'
                  }
                />
              ) : (
                <Row
                  label="Situação CPF (Receita)"
                  value="Não disponível via API pública (LGPD) — consulte portal SEFAZ/Receita"
                />
              )}
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
              cnpj={result.cnpj}
              filial={result.vinculosProtheus[0]?.filial ?? ''}
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

/** RFB data_situacao = AAAAMMDD → DD/MM/AAAA. */
function fmtDataRfb(s: string | null): string {
  if (!s || !/^\d{8}$/.test(s)) return s || '—';
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

/** Painel da consulta SÓ-LOCAL (RFB). Sem IE/cruzamento (a base aberta não
 *  tem Inscrição Estadual). Deixa explícito que é foto mensal + opt-in SEFAZ. */
function PainelLocal({
  local,
  onConsultarSefaz,
}: {
  local: ConsultaLocalResp;
  onConsultarSefaz: () => void;
}) {
  const d = local.dados;

  // Deep-link "#qsa": quando se chega aqui via "ver sócios" (ex.: da
  // Inteligência Cadastral), rola direto até o Quadro de Sócios. PainelLocal
  // só monta com os dados prontos, então o QSA já está no DOM.
  useEffect(() => {
    if (window.location.hash === '#qsa') {
      document.getElementById('qsa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const sitCls =
    d?.situacao === 'ATIVA' ? 'bg-green-100 text-green-700'
      : d?.situacao === 'BAIXADA' || d?.situacao === 'INAPTA' || d?.situacao === 'NULA' ? 'bg-red-100 text-red-700'
        : d?.situacao === 'SUSPENSA' ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-600';

  if (!local.encontrado || !d) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">CNPJ {fmtCnpj(local.cnpj)} não encontrado na base RFB local.</p>
        <p className="mt-1 text-xs">
          Pode ter sido aberto/alterado após o snapshot
          {local.versaoRfb ? ` (versão ${local.versaoRfb})` : ''} ou não constar nos
          Dados Abertos. Para o dado em tempo real:
        </p>
        <div className="mt-2">
          <Button size="sm" onClick={onConsultarSefaz}>
            Consultar no SEFAZ ao vivo (usa certificado)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-slate-800">{d.razaoSocial ?? '—'}</div>
          {d.nomeFantasia && <div className="text-sm text-slate-500">{d.nomeFantasia}</div>}
        </div>
        {d.situacao && (
          <span className={`rounded px-2 py-1 text-xs font-semibold ${sitCls}`}>
            {d.situacao}{d.dataSituacao ? ` · desde ${fmtDataRfb(d.dataSituacao)}` : ''}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <CampoLocal k="CNPJ" v={fmtCnpj(d.cnpj)} />
        <CampoLocal k="Natureza jurídica" v={d.naturezaJuridica} />
        <CampoLocal k="Porte" v={d.porte} />
        <CampoLocal
          k="Capital social"
          v={d.capitalSocial != null
            ? d.capitalSocial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : null}
        />
        <CampoLocal
          k="CNAE"
          v={d.cnaeFiscal
            ? `${d.cnaeFiscal}${d.cnaeFiscalDescricao ? ' — ' + d.cnaeFiscalDescricao : ''}`
            : null}
        />
        <CampoLocal k="Telefone" v={d.telefone} />
        <CampoLocal k="E-mail" v={d.email} />
        <CampoLocal k="Data de abertura" v={d.dataAbertura ? fmtDataRfb(d.dataAbertura) : null} />
        <CampoLocal k="Motivo da situação" v={d.motivoSituacao} />
        <CampoLocal
          k="Situação especial"
          v={d.situacaoEspecial
            ? `${d.situacaoEspecial}${d.dataSituacaoEspecial ? ' (' + fmtDataRfb(d.dataSituacaoEspecial) + ')' : ''}`
            : null}
        />
        <CampoLocal k="Qualif. responsável" v={d.qualificacaoResponsavel} />
        <CampoLocal k="Ente federativo" v={d.enteFederativo} />
        <CampoLocal k="País" v={d.paisEstab} />
        <CampoLocal
          k="Endereço"
          v={d.endereco
            ? `${d.endereco.logradouro ?? ''}${d.endereco.numero ? ', ' + d.endereco.numero : ''} — `
              + `${d.endereco.bairro ?? ''} — ${d.endereco.municipio ?? ''}/${d.endereco.uf ?? ''} `
              + `${fmtCep(d.endereco.cep)}`
            : null}
        />
      </dl>

      {d.cnaesSecundarios?.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs font-semibold text-slate-500">CNAEs secundários ({d.cnaesSecundarios.length})</div>
          <div className="flex flex-wrap gap-1">
            {d.cnaesSecundarios.map((c) => (
              <span key={c.codigo} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600" title={c.descricao}>
                {c.codigo}{c.descricao ? ` — ${c.descricao}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {d.socios?.length > 0 && (
        <div id="qsa" className="mt-4 scroll-mt-4">
          <div className="mb-1 text-xs font-semibold text-slate-500">
            Quadro de sócios e administradores (QSA) — {d.socios.length}
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Nome</th>
                  <th className="px-2 py-1.5">Tipo</th>
                  <th className="px-2 py-1.5">Documento</th>
                  <th className="px-2 py-1.5">Qualificação</th>
                  <th className="px-2 py-1.5">Entrada</th>
                  <th className="px-2 py-1.5">Faixa etária</th>
                </tr>
              </thead>
              <tbody>
                {d.socios.map((s, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-2 py-1.5">
                      {s.nome ? (
                        // Cruzamento: nome do sócio → Busca por Sócio com todas
                        // as empresas vinculadas a ele. A Busca por Sócio é a
                        // tela LGPD-gated (FISCAL_CONSULTA_SOCIOS) para esse
                        // grafo — e o QSA só é renderizado p/ quem tem a cap.
                        <Link
                          to={`/rfb/socios?nome=${encodeURIComponent(s.nome)}&exato=1${s.documento ? `&doc=${encodeURIComponent(s.documento)}` : ''}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          title="Ver as empresas vinculadas a este sócio (busca exata por nome + documento)"
                        >
                          {s.nome}
                          <Building2 className="h-3 w-3 opacity-60" />
                        </Link>
                      ) : '—'}
                      {s.representante && (
                        <span className="block text-[10px] text-slate-400">repr.: {s.representante}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">{s.tipo}</td>
                    <td className="px-2 py-1.5 font-mono">{s.documento ?? '—'}</td>
                    <td className="px-2 py-1.5">{s.qualificacao ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{s.dataEntrada ? fmtDataRfb(s.dataEntrada) : '—'}</td>
                    <td className="px-2 py-1.5">{s.faixaEtaria ?? '—'}{s.pais && s.pais !== 'BRASIL' ? ` · ${s.pais}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {local.sociosRestrito && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <strong>Quadro societário (QSA) restrito.</strong> O acesso a dados de
          sócios (pessoa física) exige autorização específica por usuário (LGPD).
          Solicite a um ADMIN a liberação no Configurador.
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-400">
          Fonte: base RFB local{local.versaoRfb ? ` v${local.versaoRfb}` : ''} — foto mensal,
          pode estar desatualizada.
        </span>
        <Button size="sm" variant="secondary" onClick={onConsultarSefaz}>
          Confirmar no SEFAZ ao vivo (certificado)
        </Button>
      </div>
    </div>
  );
}

function CampoLocal({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex gap-2 border-b border-slate-50 py-1 text-sm">
      <dt className="w-40 flex-shrink-0 text-slate-500">{k}</dt>
      <dd className="text-slate-800">{v || '—'}</dd>
    </div>
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
  cnpj,
  filial,
}: {
  inscricoes: InscricaoEstadualSefaz[];
  ufPrincipal: string;
  iePrincipal: string | null;
  cnpj: string;
  filial: string;
}) {
  /**
   * Imprimir comprovante CCC desta IE — abre PDF gerado pelo backend
   * (/cadastro/comprovante-ie-pdf) em nova aba. Reusa o token JWT já no
   * fiscalApi via params + cookies.
   */
  async function imprimirIe(ie: InscricaoEstadualSefaz) {
    try {
      const r = await fiscalApi.get('/cadastro/comprovante-ie-pdf', {
        params: { cnpj, uf: ie.uf, ie: ie.inscricaoEstadual, filial },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Falha ao gerar comprovante.';
      alert(msg);
    }
  }
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
            <div key={key} className="relative">
              {/* Botão Imprimir IE — gera PDF backend (paleta SEFAZ) por IE.
                  Posicionado absolute pra não ser parte do <button> de toggle. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  imprimirIe(ie);
                }}
                title={`Imprimir comprovante CCC desta IE (${ie.uf} · ${ie.inscricaoEstadual})`}
                className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 shadow-sm hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
              >
                <Printer className="h-3 w-3" /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => toggleIe(key)}
                className="flex w-full items-center gap-3 px-4 py-3 pr-24 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
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
          {!isCpf && (
            <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Para baixar o comprovante oficial PDF, use o portal manual:</span>
              <LinkComprovanteReceita />
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

      {r.endereco && (r.endereco.logradouro || r.endereco.municipio) && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Endereço (Receita Federal)
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {r.endereco.logradouro && (
              <Row
                label="Logradouro"
                value={`${r.endereco.logradouro}${r.endereco.numero ? ', ' + r.endereco.numero : ''}${r.endereco.complemento ? ' — ' + r.endereco.complemento : ''}`}
                wide
              />
            )}
            {r.endereco.bairro && <Row label="Bairro" value={r.endereco.bairro} />}
            {r.endereco.cep && <Row label="CEP" value={r.endereco.cep} />}
            {r.endereco.municipio && <Row label="Município" value={r.endereco.municipio} />}
            {r.endereco.uf && <Row label="UF" value={r.endereco.uf} />}
          </div>
        </div>
      )}

      {r.cnaesSecundarios.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            CNAEs secundários ({r.cnaesSecundarios.length})
          </div>
          <ul className="space-y-1 text-xs text-slate-600 max-h-48 overflow-y-auto">
            {r.cnaesSecundarios.map((c, idx) => (
              <li key={idx}>
                <span className="font-mono text-slate-500">{c.codigo}</span> — {c.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
        <span>
          Fonte:{' '}
          <strong className="text-slate-600">
            {r.fonte === 'RFB_LOCAL'
              ? `Base RFB local${r.versaoRfb ? ` (${r.versaoRfb})` : ''}`
              : r.fonte === 'BRASILAPI'
                ? 'BrasilAPI'
                : 'ReceitaWS'}
          </strong>{' '}
          {r.fonte === 'RFB_LOCAL'
            ? '(base pública CNPJ importada — instantânea, sem SEFAZ)'
            : '(API pública gratuita)'}
        </span>
        <LinkComprovanteReceita />
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

/**
 * Botão pra abrir o portal oficial da Receita Federal (cnpjreva).
 *
 * O portal requer captcha humano — não dá pra automatizar. Por isso é
 * link manual em todas as situações onde o operador pode precisar do
 * comprovante oficial:
 *   - Receita Federal indisponível na consulta automática (BrasilAPI/ReceitaWS off)
 *   - SEFAZ não encontrou o CNPJ (operador valida na Receita pra confirmar
 *     que a empresa existe mesmo)
 *   - Protheus indisponível e operador quer baixar PDF oficial pro arquivo fiscal
 *
 * Só faz sentido pra CNPJ (14 dígitos). CPF não consulta nesse portal.
 */
function LinkComprovanteReceita() {
  return (
    <a
      href="https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
      title="Abre o portal da Receita Federal em nova aba — requer captcha humano para baixar o PDF oficial."
    >
      🔗 Comprovante oficial na Receita Federal
    </a>
  );
}

function ErrorDisplay({
  error,
  errorCode,
  documento,
}: {
  error: string;
  errorCode: string | null;
  documento: string;
}) {
  const isNotFound = error.includes('encontrado') || error.includes('404');
  const isCpf = documento.length === 11;
  const isCnpj = documento.length === 14;
  const isLimiteAtingido =
    errorCode === 'LIMITE_ATINGIDO' || /Limite di.rio.*SEFAZ atingido|LIMITE_ATINGIDO/i.test(error);
  const isCircuitAberto =
    errorCode === 'CIRCUIT_ABERTO' || /CIRCUIT_ABERTO|temporariamente bloqueada/i.test(error);
  const isCadeiaTls =
    errorCode === 'CADEIA_TLS_SERVIDOR_DESATUALIZADA' ||
    /CADEIA_TLS|Cadeia TLS do SEFAZ|unable to get.*issuer|UNABLE_TO_GET_ISSUER|SELF_SIGNED_CERT_IN_CHAIN/i.test(error);
  const isCertInvalido =
    errorCode === 'CERT_INVALIDO' ||
    /CERT_INVALIDO|certificate expired|CERT_HAS_EXPIRED|bad decrypt|certificado digital A1/i.test(error);
  const isContingencia =
    errorCode === 'SEFAZ_CONTINGENCIA' ||
    /ECONNRESET|socket hang up|EPIPE|ECONNABORTED|conting.ncia/i.test(error);
  const isIndisponivel = error.includes('indispon') || error.includes('500') || error.includes('timeout');
  const isProtheusIndisponivel = errorCode === 'PROTHEUS_INDISPONIVEL';

  if (isProtheusIndisponivel) {
    return (
      <div className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Database className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Integração Protheus indisponível
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                A consulta SEFAZ não foi feita porque o cadastro Protheus (SA1/SA2) é a fonte das UFs.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              O que aconteceu?
            </h4>
            <p className="text-sm text-slate-700">
              O serviço de API do Protheus (<code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">apiportal.capul.com.br</code>)
              não respondeu após 3 tentativas. Isso costuma indicar que o serviço foi reiniciado, está em manutenção
              ou houve um problema de rede entre a plataforma e o Protheus.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              O que fazer?
            </h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  <strong>Mais rápido:</strong> informe a <strong>UF</strong> no formulário acima e consulte novamente —
                  isso pula o Protheus e vai direto ao SEFAZ.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Se você não souber a UF ou precisar do cruzamento Protheus, <strong>peça à equipe de TI</strong> para
                  verificar o serviço Protheus.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Tente novamente em alguns minutos — em geral o serviço estabiliza rápido após restart.
                </span>
              </li>
            </ul>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Precisa do comprovante oficial? Acesse direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 font-mono">
              Código: PROTHEUS_INDISPONIVEL · HTTP 503
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Quer confirmar manualmente na Receita Federal?</span>
              <LinkComprovanteReceita />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLimiteAtingido) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Hourglass className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Limite diário de consultas SEFAZ atingido
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Proteção interna da plataforma — não é bloqueio da SEFAZ.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            A plataforma limita o total de consultas SEFAZ por dia para proteger nosso
            CNPJ contra bloqueio por uso abusivo. O limite foi atingido — novas
            consultas SEFAZ ao vivo voltam ao normal <strong>após 00:00</strong>.
          </p>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>Use <strong>"Base local (RFB)"</strong> — não consome cota.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Em emergência, ADMIN_TI pode liberar em <strong>Operação → Limites</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>O contador zera automaticamente à meia-noite.</span>
              </li>
            </ul>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Precisa do comprovante oficial agora? Acesse direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: LIMITE_ATINGIDO · HTTP 429
          </p>
        </div>
      </div>
    );
  }

  if (isCircuitAberto) {
    const ufMatch = error.match(/UF ([A-Z]{2})/);
    const uf = ufMatch ? ufMatch[1] : '';
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <ShieldOff className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Consultas{uf ? ` à UF ${uf}` : ''} temporariamente bloqueadas pela plataforma
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Circuit breaker — proteção interna após várias falhas consecutivas no SEFAZ.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            Detectamos várias falhas consecutivas no SEFAZ{uf ? ` de ${uf}` : ''} recentemente.
            Para não sobrecarregar mais um servidor instável (e proteger nossa cota), a
            plataforma fechou temporariamente o acesso a essa UF. O bloqueio reabre
            sozinho assim que o SEFAZ voltar.
          </p>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span><strong>Aguarde alguns minutos</strong> — reabre automaticamente.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>Outras UFs continuam funcionando — bloqueio é por UF.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Status oficial no{' '}
                  <a
                    href="https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 underline hover:text-amber-900 font-medium"
                  >
                    portal SEFAZ ↗
                  </a>
                </span>
              </li>
            </ul>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Enquanto isso, consulte direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: CIRCUIT_ABERTO · HTTP 503
          </p>
        </div>
      </div>
    );
  }

  if (isCadeiaTls) {
    const ufMatch = error.match(/SEFAZ de ([A-Z]{2})|SEFAZ-([A-Z]{2})/);
    const uf = ufMatch ? (ufMatch[1] ?? ufMatch[2] ?? '') : '';
    return (
      <div className="mb-6 rounded-lg border border-orange-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-orange-50 border-b border-orange-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
              <Network className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-orange-900">
                Cadeia TLS do servidor SEFAZ{uf ? ` de ${uf}` : ''} desatualizada
              </h3>
              <p className="text-xs text-orange-700 mt-0.5">
                Requer ação do ADMIN_TI — NÃO é problema do A1 da CAPUL.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            O servidor SEFAZ{uf ? ` de ${uf}` : ''} usa uma <strong>AC intermediária</strong>{' '}
            que a plataforma ainda não conhece. Costuma ocorrer quando o estado troca
            o emissor do cert do servidor.
          </p>
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-900">
              <strong>Importante:</strong> esse erro é sobre o cert do <em>servidor SEFAZ</em>,
              não do A1 da CAPUL. Não precisa revisar o A1 — ele continua válido.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Peça ao <strong>ADMIN_TI</strong> abrir <strong>Operação → Diagnóstico → Cadeia TLS</strong>{' '}
                  e clicar em <strong>"Atualizar cadeia"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>Depois da atualização, repita a consulta — deve voltar a funcionar.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>Enquanto isso, "Base local (RFB)" continua disponível.</span>
              </li>
            </ul>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Comprovante oficial agora? Acesse direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: CADEIA_TLS_SERVIDOR_DESATUALIZADA · HTTP 503
          </p>
        </div>
      </div>
    );
  }

  if (isCertInvalido) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-900">
                Certificado A1 da CAPUL com problema
              </h3>
              <p className="text-xs text-red-700 mt-0.5">
                Consulta SEFAZ exige A1 válido — verificar configuração.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            A consulta foi rejeitada porque o <strong>certificado A1 da CAPUL</strong>{' '}
            está inválido. Causas comuns:
          </p>
          <ul className="text-sm text-slate-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Certificado expirado</strong> (validade vencida).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span><strong>Senha incorreta</strong> ao decifrar o PFX.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Arquivo PFX corrompido ou substituído.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Nenhum certificado marcado como ativo.</span>
            </li>
          </ul>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <p>
              Abra <strong>Configurador → Certificado Fiscal</strong> e confira: certificado
              ativo, dentro da validade, senha correta. Se precisar reimportar, peça ao ADMIN_TI.
              "Base local (RFB)" não depende do A1 e continua funcionando.
            </p>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Comprovante oficial agora? Acesse direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: CERT_INVALIDO · HTTP 503
          </p>
        </div>
      </div>
    );
  }

  if (isContingencia) {
    const ufMatch = error.match(/SEFAZ de ([A-Z]{2})/);
    const uf = ufMatch ? ufMatch[1] : '';
    const detalheTecnico =
      error.match(/(socket hang up|ECONNRESET|EPIPE|ECONNABORTED)/)?.[1] ?? 'conexão fechada pelo servidor';
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                SEFAZ{uf ? `-${uf}` : ''} temporariamente indisponível
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Servidor SEFAZ fechou a conexão — costuma indicar contingência ou manutenção.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que isso significa?</h4>
            <p className="text-sm text-slate-700">
              O servidor da SEFAZ{uf ? ` de ${uf}` : ''} encerrou a conexão antes de responder.
              Isso costuma indicar <strong>contingência ou manutenção</strong> do próprio SEFAZ —{' '}
              <strong className="text-slate-900">NÃO é problema da CAPUL nem da plataforma</strong>.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer agora?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Use o botão <strong>"Base local (RFB)"</strong> no topo desta tela — consulta sem cota e sem certificado.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>Aguarde alguns minutos antes de tentar de novo. Em contingência, cada tentativa só adiciona carga no SEFAZ.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Confira o status oficial no{' '}
                  <a
                    href="https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 underline hover:text-amber-900 font-medium"
                  >
                    portal de disponibilidade da SEFAZ ↗
                  </a>
                </span>
              </li>
            </ul>
          </div>
          {isCnpj && (
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>Precisa do comprovante oficial agora? Acesse direto na Receita Federal:</span>
              <LinkComprovanteReceita />
            </div>
          )}
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 font-mono">
              Detalhe técnico: {detalheTecnico} · Código: SEFAZ_CONTINGENCIA
            </p>
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
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-900">SEFAZ indisponivel</h3>
            <p className="text-sm text-red-800 mt-1">{error}</p>
            <p className="text-xs text-red-700 mt-2">Tente novamente em alguns minutos. Se o problema persistir, verifique o certificado A1 no Configurador.</p>
            {isCnpj && (
              <div className="mt-3 pt-3 border-t border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
                <span>Enquanto isso, consulte direto na Receita Federal:</span>
                <LinkComprovanteReceita />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-900">Falha na consulta</h3>
          <p className="text-sm text-red-800 mt-1">{error}</p>
          {isCnpj && (
            <div className="mt-3 pt-3 border-t border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
              <span>Para confirmar o cadastro, abra o portal oficial:</span>
              <LinkComprovanteReceita />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

