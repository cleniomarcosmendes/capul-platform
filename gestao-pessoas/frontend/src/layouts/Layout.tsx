import { useEffect, useRef, useState } from 'react';
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

  /**
   * ⭐ O cabeçalho é STICKY, e a altura dele vira `--altura-cabecalho`.
   *
   * Sem isso, quem rola a fila perde nome, filial e Sair — e a tela de responder
   * já era sticky, então o mesmo módulo se comportava de dois jeitos. E a altura
   * precisa ser MEDIDA, não fixada: ela muda com o menu (que só aparece para
   * quem tem mais de um destino) e muda de novo no celular, onde nome e filial
   * podem quebrar em duas linhas. Número mágico aqui erraria justamente na tela
   * pequena, que é onde o supervisor responde.
   */
  const cabecalho = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = cabecalho.current;
    if (!el) return;
    const medir = () =>
      document.documentElement.style.setProperty('--altura-cabecalho', `${el.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
    // Sem dependências de propósito: quem reage a nome, filial, menu e quebra
    // de linha é o próprio ResizeObserver — listar estado aqui seria uma
    // segunda lista para manter em sincronia com a primeira.
  }, []);
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
    /**
     * ⚠️ SEM CONDIÇÃO DE PAPEL, de propósito. Ser avaliador é um FATO DO DADO —
     * a pessoa está designada — e não um papel: a gestora de RH avalia 13
     * pessoas e tem só `RH_ADMIN`. Com a condição em `tem(AVALIADOR)`, o item
     * sumia para ela e as 13 avaliações ficavam INALCANÇÁVEIS: apareciam como
     * pendência dela no painel e não havia botão nenhum que as abrisse. Quem
     * não tem fila cai no estado vazio da própria tela, que já diz o que
     * significa.
     */
    { para: '/', icone: <ClipboardList size={15} />, rotulo: 'Minhas avaliações' },
    doRh && { para: '/ciclos', icone: <Users size={15} />, rotulo: 'Ciclos' },
    tem(ROLES.RH_ADMIN) && { para: '/avaliadores', icone: <UserCheck size={15} />, rotulo: 'Avaliadores' },
  ].filter(Boolean) as { para: string; icone: React.ReactNode; rotulo: string }[];

  // Uma opção só não é navegação — é um rótulo repetindo o cabeçalho.
  const mostrarMenu = itens.length > 1;


  return (
    <div className="min-h-dvh bg-slate-50">
      <header ref={cabecalho} className="sticky top-0 z-30 border-b border-slate-200 bg-capul-600">
        {/* ⚠️ NO CELULAR A IDENTIDADE VAI PARA A SEGUNDA LINHA.
            A 360px, título + nome + filial + Sair na mesma faixa espremiam
            "Avaliação de Desempenho" até virar "Aval…" — o módulo perdia o
            próprio nome justamente na largura em que o supervisor de loja usa.
            `order-last w-full` joga a identidade para baixo no celular e
            `sm:order-none sm:w-auto` a devolve para a linha no desktop. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5">
          <Users size={18} className="text-white/80" aria-hidden />
          <h1 className="flex-1 truncate font-semibold text-white">Avaliação de Desempenho</h1>
          {nome && (
            <div className="order-last min-w-0 w-full text-left sm:order-none sm:w-auto sm:text-right">
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
