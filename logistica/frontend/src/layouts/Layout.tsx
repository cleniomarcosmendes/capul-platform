import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MapPin, Truck, LogOut, ExternalLink, Package, Car, Route, BarChart3, TrendingUp, FileCheck, ClipboardList, Fuel, Banknote, CircleDot, Gauge, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Grupos de role para gatear o menu (o backend é a fonte da verdade do RBAC;
// aqui é só visual). ADMIN vê tudo (tratado no filtro). Espelha a matriz de
// acessos da Fase 2: condutor opera por matrícula+senha no terminal de frota.
const ENTREGA = ['OPERADOR_ENTREGA', 'GESTOR_ENTREGA'];
// Caixa/balcão (login PADRAO): só REGISTRAR e ALTERAR entregas — não monta rota,
// não vê frota/comprovantes. Espelha o @Roles do backend (create/edit/operador).
const REGISTRO_ENTREGA = ['REGISTRADOR_ENTREGA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA'];
const FROTA_OP = ['OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA'];
// "Registro de Viagem" (ex-"Saída de Veículos") é o caderno digital da frota: vale para
// QUALQUER colaborador que
// pega um carro da empresa, não é privilégio de gestor nem processo do RDV. SUPERVISOR
// e COORDENADOR entraram em 01/08 — ambos têm veículo alocado para o trabalho e o
// backend já os autoriza nas rotas de operação; só o app oferecia esse caminho, o que
// obrigava a pegar o celular para registrar uma saída que o computador ao lado resolve.
// Lista PRÓPRIA (não estendi FROTA_OP) porque o Monitor da Frota — que também usa
// FROTA_OP — responde 403 para eles: item de menu a mais abre tela vazia.
// REGISTRADOR_FROTA e PORTARIA entraram em 01/09: as duas roles existem para
// operar ESTA tela e não tinham item de menu nenhum — logavam e viam só "Início".
// O backend já as autorizava (frota.controller: a classe inclui REGISTRADOR_FROTA;
// PORTARIA tem fluxo próprio em POST /frota/viagens/portaria + retorno-portaria +
// condutores/busca) e a FrotaPage já tem o modo PORTARIA embutido. Faltava só o
// caminho até lá — não há deep link, então esconder do menu é esconder a tela.
// A PORTARIA fica com ESTE item e mais nenhum, de propósito: o porteiro só aponta
// entrada/saída no portão. Os demais itens da seção FROTA usam listas próprias
// (FROTA_OP/FROTA_GESTAO/FROTA_GESTORES) e continuam fora para as duas — o backend
// as barra lá (ex.: GET /frota/painel não inclui REGISTRADOR_FROTA).
const FROTA_SAIDA = [...FROTA_OP, 'SUPERVISOR', 'COORDENADOR', 'REGISTRADOR_FROTA', 'PORTARIA'];
// Telas de gestão de ENTREGAS (Painel, Indicadores, Análise). Espelha o
// @Roles do painel.controller. GESTOR_FROTA fica de FORA: via os itens e tomava
// 403 em todos (a frota dele está na seção FROTA + "Análise da Frota").
// SUPERVISOR_FROTA (Supervisor de Departamento) ENTRA: responde pelo setor —
// aprova o acerto das despesas — e acompanha o resultado das entregas dele.
const GESTAO_ENTREGAS = ['GESTOR_ENTREGA', 'SUPERVISOR_FROTA'];
// Gestão da FROTA que o Supervisor de Departamento também acessa (escopado ao seu
// departamento no backend): Monitor, Linha do KM e Veículos.
const FROTA_GESTORES = ['GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR_FROTA'];
// Custo/análise de FROTA (Custos da Frota + Análise da Frota): domínio do Gestor de
// Frota (+ ADMIN via bypass) e do supervisor do veículo (via escopo de dados). Nem
// Gestor de Entregas nem Operador entram — senão veem a tela vazia (a consulta é
// escopada a gestor de frota/supervisor do veículo). O supervisor do veículo ainda
// lança/vê despesas pelo detalhe da rota de frota.
const FROTA_GESTAO = ['GESTOR_FROTA', 'SUPERVISOR_FROTA'];
// Prestação de Contas (RDV) — processo INTERNO do setor: Supervisor de Departamento
// (admin), Coordenador (aprova o seu time) e Supervisor de Área (planeja). Gestores de
// entrega/frota NÃO entram (o backend os barra). ADMIN vê via bypass. As ABAS internas
// são gateadas por perfil dentro da SupervisoresPage.
const SUPERVISORES_MENU = ['SUPERVISOR_FROTA', 'COORDENADOR', 'SUPERVISOR'];

type NavEntry =
  | { section: string; roles?: string[] }
  | { to: string; label: string; icon: typeof Home; end?: boolean; roles?: string[] };

const navItems: NavEntry[] = [
  { to: '/', label: 'Início', icon: Home, end: true },

  // Sem `roles`: a seção sobrevive se QUALQUER item abaixo sobreviver (o filtro
  // de órfãos remove o cabeçalho quando não sobra nenhum). Fixar papéis aqui
  // esconderia o cabeçalho do Gestor de Frota e deixaria "Análise da Frota" solta.
  { section: 'GESTÃO' },
  { to: '/painel', label: 'Painel', icon: BarChart3, roles: GESTAO_ENTREGAS },
  { to: '/indicadores', label: 'Indicadores de Entrega', icon: TrendingUp, roles: GESTAO_ENTREGAS },
  { to: '/analise-entregas', label: 'Análise de Entregas', icon: TrendingUp, roles: GESTAO_ENTREGAS },
  { to: '/frota/analise', label: 'Análise da Frota', icon: TrendingUp, roles: FROTA_GESTAO },

  { section: 'ENTREGAS', roles: REGISTRO_ENTREGA },
  { to: '/entregas/nova', label: 'Nova Entrega', icon: Package, roles: REGISTRO_ENTREGA },
  { to: '/entregas', label: 'Entregas', icon: ClipboardList, end: true, roles: REGISTRO_ENTREGA },
  { to: '/viagens', label: 'Rotas de Entrega', icon: Route, roles: ENTREGA },
  { to: '/comprovantes', label: 'Comprovantes', icon: FileCheck, roles: ENTREGA },
  { to: '/clientes', label: 'Endereços', icon: MapPin, roles: ENTREGA },

  { section: 'FROTA', roles: FROTA_SAIDA },
  { to: '/frota', label: 'Registro de Viagem', icon: Fuel, end: true, roles: FROTA_SAIDA },
  // Monitor entra em FROTA_OP: o Operador de Entrega atende o cliente que liga
  // perguntando da entrega e precisa ver as rotas na rua / o mapa ao vivo. O custo
  // continua escondido para ele (o backend nem envia).
  { to: '/frota/painel', label: 'Monitor da Frota', icon: CircleDot, roles: FROTA_OP },
  { to: '/despesas', label: 'Custos da Frota', icon: Banknote, roles: FROTA_GESTAO },
  { to: '/frota/linha-km', label: 'Linha do KM', icon: Gauge, roles: FROTA_GESTORES },
  { to: '/veiculos', label: 'Veículos', icon: Car, roles: FROTA_GESTORES },

  { section: 'SUPERVISORES', roles: SUPERVISORES_MENU },
  { to: '/supervisores', label: 'Prestação de Contas (RDV)', icon: Users, roles: SUPERVISORES_MENU },
];

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, logisticaRoles, temRole, logout } = useAuth();

  const isAdmin = temRole('ADMIN');
  const can = (roles?: string[]) => isAdmin || !roles || temRole(...roles);

  // Filtra por role e remove cabeçalhos de seção que ficaram órfãos (sem item logo abaixo).
  const visible = navItems.filter((item) => can(item.roles)).filter((item, idx, arr) => {
    if (!('section' in item)) return true;
    const next = arr[idx + 1];
    return next != null && !('section' in next);
  });

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      <aside className="flex w-60 flex-col bg-slate-800 text-slate-100 print:hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700">
          <Truck className="h-6 w-6 text-capul-400" />
          <div>
            <div className="text-sm font-semibold">Logística</div>
            <div className="text-[11px] text-slate-400">Entregas &amp; Frota</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {visible.map((item, idx) => {
            if ('section' in item) {
              return (
                <div key={`s-${item.section}`} className={`px-3 pb-1 ${idx > 0 ? 'mt-4 pt-2 border-t border-slate-700/60' : ''}`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400" style={{ letterSpacing: '0.12em' }}>
                    {item.section}
                  </p>
                </div>
              );
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-capul-600/20 text-capul-300 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <a
          href="/"
          className="flex items-center gap-2 px-5 py-3 text-xs text-slate-400 hover:text-slate-200 border-t border-slate-700"
        >
          <ExternalLink className="h-4 w-4" /> Voltar ao Hub
        </a>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <h1 className="text-base font-semibold text-slate-700">Módulo Logística</h1>
          <div className="flex items-center gap-3 text-sm">
            {logisticaRoles.length > 0 && (
              <span className="rounded-full bg-capul-100 px-2 py-0.5 text-xs font-medium text-capul-700">
                {logisticaRoles.join(' · ')}
              </span>
            )}
            <span className="text-slate-600">{usuario?.nome}</span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-700" title="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
