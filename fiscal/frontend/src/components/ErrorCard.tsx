import { AlertCircle, AlertTriangle, CalendarClock, FileSearch, Info, ShieldAlert } from 'lucide-react';

interface ErrorCardProps {
  error: string;
  context?: 'nfe' | 'cte' | 'cadastro' | 'generico';
}

/**
 * Card de erro padronizado, com layout amigável e contextual.
 * Detecta o tipo de erro pelo conteúdo da mensagem e adapta o visual.
 */
export function ErrorCard({ error, context = 'generico' }: ErrorCardProps) {
  const isEmitidaPeloConsulente =
    /emitida pelo CNPJ|indispon.vel para o emitente|NFE_EMITIDA_PELO_CONSULENTE|cStat=641/i.test(error);
  const isForaDePrazo =
    /fora de prazo|fora da janela|NFE_FORA_DE_PRAZO_SEFAZ|cStat=632/i.test(error);
  const isNotFound =
    /n.o encontrad|nao encontrad|404|cStat=215|cStat=217/i.test(error);
  const isCertProblem =
    /certificado|FISCAL_CNPJ_CONSULENTE|mTLS|TLS/i.test(error);
  // Intencionalmente sem "indispon" — "indisponivel para o emitente" é outro caso.
  const isUnavailable =
    /503|timeout|HTTP 5\d\d|conex.o/i.test(error);

  if (isForaDePrazo) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                NF-e fora da janela de download da SEFAZ
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                O serviço da SEFAZ só permite download nos primeiros ~90 dias.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700 space-y-3">
          <p className="text-xs">{error}</p>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-2">
            <p>
              <strong>Por que isso acontece?</strong> O serviço{' '}
              <em>NFeDistribuicaoDFe</em> da SEFAZ entrega XML de NF-es para o
              destinatário apenas durante uma <strong>janela de aproximadamente 90
              dias</strong> a partir da emissão ou do último evento da nota (ciência,
              confirmação, etc). Após esse período, a SEFAZ encerra o acesso via este
              canal — a NF-e continua existindo no sistema fiscal, mas não pode mais
              ser baixada por aqui.
            </p>
            <p>
              <strong>O que fazer:</strong>
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                Verifique no <strong>Protheus (SZR010)</strong> se o XML foi baixado
                anteriormente e está em cache — é o cenário mais comum para notas
                antigas.
              </li>
              <li>
                Solicite o <strong>XML diretamente ao emitente</strong> — o emitente
                sempre tem o arquivo original.
              </li>
              <li>
                Se a nota era necessária para auditoria ou ressarcimento, registre
                isso no setor fiscal para processamento alternativo.
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (isEmitidaPeloConsulente) {
    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">
                NF-e emitida pela própria empresa
              </h3>
              <p className="text-xs text-blue-700 mt-0.5">
                O serviço SEFAZ de distribuição só entrega XML para destinatários.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700 space-y-2">
          <p>{error}</p>
          <p className="text-xs text-slate-500">
            Para baixar o XML de notas emitidas pela empresa, a origem correta é o
            <strong> Protheus (SZR010)</strong> ou o próprio ERP fiscal. A consulta
            via SEFAZ continua disponível para notas em que a empresa é destinatária.
          </p>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    const docLabel =
      context === 'nfe' ? 'NF-e'
      : context === 'cte' ? 'CT-e'
      : context === 'cadastro' ? 'Documento'
      : 'Recurso';

    return (
      <div className="mb-6 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                {docLabel} não encontrado
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCertProblem) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-red-50 border-b border-red-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900">
                Problema com o certificado digital
              </h3>
              <p className="text-xs text-red-700 mt-0.5">{error}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700">
          Verifique no <strong>Configurador → Certificado A1</strong> se há um certificado ativo
          e dentro da validade. Se o problema persistir, contate o ADMIN_TI.
        </div>
      </div>
    );
  }

  if (isUnavailable) {
    return (
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">
              Serviço SEFAZ indisponível
            </h3>
            <p className="text-sm text-amber-800 mt-1">{error}</p>
            <p className="text-xs text-amber-700 mt-2">
              Tente novamente em alguns minutos. A SEFAZ pode estar em manutenção ou com instabilidade.
            </p>
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
        </div>
      </div>
    </div>
  );
}
