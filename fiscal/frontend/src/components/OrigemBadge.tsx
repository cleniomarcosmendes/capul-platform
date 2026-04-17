import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  Database,
  FlaskConical,
  RotateCw,
  XCircle,
} from 'lucide-react';
import { fiscalApi } from '../services/api';
import { extractApiError } from '../utils/errors';
import type { ProtheusStatus } from '../types';

interface OrigemBadgeProps {
  status: ProtheusStatus;
  /** Tipo de documento para montar a URL de regravação */
  tipoDocumento: 'nfe' | 'cte';
  chave: string;
  filial: string;
  /** Callback chamado após a regravação para atualizar o estado na página */
  onReexecutar?: (novoStatus: ProtheusStatus) => void;
}

/**
 * Badge de transparência da integração com o Protheus.
 *
 * Mostra ao usuário final 4 peças de informação:
 *  1. Origem do XML (cache Protheus ou download SEFAZ)
 *  2. Status da gravação no Protheus (SZR010/SZQ010)
 *  3. Mensagem técnica detalhada quando algo falhou
 *  4. Botão de retry quando a gravação falhou
 *
 * As cores seguem o princípio "verde só quando tudo deu certo":
 *  - 🟢 Verde: cache hit OU download + gravação bem-sucedidos
 *  - 🟡 Amarelo: dados OK mas gravação falhou (dados disponíveis, mas não persistidos)
 *  - 🔴 Vermelho: nem leitura nem gravação funcionaram (Protheus offline)
 *  - ⚪ Cinza: modo mock ativo (dev only)
 */
export function OrigemBadge({
  status,
  tipoDocumento,
  chave,
  filial,
  onReexecutar,
}: OrigemBadgeProps) {
  const [reexecutando, setReexecutando] = useState(false);
  const [erroReexecucao, setErroReexecucao] = useState<string | null>(null);

  // Modo mock: exibimos um banner dedicado informando que o Protheus NAO foi
  // realmente consultado — qualquer "cache hit" ou "gravado" é simulação em
  // memória do ProtheusXmlMock. Nao misturar com os estados de sucesso/erro
  // reais para nao criar falsa sensacao de integração funcionando.
  if (status.modoMock) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-amber-400 bg-amber-50/60 overflow-hidden">
        <div className="px-5 py-3 flex items-start gap-3">
          <FlaskConical className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-semibold text-amber-900">
              Integração Protheus em modo SIMULAÇÃO (mock)
            </div>
            <div className="mt-1 text-xs text-amber-800 space-y-1.5">
              <p>
                A variável <code className="rounded bg-amber-100 px-1 font-mono">FISCAL_PROTHEUS_MOCK=true</code>{' '}
                está ativa. Isso significa que <strong>as chamadas à API xmlFiscal não
                estão atingindo o ERP Protheus real</strong> — estão sendo respondidas por
                um stub em memória dentro do próprio backend Fiscal.
              </p>
              <p>
                O XML que você está visualizando <strong>foi baixado da SEFAZ com sucesso</strong>{' '}
                (essa parte é real), mas a mensagem de "cache Protheus" ou "gravado em
                SZR010/SZQ010" não reflete o estado do ERP — é comportamento simulado
                para desenvolvimento.
              </p>
              <p>
                <strong>Próximo passo:</strong> após a reunião de 14/04/2026 com a equipe
                Protheus, quando a API real estiver publicada, basta trocar a variável
                para <code className="rounded bg-amber-100 px-1 font-mono">FISCAL_PROTHEUS_MOCK=false</code>{' '}
                — a integração passa a ser real sem nenhuma alteração de código.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cor = inferirCor(status);

  async function handleReexecutar() {
    setErroReexecucao(null);
    setReexecutando(true);
    try {
      const { data } = await fiscalApi.post<ProtheusStatus>(
        `/${tipoDocumento}/${chave}/filial/${filial}/regravar-protheus`,
      );
      if (onReexecutar) onReexecutar(data);
    } catch (err) {
      setErroReexecucao(extractApiError(err, 'Falha ao tentar novamente. Tente daqui a alguns minutos.'));
    } finally {
      setReexecutando(false);
    }
  }

  const esquemaCor = {
    verde: {
      borda: 'border-emerald-200',
      fundo: 'bg-emerald-50',
      textoTitulo: 'text-emerald-900',
      textoCorpo: 'text-emerald-800',
      icone: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
    },
    amarelo: {
      borda: 'border-amber-200',
      fundo: 'bg-amber-50',
      textoTitulo: 'text-amber-900',
      textoCorpo: 'text-amber-800',
      icone: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    },
    vermelho: {
      borda: 'border-red-200',
      fundo: 'bg-red-50',
      textoTitulo: 'text-red-900',
      textoCorpo: 'text-red-800',
      icone: <XCircle className="h-5 w-5 text-red-600" />,
    },
    cinza: {
      borda: 'border-slate-200',
      fundo: 'bg-slate-50',
      textoTitulo: 'text-slate-800',
      textoCorpo: 'text-slate-600',
      icone: <Database className="h-5 w-5 text-slate-500" />,
    },
  }[cor];

  return (
    <div className={`mb-4 rounded-lg border ${esquemaCor.borda} ${esquemaCor.fundo} overflow-hidden`}>
      <div className="px-5 py-3 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">{esquemaCor.icone}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${esquemaCor.textoTitulo}`}>
            {inferirTitulo(status)}
          </div>
          <div className={`mt-1 space-y-1 text-xs ${esquemaCor.textoCorpo}`}>
            {/* Linha 1 — Origem (SEFAZ ou Protheus) */}
            <div className="flex items-center gap-1.5">
              {status.leitura === 'CACHE_HIT' ? (
                <>
                  <Database className="h-3.5 w-3.5 shrink-0" />
                  <span>XML obtido do Protheus (SZR010 / cache)</span>
                </>
              ) : (
                <>
                  <CloudDownload className="h-3.5 w-3.5 shrink-0" />
                  <span>XML baixado direto da SEFAZ via certificado A1</span>
                </>
              )}
            </div>

            {/* Linha 2 — Status da gravação */}
            <div className="flex items-center gap-1.5">
              {iconeGravacao(status.gravacao)}
              <span>{textoGravacao(status.gravacao)}</span>
            </div>

            {/* Mensagens de detalhe quando houve falha */}
            {status.leitura === 'FALHA_TECNICA' && status.leituraMensagem && (
              <div className="mt-2 rounded border border-current/20 bg-white/60 p-2">
                <div className="font-semibold">Leitura do Protheus:</div>
                <div>{status.leituraMensagem}</div>
                {status.leituraErro && (
                  <div className="mt-0.5 font-mono text-[10px] opacity-70">
                    Erro técnico: {status.leituraErro}
                  </div>
                )}
              </div>
            )}

            {status.gravacao === 'FALHA_TECNICA' && status.gravacaoMensagem && (
              <div className="mt-2 rounded border border-current/20 bg-white/60 p-2">
                <div className="font-semibold">Gravação no Protheus:</div>
                <div>{status.gravacaoMensagem}</div>
                {status.gravacaoErro && (
                  <div className="mt-0.5 font-mono text-[10px] opacity-70">
                    Erro técnico: {status.gravacaoErro}
                  </div>
                )}
              </div>
            )}

            {erroReexecucao && (
              <div className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-red-800">
                {erroReexecucao}
              </div>
            )}
          </div>

          {/* Botão de retry — só aparece quando há falha */}
          {status.permiteReexecucao && (
            <button
              type="button"
              onClick={handleReexecutar}
              disabled={reexecutando}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-current/30 bg-white px-3 py-1 text-xs font-medium hover:bg-white/80 disabled:opacity-50"
            >
              <RotateCw className={`h-3 w-3 ${reexecutando ? 'animate-spin' : ''}`} />
              {reexecutando ? 'Tentando novamente…' : 'Tentar gravar no Protheus novamente'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function inferirCor(status: ProtheusStatus): 'verde' | 'amarelo' | 'vermelho' | 'cinza' {
  // Cache hit puro ou download+gravação OK → tudo certo
  if (status.leitura === 'CACHE_HIT' && status.gravacao === 'NAO_APLICAVEL') return 'verde';
  if (
    status.leitura === 'CACHE_MISS' &&
    (status.gravacao === 'GRAVADO' || status.gravacao === 'JA_EXISTIA')
  )
    return 'verde';

  // Leitura OK mas gravação falhou → amarelo (dados disponíveis, só não persistidos)
  if (status.gravacao === 'FALHA_TECNICA' && status.leitura !== 'FALHA_TECNICA') return 'amarelo';

  // Ambas falharam → vermelho
  if (status.leitura === 'FALHA_TECNICA' && status.gravacao === 'FALHA_TECNICA') return 'vermelho';

  // Leitura falhou mas gravação funcionou → amarelo (alerta mas deu certo no final)
  if (status.leitura === 'FALHA_TECNICA' && status.gravacao === 'GRAVADO') return 'amarelo';

  // Modo mock / não consultado
  if (status.leitura === 'NAO_CONSULTADO') return 'cinza';

  return 'cinza';
}

function inferirTitulo(status: ProtheusStatus): string {
  if (status.leitura === 'CACHE_HIT') return 'Obtido do Protheus';
  if (status.gravacao === 'GRAVADO') return 'Baixado da SEFAZ e gravado no Protheus';
  if (status.gravacao === 'JA_EXISTIA') return 'Baixado da SEFAZ (já estava no Protheus)';
  if (status.gravacao === 'FALHA_TECNICA' && status.leitura === 'FALHA_TECNICA') {
    return 'Protheus indisponível — dados só em memória';
  }
  if (status.gravacao === 'FALHA_TECNICA') return 'Baixado da SEFAZ, mas NÃO gravado no Protheus';
  if (status.leitura === 'NAO_CONSULTADO') return 'Protheus em modo simulação (dev)';
  return 'Consulta concluída';
}

function iconeGravacao(g: ProtheusStatus['gravacao']) {
  if (g === 'GRAVADO' || g === 'JA_EXISTIA' || g === 'NAO_APLICAVEL') {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  }
  if (g === 'FALHA_TECNICA') {
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" />;
  }
  return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />;
}

function textoGravacao(g: ProtheusStatus['gravacao']): string {
  switch (g) {
    case 'GRAVADO':
      return 'Gravado no Protheus (SZR010 + SZQ010)';
    case 'JA_EXISTIA':
      return 'Já estava gravado no Protheus (race condition benigna)';
    case 'NAO_APLICAVEL':
      return 'Gravação não necessária (veio do cache Protheus)';
    case 'NAO_TENTADO':
      return 'Gravação não foi tentada (falha anterior no fluxo)';
    case 'FALHA_TECNICA':
      return 'Falha ao gravar no Protheus';
  }
}
