import { AlertCircle, AlertTriangle, CalendarClock, FileSearch, Hourglass, Info, Network, RefreshCw, ShieldAlert, ShieldOff } from 'lucide-react';

interface ErrorCardProps {
  error: string;
  /**
   * Código do erro entregue pelo backend (campo `erro` do payload de exceção),
   * quando disponível. Tem prioridade sobre detecção via regex no texto.
   * Categorias conhecidas: SEFAZ_CONTINGENCIA, LIMITE_ATINGIDO, CIRCUIT_ABERTO,
   * CADEIA_TLS_SERVIDOR_DESATUALIZADA, CERT_INVALIDO, SEFAZ_INDISPONIVEL,
   * PROTHEUS_INDISPONIVEL.
   */
  errorCode?: string | null;
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
  errorCode,
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
  // Limite diário da plataforma (proteção interna, não SEFAZ).
  const isLimiteAtingido =
    errorCode === 'LIMITE_ATINGIDO' || /Limite di.rio.*SEFAZ atingido|LIMITE_ATINGIDO/i.test(error);
  // Circuit breaker da UF aberto (proteção interna, abre após N falhas consecutivas).
  const isCircuitAberto =
    errorCode === 'CIRCUIT_ABERTO' || /CIRCUIT_ABERTO|temporariamente bloqueada/i.test(error);
  // Cadeia TLS do SERVIDOR SEFAZ desatualizada — AC intermediária do servidor
  // SEFAZ não está na nossa cadeia local. NÃO tem relação com o A1 da CAPUL.
  // Detectar ANTES de isCertProblem pra não cair no card errado.
  const isCadeiaTls =
    errorCode === 'CADEIA_TLS_SERVIDOR_DESATUALIZADA' ||
    /CADEIA_TLS|Cadeia TLS do SEFAZ|unable to get.*issuer|UNABLE_TO_GET_ISSUER|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED/i.test(error);
  // Cert A1 da CAPUL com problema (expirado, senha errada, PFX corrompido).
  // Detectar DEPOIS de isCadeiaTls. Regex original "certificado|TLS" capturava
  // cadeia_tls também — agora isCadeiaTls roda primeiro.
  const isCertProblem =
    errorCode === 'CERT_INVALIDO' ||
    /CERT_INVALIDO|certificate expired|CERT_HAS_EXPIRED|bad decrypt|certificado digital A1|FISCAL_CNPJ_CONSULENTE|mTLS/i.test(error);
  // SEFAZ em contingência: TCP reset pelo servidor remoto (ECONNRESET,
  // socket hang up, etc). Card dedicado pra deixar claro que NÃO é problema
  // da CAPUL e instruir a usar fallback local. Detectar ANTES de isUnavailable.
  const isContingencia =
    errorCode === 'SEFAZ_CONTINGENCIA' ||
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

  if (isLimiteAtingido) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Hourglass className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
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
            A plataforma limita o total de consultas SEFAZ que a CAPUL faz por dia,
            para proteger nosso CNPJ contra bloqueio do SEFAZ por uso abusivo.
            Esse limite foi atingido — novas consultas SEFAZ ao vivo retornarão
            ao normal <strong>após 00:00</strong>.
          </p>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Use o botão <strong>"Base local (RFB)"</strong> — não consome cota.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Em <strong>emergência</strong>, ADMIN_TI pode liberar mais consultas em{' '}
                  <strong>Operação → Limites</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>O contador zera automaticamente à meia-noite.</span>
              </li>
            </ul>
          </div>
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
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900">
                Consultas{uf ? ` à UF ${uf}` : ''} temporariamente bloqueadas pela plataforma
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Proteção interna (circuit breaker) — abre após várias falhas consecutivas no SEFAZ.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            Detectamos várias falhas consecutivas no SEFAZ{uf ? ` de ${uf}` : ''} nos
            últimos minutos. Para não sobrecarregar mais um servidor que já está
            instável (e proteger nossa cota), a plataforma fechou temporariamente o
            acesso a essa UF. O bloqueio reabre sozinho assim que o SEFAZ voltar.
          </p>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  <strong>Aguarde alguns minutos</strong> — o circuit breaker reabre automaticamente.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Outras UFs continuam funcionando normalmente — o bloqueio é por UF.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Confira o status do SEFAZ no{' '}
                  <a
                    href="https://www.nfe.fazenda.gov.br/portal/disponibilidade.aspx"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 underline hover:text-amber-900 font-medium"
                  >
                    portal de disponibilidade ↗
                  </a>
                </span>
              </li>
            </ul>
          </div>
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
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-orange-900">
                Cadeia TLS do servidor SEFAZ{uf ? ` de ${uf}` : ''} desatualizada
              </h3>
              <p className="text-xs text-orange-700 mt-0.5">
                Requer ação do ADMIN_TI — NÃO é problema do certificado A1 da CAPUL.
              </p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4 text-sm text-slate-700">
          <p>
            O servidor SEFAZ{uf ? ` de ${uf}` : ''} usa uma <strong>AC intermediária</strong>{' '}
            (Autoridade Certificadora) que a plataforma ainda não conhece. Isso
            costuma acontecer quando o estado troca o emissor do cert do servidor
            e a nossa cadeia local de ACs (`/app/certs/icp-brasil/`) ainda não foi
            atualizada.
          </p>
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-900">
              <strong>Importante:</strong> esse erro é sobre o cert do <em>SERVIDOR SEFAZ</em>,
              não sobre o cert A1 da CAPUL. NÃO precisa revisar o A1 — ele continua válido.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-slate-400 mt-0.5">•</span>
                <span>
                  Peça ao <strong>ADMIN_TI</strong> para abrir <strong>Operação → Diagnóstico → Cadeia TLS</strong>{' '}
                  e clicar no botão <strong>"Atualizar cadeia"</strong>.
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
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: CADEIA_TLS_SERVIDOR_DESATUALIZADA · HTTP 503
          </p>
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
              <span>Arquivo PFX corrompido ou substituído por outro arquivo.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400 mt-0.5">•</span>
              <span>Nenhum certificado marcado como ativo.</span>
            </li>
          </ul>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">O que fazer?</h4>
            <p>
              Abrir <strong>Configurador → Certificado Fiscal</strong> e conferir:
              certificado ativo, dentro da validade, senha correta. Se precisar
              reimportar, peça ao ADMIN_TI. Enquanto isso, "Base local (RFB)" não
              depende do A1 e continua funcionando.
            </p>
          </div>
          <p className="text-xs text-slate-400 font-mono border-t border-slate-100 pt-3">
            Código: CERT_INVALIDO · HTTP 503
          </p>
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
