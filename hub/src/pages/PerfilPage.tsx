import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { ArrowLeft, User, Mail, Phone, Building2, Shield } from 'lucide-react';

export default function PerfilPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  if (!usuario) return null;

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setErro('');

    if (novaSenha !== confirmSenha) {
      setErro('As senhas nao conferem');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword(senhaAtual, novaSenha);
      setMsg('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmSenha('');
    } catch (err: any) {
      setErro(
        err?.response?.data?.message?.[0] ||
          err?.response?.data?.message ||
          'Erro ao alterar senha',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-capul-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-semibold text-slate-800">Meu Perfil</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Dados do Usuario */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">
            Dados Pessoais
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoItem icon={User} label="Nome" value={usuario.nome} />
            <InfoItem icon={User} label="Username" value={usuario.username} />
            <InfoItem
              icon={Mail}
              label="Email"
              value={usuario.email || 'Nao informado'}
            />
            <InfoItem
              icon={Phone}
              label="Telefone"
              value={usuario.telefone || 'Nao informado'}
            />
            <InfoItem
              icon={Building2}
              label="Filial"
              value={
                usuario.filialAtual
                  ? `${usuario.filialAtual.codigo} - ${usuario.filialAtual.nome}`
                  : 'Nao definida'
              }
            />
            <InfoItem
              icon={Shield}
              label="Modulos"
              value={usuario.modulos
                .map((m) => `${m.nome} (${m.roleNome})`)
                .join(', ')}
            />
          </div>
        </div>

        {/* Alterar Senha */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-4">
            Alterar Senha
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Senha Atual
              </label>
              <input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                  focus:outline-none focus:ring-2 focus:ring-capul-600 focus:border-transparent"
              />
            </div>

            {erro && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {erro}
              </div>
            )}
            {msg && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg border border-green-200">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-capul-600 text-white font-medium py-2.5 px-6 rounded-lg text-sm
                hover:bg-capul-700 focus:outline-none focus:ring-2 focus:ring-capul-600 focus:ring-offset-2
                disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-800">{value}</p>
      </div>
    </div>
  );
}
