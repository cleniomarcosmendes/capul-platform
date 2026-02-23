import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login: doLogin, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    try {
      await doLogin(login, senha);
      navigate('/');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message?.[0] ||
        err?.response?.data?.message ||
        'Erro ao fazer login';
      setErro(typeof msg === 'string' ? msg : 'Credenciais invalidas');
    }
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
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent
                  placeholder:text-slate-400 transition-all"
              />
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
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Capul Systems &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
