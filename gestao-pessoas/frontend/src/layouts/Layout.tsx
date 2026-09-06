import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';

/**
 * O cabeçalho é o mesmo para o avaliador e para o RH, mas o MENU não: quem só
 * responde avaliação vê uma tela só, e para ele barra de navegação é ruído.
 *
 * ⚠️ Item de menu escondido é tela inacessível — não existe deep link aqui. Por
 * isso o menu lê TODOS os papéis do módulo (`departamentos[].role`) e não o
 * campo denormalizado: com o campo denormalizado, quem é RH_ADMIN num
 * departamento e AVALIADOR noutro perderia metade das telas, sem erro nenhum na
 * tela nem no log. Foi assim que `REGISTRADOR_FROTA` ficou com "só Início" na
 * Logística.
 */
export default function Layout() {
  const { usuario, tem } = useAuth();
  const doRh = tem(ROLES.RH_ADMIN, ROLES.RH_CICLO, ROLES.RH_MODELO);
  const avaliador = tem(ROLES.AVALIADOR);
  // Uma opção só não é navegação — é um rótulo repetindo o cabeçalho.
  const mostrarMenu = doRh && avaliador;

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-capul-600">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Users size={18} className="text-white/80" aria-hidden />
          <h1 className="flex-1 truncate font-semibold text-white">Avaliação de Desempenho</h1>
          {usuario?.nome && <span className="truncate text-sm text-white/80">{usuario.nome}</span>}
        </div>

        {mostrarMenu && (
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-1" aria-label="Seções">
            <Item para="/" icone={<ClipboardList size={15} />} rotulo="Minhas avaliações" />
            <Item para="/ciclos" icone={<Users size={15} />} rotulo="Ciclos" />
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl">
        <Outlet />
      </main>
    </div>
  );
}

function Item({ para, icone, rotulo }: { para: string; icone: React.ReactNode; rotulo: string }) {
  return (
    <NavLink
      to={para}
      end={para === '/'}
      className={({ isActive }) =>
        `alvo-toque flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 text-sm font-medium transition ${
          isActive ? 'bg-slate-50 text-capul-700' : 'text-white/85 hover:bg-white/10'
        }`
      }
    >
      {icone}
      {rotulo}
    </NavLink>
  );
}
