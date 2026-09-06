import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ClipboardList, LogOut, UserCheck, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usuarioLogado, type UsuarioLogado } from '../services/api';
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
  const { usuario, tem, logout } = useAuth();

  /**
   * ⚠️ O JWT tem `username` e `filialCodigo`, mas NÃO o nome da pessoa nem o
   * nome da filial — por isso o cabeçalho aparecia vazio enquanto o Hub
   * mostrava os dois. `/auth/me` é de onde o Hub os tira, e o módulo passa a
   * tirar do mesmo lugar. Falhar aqui não pode derrubar a tela: sem o nome, o
   * cabeçalho cai no `username` do token, que sempre existe.
   */
  const [euSou, setEuSou] = useState<UsuarioLogado | null>(null);
  useEffect(() => {
    usuarioLogado.carregar().then(setEuSou).catch(() => setEuSou(null));
  }, []);

  const nome = euSou?.nome ?? usuario?.nome ?? usuario?.username ?? null;
  const filial = euSou?.filialAtual;
  const doRh = tem(ROLES.RH_ADMIN, ROLES.RH_CICLO, ROLES.RH_MODELO);

  /**
   * ⚠️ O menu se monta a partir do que a pessoa PODE abrir, e aparece quando há
   * mais de um destino. Antes ele exigia ser do RH **e** avaliador, e isso
   * bastava enquanto o RH tinha uma tela só; com o cadastro de avaliadores, a
   * gestora que não avalia ninguém ficaria sem caminho até ele — tela existente,
   * rota funcionando, e nenhum jeito de chegar lá. Não há deep link aqui:
   * esconder do menu é esconder a tela.
   */
  const itens = [
    tem(ROLES.AVALIADOR) && { para: '/', icone: <ClipboardList size={15} />, rotulo: 'Minhas avaliações' },
    doRh && { para: '/ciclos', icone: <Users size={15} />, rotulo: 'Ciclos' },
    tem(ROLES.RH_ADMIN) && { para: '/avaliadores', icone: <UserCheck size={15} />, rotulo: 'Avaliadores' },
  ].filter(Boolean) as { para: string; icone: React.ReactNode; rotulo: string }[];

  // Uma opção só não é navegação — é um rótulo repetindo o cabeçalho.
  const mostrarMenu = itens.length > 1;

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-capul-600">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Users size={18} className="text-white/80" aria-hidden />
          <h1 className="flex-1 truncate font-semibold text-white">Avaliação de Desempenho</h1>
          {nome && (
            <div className="min-w-0 text-right">
              <p className="truncate text-sm leading-tight text-white">{nome}</p>
              {filial && (
                <p className="truncate text-xs leading-tight text-white/70">
                  {filial.codigo} · {filial.nome}
                </p>
              )}
            </div>
          )}
          {/* Sair existe em todos os outros módulos; sem ele, quem entra por link
              direto fica sem caminho de volta ao Hub. ⚠️ COM RÓTULO: ícone
              sozinho, encostado no nome de quem está logado, é o lugar onde um
              toque errado derruba a sessão — e aqui derruba a da plataforma
              inteira, não só a deste módulo. */}
          <button
            type="button"
            onClick={logout}
            title="Sair da plataforma"
            className="alvo-toque flex shrink-0 items-center gap-1.5 rounded-lg border border-white/25 px-2.5 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={15} aria-hidden />
            Sair
          </button>
        </div>

        {mostrarMenu && (
          <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 pb-1" aria-label="Seções">
            {itens.map((i) => (
              <Item key={i.para} para={i.para} icone={i.icone} rotulo={i.rotulo} />
            ))}
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
