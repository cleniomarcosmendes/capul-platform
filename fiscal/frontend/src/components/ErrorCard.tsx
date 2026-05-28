import { AlertCircle, AlertTriangle, CalendarClock, FileSearch, Info, RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorCardProps {
  error: string;
  context?: 'nfe' | 'cte' | 'cadastro' | 'generico';
  /**
   * Quando o backend devolve `podeTentarOutrasFiliais=true` no erro, o card
   * exibe botão "Tentar com outras filiais CAPUL" — usado em NF-e (cStat=641
   * "emitida pela propria empresa" ou cStat=138 quando ainda sobram filiais
   * nao testadas alem do MAX_FALLBACKS_PADRAO).
   */
  podeTentarOutrasFiliais?: boolean;
  totalFiliaisDisponiveis?: number;
  /**
   * Sub-classificacao do cStat=641 entregue pelo backend — define titulo/subtitulo
   * do card. Quando ausente, cai no titulo legado "NF-e emitida pela propria empresa".
   *  - EMITENTE_EXATO: consulente == emitente (CNPJ 14 digitos).
   *  - MESMA_RAIZ: consulente e emitente compartilham raiz CNPJ (8 digitos) mas
   *    filial difere — caso CAPUL-pra-CAPUL.
   *  - SEM_INTERESSE: consulente sem ligacao com a chave.
   */
  subcaso641?: 'EMITENTE_EXATO' | 'MESMA_RAIZ' | 'SEM_INTERESSE';
  onTentarOutrasFiliais?: () => void;
  tentandoOutrasFiliais?: boolean;
}

/**
 * Card de erro padronizado, com layout amigável e contextual.
 * Detecta o tipo de erro pelo conteúdo da mensagem e adapta o visual.
 */
export function ErrorCard({
  error,
  context = 'generico',
  podeTentarOutrasFiliais = false,
  totalFiliaisDisponiveis,
  subcaso641,
  onTentarOutrasFiliais,
  tentandoOutrasFiliais = false,
}: ErrorCardProps) {
  const tentarOutrasBtn = podeTentarOutrasFiliais && onTentarOutrasFiliais ? (
    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
      <p className="mb-2">
        <strong>Quer tentar com outras filiais CAPUL?</strong> Em alguns casos
        (transferência interna entre filiais, ou destinatária pouco comum) o XML
        pode estar disponível por outra filial consulente.
      </p>
      <p className="mb-3 text-blue-700">
        {totalFiliaisDisponiveis
          ? `Vamos tentar até ${totalFiliaisDisponiveis} filial(is). Pode levar alguns segundos.`
          : 'Vamos tentar todas as filiais ativas. Pode levar alguns segundos.'}
      </p>
      <button
        type="button"
        onClick={onTentarOutrasFiliais}
        disabled={tentandoOutrasFiliais}
        className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-wait"
      >
        <RefreshCw size={12} className={tentandoOutrasFiliais ? 'animate-spin' : ''} />
        {tentandoOutrasFiliais ? 'Tentando…' : 'Tentar com outras filiais CAPUL'}
      </button>
    </div>
  ) : null;

  const isEmitidaPeloConsulente =
    /emitida pelo CNPJ|indispon.vel para o emitente|NFE_EMITIDA_PELO_CONSULENTE|cStat=641/i.test(error);
  const isForaDePrazo =
    /fora de prazo|fora da janela|NFE_FORA_DE_PRAZO_SEFAZ|cStat=632/i.test(error);
  const isNotFound =
    /n.o encontrad|nao encontrad|404|cStat=215|cStat=217/i.test(error);
  const isCertProblem =
    /certificado|FISCAL_CNPJ_CONSULENTE|mTLS|TLS/i.test(error);
  // SEFAZ em contingência: TCP reset pelo servidor remoto (ECONNRESET,
  // socket hang up, etc). Card dedicado pra deixar claro que NÃO é problema
  // da CAPUL e instruir a usar fallback local. Detectar ANTES de isUnavailable.
  const isContingencia =
    /ECONNRESET|socket hang up|EPIPE|ECONNABORTED|SEFAZ_CONTINGENCIA|conting.ncia/i.test(error);
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
    // Titulo/subtitulo variam conforme `subcaso641` enviado pelo backend.
    // Fallback (subcaso641 ausente) mantem texto legado.
    const titulo =
      subcaso641 === 'MESMA_RAIZ'
        ? 'NF-e do mesmo grupo CNPJ (filial diferente)'
        : subcaso641 === 'SEM_INTERESSE'
          ? 'Filial consulente sem interesse declarado nesta NF-e'
          : 'NF-e emitida pela própria empresa';
    const subtitulo =
      subcaso641 === 'MESMA_RAIZ'
        ? 'SEFAZ recusa entrega entre filiais do mesmo grupo sem interesse declarado.'
        : subcaso641 === 'SEM_INTERESSE'
          ? 'Esta filial não é destinatária nem transportadora da NF-e.'
          : 'O serviço SEFAZ de distribuição só entrega XML para destinatários.';
    const rodape =
      subcaso641 === 'EMITENTE_EXATO'
        ? 'Para baixar o XML de notas emitidas pela própria filial, a origem correta é o Protheus (SZR010) ou o próprio ERP fiscal.'
        : 'Outra filial CAPUL pode ter sido destinatária (transferência interna) — tente abaixo. Se nenhuma for, o XML existe apenas no Protheus do emitente.';

    return (
      <div className="mb-6 rounded-lg border border-blue-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-900">{titulo}</h3>
              <p className="text-xs text-blue-700 mt-0.5">{subtitulo}</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700 space-y-3">
          <p>{error}</p>
          <p className="text-xs text-slate-500">{rodape}</p>
          {tentarOutrasBtn}
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
        {tentarOutrasBtn && (
          <div className="px-6 py-4">{tentarOutrasBtn}</div>
        )}
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

  if (isContingencia) {
    const ufMatch = error.match(/SEFAZ de ([A-Z]{2})|SEFAZ-([A-Z]{2})/);
    const uf = ufMatch ? (ufMatch[1] ?? ufMatch[2] ?? '') : '';
    const detalheTecnico =
      error.match(/(socket hang up|ECONNRESET|EPIPE|ECONNABORTED)/)?.[1] ?? 'conexão fechada pelo servidor';
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                SEFAZ{uf ? `-${uf}` : ''} temporariamente indisponível
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Servidor SEFAZ fechou a conexão — costuma indicar contingência ou manutenção.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            O servidor da SEFAZ{uf ? ` de ${uf}` : ''} encerrou a conexão antes de responder.
            Isso costuma indicar <strong>contingência ou manutenção</strong> do próprio SEFAZ —{' '}
            <strong className="text-slate-900">NÃO é problema da CAPUL nem da plataforma</strong>.
          </p>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
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
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Detalhe técnico: {detalheTecnico} · Código: SEFAZ_CONTINGENCIA
          </p>
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
