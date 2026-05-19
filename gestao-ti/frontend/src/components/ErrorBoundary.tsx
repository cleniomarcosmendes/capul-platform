import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { erro: Error | null }

/**
 * ErrorBoundary global do Gestão TI. Antes não havia nenhum — qualquer
 * exceção de render em qualquer página/filho desmontava a árvore React
 * inteira e o usuário via uma TELA BRANCA sem saída (incidente Clenio
 * 18/05: clicar em projeto sem acesso). Agora um crash vira uma tela
 * amigável com Recarregar / Voltar, e o erro fica no console pra
 * diagnóstico (não some).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // Mantém o erro visível no console (não engole) p/ diagnóstico.
    console.error('[ErrorBoundary] crash de render capturado:', erro, info.componentStack);
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg w-full bg-white rounded-xl border border-red-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-800">Algo deu errado nesta tela</h2>
              <p className="text-sm text-slate-600 mt-2">
                Ocorreu um erro inesperado ao montar a página. Seus dados não foram
                perdidos. Tente recarregar; se persistir, avise a equipe de TI
                informando o que você estava fazendo.
              </p>
              <p className="text-xs text-slate-400 mt-2 font-mono break-words">
                {this.state.erro.message}
              </p>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-capul-600 text-white rounded-lg text-sm font-medium hover:bg-capul-700"
                >
                  Recarregar
                </button>
                <a
                  href="/gestao-ti"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"
                >
                  Voltar ao início
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
