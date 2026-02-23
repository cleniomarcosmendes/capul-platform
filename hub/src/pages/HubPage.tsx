import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Package,
  Monitor,
  LogOut,
  User,
  Building2,
  ChevronDown,
} from 'lucide-react';
import type { ModuloUsuario } from '../types';

const ICONE_MAP: Record<string, typeof Package> = {
  package: Package,
  monitor: Monitor,
};

function ModuloCard({ modulo }: { modulo: ModuloUsuario }) {
  const Icone = ICONE_MAP[modulo.icone] || Package;

  return (
    <a
      href={modulo.url}
      className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm
        hover:shadow-lg hover:border-slate-300 hover:-translate-y-1
        transition-all duration-200 block"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${modulo.cor}15` }}
      >
        <Icone size={24} style={{ color: modulo.cor }} />
      </div>
      <h3 className="font-semibold text-slate-800 text-lg mb-1">
        {modulo.nome}
      </h3>
      <p className="text-sm text-slate-500">
        {modulo.roleNome}
      </p>
    </a>
  );
}

export default function HubPage() {
  const { usuario, logout, switchFilial } = useAuth();
  const navigate = useNavigate();
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (!usuario) return null;

  async function handleSwitchFilial(filialId: string) {
    setSwitching(true);
    try {
      await switchFilial(filialId);
      setShowFilialModal(false);
    } finally {
      setSwitching(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-capul-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-capul-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <div>
              <h1 className="font-semibold text-slate-800 text-sm">
                Capul Systems
              </h1>
              {usuario.filialAtual && (
                <button
                  onClick={() => setShowFilialModal(true)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-capul-600 transition-colors"
                >
                  <Building2 size={12} />
                  {usuario.filialAtual.codigo} - {usuario.filialAtual.nome}
                  <ChevronDown size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/perfil')}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-capul-600
                px-3 py-2 rounded-lg hover:bg-slate-50 transition-all"
            >
              <User size={16} />
              {usuario.nome}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600
                px-3 py-2 rounded-lg hover:bg-red-50 transition-all"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-800">
            Bem-vindo, {usuario.nome.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 mt-1">
            Selecione o modulo que deseja acessar
          </p>
        </div>

        {usuario.modulos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500">
              Voce ainda nao tem acesso a nenhum modulo.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Solicite acesso ao administrador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {usuario.modulos.map((modulo) => (
              <ModuloCard key={modulo.codigo} modulo={modulo} />
            ))}
          </div>
        )}
      </main>

      {/* Modal Trocar Filial */}
      {showFilialModal && usuario.filiais && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Trocar Filial
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {usuario.filiais.map((filial) => (
                <button
                  key={filial.id}
                  onClick={() => handleSwitchFilial(filial.id)}
                  disabled={
                    switching || filial.id === usuario.filialAtual?.id
                  }
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm
                    ${
                      filial.id === usuario.filialAtual?.id
                        ? 'bg-capul-50 border-capul-200 text-capul-700'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }
                    disabled:opacity-50`}
                >
                  <span className="font-medium">{filial.codigo}</span>
                  <span className="ml-2">{filial.nome}</span>
                  {filial.id === usuario.filialAtual?.id && (
                    <span className="ml-2 text-xs text-capul-500">(atual)</span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowFilialModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800
                  rounded-lg hover:bg-slate-100 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
