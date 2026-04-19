import { useState } from 'react';
import { AlertCircle, Check, Copy, Sparkles, AlertTriangle, Database, UserSearch, Info, Building2 } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { extractApiError } from '../utils/errors';
import { Row } from '../components/Row';
import { fmtCnpj, fmtCep } from '../utils/format';
import type { CadastroConsultaResult, SituacaoCadastral, VinculoProtheus } from '../types';

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

export function CadastroConsultaPage() {
  const [documento, setDocumento] = useState('');
  const [uf, setUf] = useState('MG');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CadastroConsultaResult | null>(null);
  const [copied, setCopied] = useState(false);

  const docDigits = documento.replace(/\D/g, '');

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setCopied(false);

    if (docDigits.length !== 11 && docDigits.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).');
      return;
    }

    try {
      setLoading(true);
      const { data } = await fiscalApi.post<CadastroConsultaResult>('/cadastro/consulta', {
        cnpj: docDigits,
        uf,
      });
      setResult(data);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao consultar CNPJ na SEFAZ.'));
    } finally {
      setLoading(false);
    }
  }

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
      </p>

      <form
        onSubmit={handleConsultar}
        className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-8">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:ring-slate-500"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-700">UF</label>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
            >
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-end">
            <Button type="submit" loading={loading} className="w-full">
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

