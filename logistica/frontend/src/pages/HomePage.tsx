import { Link } from 'react-router-dom';
import { Users, Package, Truck } from 'lucide-react';

export function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Bem-vindo à Logística</h2>
        <p className="text-sm text-slate-500">
          Gestão de entregas domiciliares e frota — Plataforma Capul (Fase 1a).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/clientes"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Users className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Clientes &amp; Endereços</div>
          <div className="text-xs text-slate-500">Cadastro local e busca unificada</div>
        </Link>

        <Link
          to="/entregas/nova"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Package className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Nova Entrega</div>
          <div className="text-xs text-slate-500">Cadastro + fila de pendentes</div>
        </Link>

        <Link
          to="/veiculos"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <Truck className="h-7 w-7 text-sky-600" />
          <div className="mt-3 font-medium text-slate-800">Frota</div>
          <div className="text-xs text-slate-500">Cadastro de veículos</div>
        </Link>

        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-5">
          <Package className="h-7 w-7 text-slate-300" />
          <div className="mt-3 font-medium text-slate-400">Viagens</div>
          <div className="text-xs text-slate-400">Em construção (PR5)</div>
        </div>
      </div>
    </div>
  );
}
