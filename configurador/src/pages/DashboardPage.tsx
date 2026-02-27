import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../layouts/Header';
import { empresaService } from '../services/empresa.service';
import { filialService } from '../services/filial.service';
import { departamentoService } from '../services/departamento.service';
import { centroCustoService } from '../services/centro-custo.service';
import { usuarioService } from '../services/usuario.service';
import { Building2, Building, Wallet, Users } from 'lucide-react';
import type { Empresa } from '../types';

export function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [totalFiliais, setTotalFiliais] = useState(0);
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [usuariosAtivos, setUsuariosAtivos] = useState(0);
  const [totalDepartamentos, setTotalDepartamentos] = useState(0);
  const [totalCentrosCusto, setTotalCentrosCusto] = useState(0);

  useEffect(() => {
    async function carregar() {
      try {
        const [empresas, filiais, usuarios, departamentos, centrosCusto] = await Promise.all([
          empresaService.listar(),
          filialService.listar(),
          usuarioService.listar(),
          departamentoService.listar(),
          centroCustoService.listar(),
        ]);
        if (empresas.length > 0) setEmpresa(empresas[0]);
        setTotalFiliais(filiais.length);
        setTotalUsuarios(usuarios.length);
        setUsuariosAtivos(usuarios.filter((u) => u.status === 'ATIVO').length);
        setTotalDepartamentos(departamentos.length);
        setTotalCentrosCusto(centrosCusto.length);
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  const cards = [
    {
      label: 'Filiais',
      value: totalFiliais,
      icon: Building2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      path: '/configurador/empresa',
    },
    {
      label: 'Usuarios',
      value: `${usuariosAtivos} / ${totalUsuarios}`,
      sublabel: 'ativos / total',
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      path: '/configurador/usuarios',
    },
    {
      label: 'Departamentos',
      value: totalDepartamentos,
      icon: Building,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      path: '/configurador/departamentos',
    },
    {
      label: 'Centros de Custo',
      value: totalCentrosCusto,
      icon: Wallet,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: '/configurador/centros-custo',
    },
  ];

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Carregando...</div>
        ) : (
          <>
            {/* Empresa Info */}
            {empresa && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{empresa.nomeFantasia}</h3>
                    <p className="text-sm text-slate-500">{empresa.razaoSocial}</p>
                    {empresa.cnpjMatriz && (
                      <p className="text-sm text-slate-400 mt-1">CNPJ: {empresa.cnpjMatriz}</p>
                    )}
                  </div>
                  <button
                    onClick={() => navigate('/configurador/empresa')}
                    className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Gerenciar
                  </button>
                </div>
              </div>
            )}

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.label}
                    onClick={() => navigate(card.path)}
                    className="bg-white rounded-xl border border-slate-200 p-6 text-left hover:shadow-md hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                    <p className="text-sm text-slate-500">{card.label}</p>
                    {card.sublabel && (
                      <p className="text-xs text-slate-400 mt-0.5">{card.sublabel}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
