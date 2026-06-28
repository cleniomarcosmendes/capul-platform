import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [erro, setErro] = useState('');
  const { login: doLogin, loading } = useAuth();
  const navigate = useNavigate();

  // MFA state
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await doLogin(login, senha);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { message?: string; mfaToken?: string; response?: { data?: { message?: string | string[] } } };
      if (e?.message === 'MFA_REQUIRED' && e?.mfaToken) {
        setMfaToken(e.mfaToken);
        setMfaStep(true);
        setMfaCode('');
        setTimeout(() => mfaInputRef.current?.focus(), 100);
        return;
      }
      const msg =
        e?.response?.data?.message?.[0] ||
        e?.response?.data?.message ||
        'Erro ao fazer login';
      setErro(typeof msg === 'string' ? msg : 'Credenciais invalidas');
    }
  }

  async function handleMfaSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMfaLoading(true);
    try {
      const response = await authService.mfaLogin(mfaToken, mfaCode);
      // Login completo — recarregar pagina para atualizar AuthContext
      if (response.usuario) {
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string | string[] } } };
      const msg = e?.response?.data?.message || 'Codigo invalido';
      setErro(typeof msg === 'string' ? msg : 'Codigo invalido');
      setMfaCode('');
      mfaInputRef.current?.focus();
    } finally {
      setMfaLoading(false);
    }
  }

  function handleBackToLogin() {
    setMfaStep(false);
    setMfaToken('');
    setMfaCode('');
    setErro('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-capul-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-capul-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">C</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            Capul Systems
          </h1>
          <p className="text-slate-500 mt-1">Plataforma Corporativa</p>
        </div>

        {/* Card de Login */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {!mfaStep ? (
            <>
              <h2 className="text-lg font-semibold text-slate-800 mb-6">
                Entrar
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Login
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Username ou email"
                    autoComplete="username"
                    required
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent
                      placeholder:text-slate-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showSenha ? 'text' : 'password'}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-lg text-sm
                        focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent
                        placeholder:text-slate-400 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha((v) => !v)}
                      aria-label={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showSenha}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 flex items-center justify-center w-10 text-slate-400
                        hover:text-slate-600 focus:outline-none focus-visible:text-capul-600 transition-colors"
                    >
                      {showSenha ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 3l18 18M10.584 10.587a2 2 0 002.828 2.83M9.363 5.365A9.466 9.466 0 0112 5c4.478 0 8.268 2.943 9.542 7a9.97 9.97 0 01-1.563 2.93M6.1 6.1A9.969 9.969 0 002.458 12C3.732 16.057 7.522 19 12 19a9.46 9.46 0 005.169-1.521" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {erro && (
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-capul-600 text-white font-medium py-2.5 px-4 rounded-lg
                    hover:bg-capul-700 focus:outline-none focus:ring-2 focus:ring-capul-600 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full mb-3">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Verificacao em Dois Fatores
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Digite o codigo de 6 digitos do seu aplicativo autenticador
                </p>
              </div>

              <form onSubmit={handleMfaSubmit} className="space-y-5">
                <div>
                  <input
                    ref={mfaInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoComplete="one-time-code"
                    required
                    className="w-full px-4 py-4 border border-slate-300 rounded-lg text-center text-2xl font-mono tracking-[0.5em]
                      focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent
                      placeholder:text-slate-300 transition-all"
                  />
                </div>

                {erro && (
                  <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                    {erro}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={mfaLoading || mfaCode.length !== 6}
                  className="w-full bg-capul-600 text-white font-medium py-2.5 px-4 rounded-lg
                    hover:bg-capul-700 focus:outline-none focus:ring-2 focus:ring-capul-600 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                >
                  {mfaLoading ? 'Verificando...' : 'Verificar'}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Voltar ao login
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Capul Systems &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
