import { Link } from 'react-router-dom';
import { MapPin, Package, Truck, Route, BarChart3, ClipboardList, FileCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Grupos de papel espelham o menu lateral (Layout.tsx) — os tiles da home NÃO
// devem oferecer o que o backend depois bloqueia (senão o entregador vê tudo e
// só descobre o 403 ao clicar). ADMIN passa em tudo.
const GESTORES = ['GESTOR_ENTREGA', 'GESTOR_FROTA'];
const ENTREGA = ['OPERADOR_ENTREGA', 'GESTOR_ENTREGA'];
// Caixa/balcão: só REGISTRAR e ALTERAR entregas (não monta rota, não vê frota).
const REGISTRO_ENTREGA = ['REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA'];
const FROTA_GESTORES = ['GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA'];

const TILES = [
  { to: '/painel', icon: BarChart3, titulo: 'Painel', sub: 'Indicadores de entregas e frota', roles: GESTORES },
  { to: '/clientes', icon: MapPin, titulo: 'Endereços', sub: 'Consulta por telefone, nome ou matrícula', roles: ENTREGA },
  { to: '/entregas/nova', icon: Package, titulo: 'Nova Entrega', sub: 'Cadastro com CEP e Protheus', roles: REGISTRO_ENTREGA },
  { to: '/entregas', icon: ClipboardList, titulo: 'Entregas', sub: 'Todas as entregas — filtros e edição', roles: REGISTRO_ENTREGA },
  { to: '/comprovantes', icon: FileCheck, titulo: 'Comprovantes', sub: 'Provas de entrega (financeiro)', roles: ENTREGA },
  { to: '/veiculos', icon: Truck, titulo: 'Frota', sub: 'Cadastro de veículos', roles: FROTA_GESTORES },
  { to: '/viagens', icon: Route, titulo: 'Rotas de Entrega', sub: 'Montar rota, despachar e baixar', roles: ENTREGA },
];

export function HomePage() {
  const { logisticaRole } = useAuth();
  const isAdmin = logisticaRole === 'ADMIN';
  const can = (roles?: string[]) => isAdmin || !roles || (logisticaRole != null && roles.includes(logisticaRole));
  const visiveis = TILES.filter((t) => can(t.roles));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Bem-vindo à Logística</h2>
        <p className="text-sm text-slate-500">
          Gestão de entregas domiciliares e frota — Plataforma Capul.
        </p>
      </div>

      {visiveis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visiveis.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <t.icon className="h-7 w-7 text-capul-600" />
              <div className="mt-3 font-medium text-slate-800">{t.titulo}</div>
              <div className="text-xs text-slate-500">{t.sub}</div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Seu perfil executa em campo pelo <b>aplicativo</b> (entregas/rotas no celular) — não há telas de gestão no desktop.
        </p>
      )}
    </div>
  );
}
