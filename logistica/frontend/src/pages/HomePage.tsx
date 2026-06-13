import { Link } from 'react-router-dom';
import { MapPin, Package, Truck, Route, BarChart3, ClipboardList, FileCheck } from 'lucide-react';

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Bem-vindo à Logística</h2>
        <p className="text-sm text-slate-500">
          Gestão de entregas domiciliares e frota — Plataforma Capul.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/painel"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <BarChart3 className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Painel</div>
          <div className="text-xs text-slate-500">Indicadores de entregas e frota</div>
        </Link>

        <Link
          to="/clientes"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <MapPin className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Endereços</div>
          <div className="text-xs text-slate-500">Consulta por telefone, nome ou matrícula</div>
        </Link>

        <Link
          to="/entregas/nova"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Package className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Nova Entrega</div>
          <div className="text-xs text-slate-500">Cadastro com CEP e Protheus</div>
        </Link>

        <Link
          to="/entregas"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <ClipboardList className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Entregas</div>
          <div className="text-xs text-slate-500">Todas as entregas — filtros e edição</div>
        </Link>

        <Link
          to="/comprovantes"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <FileCheck className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Comprovantes</div>
          <div className="text-xs text-slate-500">Provas de entrega (financeiro)</div>
        </Link>

        <Link
          to="/veiculos"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Truck className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Frota</div>
          <div className="text-xs text-slate-500">Cadastro de veículos</div>
        </Link>

        <Link
          to="/viagens"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Route className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Viagens</div>
          <div className="text-xs text-slate-500">Montar rota, despachar e baixar</div>
        </Link>
      </div>
    </div>
  );
}
