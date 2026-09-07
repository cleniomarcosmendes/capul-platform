import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Users } from 'lucide-react';
import Sidebar from './Sidebar';
import { usuarioLogado, type UsuarioLogado } from '../services/api';

/**
 * A CASCA do módulo — sidebar fixa à esquerda, como nos outros cinco módulos
 * (Workspace, Inventário, Fiscal, Configurador, Logística). O menu em si, e o
 * porquê de cada item, estão em `Sidebar.tsx`.
 *
 * Era um cabeçalho verde com abas no topo. Duas coisas vieram junto na troca, e
 * as duas eram dívida registrada:
 *   • a navegação **não some mais** com um item só (a sidebar sempre existe);
 *   • existe **"Voltar ao Hub"** no rodapé, como no resto da plataforma.
 */
export default function Layout() {
  /**
   * ⚠️ O JWT tem `username` e `filialCodigo`, mas NÃO o nome da pessoa nem o
   * nome da filial — por isso o cabeçalho aparecia vazio enquanto o Hub mostrava
   * os dois. `/auth/me` é de onde o Hub os tira. Falhar aqui não pode derrubar a
   * tela: sem o nome, a sidebar cai no `username` do token, que sempre existe.
   */
  const [euSou, setEuSou] = useState<UsuarioLogado | null>(null);
  useEffect(() => {
    usuarioLogado.carregar().then(setEuSou).catch(() => setEuSou(null));
  }, []);

  const [menuAberto, setMenuAberto] = useState(false);
  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  /**
   * ⭐ `--altura-cabecalho` continua existindo, e continua MEDIDA.
   *
   * Quem a usa é o cabeçalho sticky da fila (`MinhasAvaliacoesPage`), que precisa
   * saber onde parar. No desktop a barra do topo não existe (a navegação é a
   * sidebar) e a altura é 0; no celular ela é a barra com o hambúrguer. Fixar um
   * número erraria em uma das duas larguras — e a que erraria é a do celular,
   * que é onde o supervisor responde.
   */
  const barraMobile = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = barraMobile.current;
    if (!el) return;
    const medir = () =>
      document.documentElement.style.setProperty('--altura-cabecalho', `${el.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    // A barra some por media query (`md:hidden`), e nem todo navegador dispara o
    // ResizeObserver ao passar para `display:none` — o resize da janela cobre.
    window.addEventListener('resize', medir);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <Sidebar aberta={menuAberto} aoFechar={fecharMenu} euSou={euSou} />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Barra do celular com o hambúrguer — mesma peça do Workspace e do
            Fiscal. Em md:+ some, porque a sidebar já está visível. */}
        <div
          ref={barraMobile}
          className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden"
        >
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            className="alvo-toque rounded-md p-1.5 text-slate-700 hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Users className="h-5 w-5 text-capul-600" aria-hidden />
          <h1 className="truncate text-sm font-semibold text-slate-800">Avaliação de Desempenho</h1>
        </div>

        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
