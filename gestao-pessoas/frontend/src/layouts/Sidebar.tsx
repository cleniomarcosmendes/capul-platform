import { NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ClipboardList,
  FileStack,
  FileText,
  LogOut,
  SlidersHorizontal,
  Tags,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import type { UsuarioLogado } from '../services/api';

/**
 * MENU do módulo — decidido em 07/09/2026, depois de ler a casca dos cinco
 * módulos com sidebar própria (Workspace, Inventário, Fiscal, Configurador,
 * Logística).
 *
 * A forma segue o padrão da plataforma: sidebar escura fixa à esquerda, gaveta
 * no celular, seções em CAIXA ALTA, ícone em todo item, ativo em
 * `bg-capul-600/20 text-capul-300`, rodapé com "Voltar ao Hub" + nome + Sair.
 * Trocar de módulo não pode parecer trocar de sistema.
 *
 * ── O que o menu resolve, e que a versão em abas no topo não resolvia ───────
 *
 * 1. **A navegação não some mais.** Antes o menu só aparecia com mais de um
 *    destino, então quem só responde avaliação — o supervisor de loja, no
 *    celular — navegava sem barra nenhuma. Justamente quem tem menos caminhos
 *    ficava sem nenhum.
 * 2. **Existe "Voltar ao Hub".** Antes a única saída era o Sair, que derruba a
 *    sessão da PLATAFORMA inteira, não a deste módulo.
 * 3. **CADASTROS × CICLO ficam separados.** `Quem avalia quem` (permanente) e
 *    `Designação` (dentro do ciclo) respondem a mesma pergunta em voz alta, e
 *    era isso — não a profundidade — que escondia a tela: a gestora procurava
 *    "vincular um avaliador" e não tinha por que abrir "Ciclos".
 *
 * ⚠️ As quatro etapas do ciclo (Aplicações · Designação · Painel · Resultados)
 * **não são itens de menu**: são etapas DENTRO do ciclo aberto, como as etapas
 * de um inventário no módulo Inventário (`EtapaStepper`). Nenhum módulo da casa
 * aninha navegação, e um seletor global de ciclo seria pior: com DOIS ciclos
 * abertos (o caso de hoje) e números plausíveis um no lugar do outro, o ciclo
 * selecionado viraria um MODO que vaza — o RH lê "95 sem avaliador" achando que
 * é o Piloto quando é o Geral, sem erro nenhum na tela. O ciclo mora na URL.
 */

type ItemDoMenu =
  | { secao: string; papeis?: string[] }
  | {
      rotulo: string;
      icone: React.ComponentType<{ className?: string }>;
      para: string;
      /** Ausente = aparece para quem tem acesso ao módulo. Ver a nota abaixo. */
      papeis?: string[];
      fim?: boolean;
    };

const itens: ItemDoMenu[] = [
  /**
   * ⭐⭐ SEM CONDIÇÃO DE PAPEL, e isto é REGRA do módulo — não esquecimento.
   * Ver `docs/ESTADO-DO-PROJETO.md` §3.1.3.
   *
   * "Item cujo conteúdo vem do DADO, e não do papel, não leva condição de papel
   * no menu — o gate é o backend, que filtra por designação."
   *
   * Contraria o padrão da plataforma de propósito: lá todo item é filtrado por
   * papel. Aqui ser avaliador é FATO DO DADO (existe linha em `avaliacao` com o
   * seu id), não papel do JWT — a gestora de RH avalia 13 pessoas e tem só
   * `RH_ADMIN`. Com a condição em `AVALIADOR`, as 13 ficavam INALCANÇÁVEIS.
   * Quem não tem fila cai no estado vazio da própria tela, que explica.
   */
  { rotulo: 'Minhas avaliações', icone: ClipboardList, para: '/', fim: true },

  /**
   * CADASTROS — o que vale para TODO ciclo. Plural, como no Workspace e no
   * Configurador, que usam a palavra com este mesmo sentido.
   *
   * ⚠️ `Quem avalia quem` é o nome do cadastro DE PROPÓSITO: é a pergunta que a
   * pessoa tem na cabeça quando procura ("quem é o avaliador do fulano?"), e ela
   * para aqui sem precisar saber que existe cadastro, ciclo e cópia entre os
   * dois. A palavra técnica — Designação — fica com a etapa do ciclo, que é onde
   * quem já está seguindo o processo a procura.
   */
  { secao: 'CADASTROS', papeis: [ROLES.RH_ADMIN, ROLES.RH_MODELO, ROLES.RH_CICLO] },
  { rotulo: 'Quem avalia quem', icone: UserCheck, para: '/avaliadores', papeis: [ROLES.RH_ADMIN] },

  /**
   * ⭐ **"Questionários", não "Editar questionários"** — o rótulo nomeia o
   * OBJETO, não uma capacidade. A tela é leitura pura: o editor é outro
   * trabalho, de semanas, e item de menu que promete edição é a dívida do
   * §3.1.33 de novo (*texto que promete capacidade é dívida*). Quando o editor
   * existir, o rótulo não muda — a tela é que ganha o que fazer.
   *
   * ⭐ É aqui que `RH_MODELO` entra no menu pela primeira vez. Até 11/09 ele
   * não tinha item nenhum, e estava certo: a única coisa que o papel autorizava
   * era `GET /catalogo`, que nenhuma tela dele consumia.
   *
   * ⭐ `RH_CICLO` também: quem monta a Aplicação escolhe o modelo, e escolher
   * por nome sem ver o conteúdo é decidir às cegas. **Ler o instrumento não é
   * ler nota** — `/resultados` segue só de `RH_ADMIN`.
   */
  { rotulo: 'Questionários', icone: FileText, para: '/questionarios', papeis: [ROLES.RH_ADMIN, ROLES.RH_MODELO, ROLES.RH_CICLO] },

  /**
   * ⭐ IRMÃ da de cima, e a diferença é o RECORTE: "Questionários" mostra UM
   * perfil por vez (as questões dele, na ordem dele); "Acervo" mostra cada
   * questão UMA vez, com os perfis que a usam e o peso em cada um.
   *
   * ⚠️ Mesmos papéis: ler o instrumento não é ler nota. E o rótulo nomeia o
   * OBJETO — quando o editor existir, ele não muda.
   */
  { rotulo: 'Acervo de questões', icone: FileStack, para: '/acervo', papeis: [ROLES.RH_ADMIN, ROLES.RH_MODELO, ROLES.RH_CICLO] },

  /**
   * ⚠️ Papéis MENORES que os do acervo: aqui se CADASTRA, e cadastrar
   * classificação é montar o instrumento (RH_MODELO), não escolher um
   * (RH_CICLO). Mesma separação do cadastro de critérios.
   */
  { rotulo: 'Classificações', icone: Tags, para: '/classificacoes', papeis: [ROLES.RH_ADMIN, ROLES.RH_MODELO] },

  /**
   * ⭐ **Só `RH_ADMIN`** — e a diferença para "Questionários" logo acima é
   * proposital. LER o catálogo é de quem monta aplicação (precisa escolher
   * critério da lista); MEXER no critério muda a régua de **todos os ciclos que
   * o usarem**, o que é a autoridade de publicar, não a de montar.
   *
   * ⚠️ O rótulo é "Critérios da nota", não "Critérios": sozinha, a palavra
   * confunde com critério de elegibilidade (quem entra no ciclo), que é outra
   * coisa e mora na Designação.
   */
  { rotulo: 'Critérios da nota', icone: SlidersHorizontal, para: '/criterios', papeis: [ROLES.RH_ADMIN] },

  /**
   * CICLO — singular: a seção é sobre o objeto em que se trabalha, não sobre a
   * coleção. O item leva ao ciclo; as etapas moram dentro dele.
   *
   * ⚠️ O ícone é de CALENDÁRIO, não de pessoas. Ciclo é período; com `Users` o
   * item reforçava a leitura errada de que ali se mexe em gente.
   */
  { secao: 'CICLO', papeis: [ROLES.RH_ADMIN, ROLES.RH_CICLO] },
  { rotulo: 'Ciclos', icone: CalendarRange, para: '/ciclos', papeis: [ROLES.RH_ADMIN, ROLES.RH_CICLO] },

  /**
   * ✅ 11/09/2026 — `RH_MODELO` voltou ao menu, exatamente como este comentário
   * previa: em CADASTROS, com `RH_ADMIN` + `RH_MODELO`, quando a tela de
   * questionários passou a existir. Ela é de LEITURA; o editor ainda não existe.
   *
   * ⚠️ O que continua valendo daqui: **não se inventa item de menu para tela que
   * não existe**. Antes disto ele via "Ciclos" e levava 403, porque a rota é
   * `RH_ADMIN`+`RH_CICLO`.
   */
];

/** Mesma limpeza dos outros cinco módulos: cabeçalho de seção sem item some. */
function filtrarPorPapel(lista: ItemDoMenu[], tem: (...p: string[]) => boolean): ItemDoMenu[] {
  const visiveis = lista.filter((i) => !i.papeis || tem(...i.papeis));
  return visiveis.filter((item, idx) => {
    if (!('secao' in item)) return true;
    const proximo = visiveis[idx + 1];
    return proximo != null && !('secao' in proximo);
  });
}

interface Props {
  /** Aberta no celular. Em md:+ fica sempre visível. */
  aberta?: boolean;
  aoFechar?: () => void;
  /** Nome e filial vêm de `/auth/me` — o JWT não os traz. */
  euSou: UsuarioLogado | null;
}

export default function Sidebar({ aberta = false, aoFechar, euSou }: Props) {
  const { usuario, tem, logout } = useAuth();
  const visiveis = filtrarPorPapel(itens, tem);
  const nome = euSou?.nome ?? usuario?.nome ?? usuario?.username ?? null;
  const filial = euSou?.filialAtual;

  return (
    <>
      {aberta && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={aoFechar} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 ease-in-out
          ${aberta ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:translate-x-0 md:flex-shrink-0`}
        style={{ backgroundColor: 'var(--bg-sidebar)' }}
      >
        <div className="flex items-start justify-between border-b border-slate-700 p-4">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-6 w-6 shrink-0 text-capul-400" aria-hidden />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-white">Avaliação de Desempenho</h1>
              {filial && (
                <p className="truncate text-xs text-slate-400">
                  {filial.codigo} - {filial.nome}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={aoFechar}
            className="p-1 text-slate-400 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4" aria-label="Seções do módulo">
          {visiveis.map((item, idx) => {
            if ('secao' in item) {
              return (
                <div
                  key={item.secao}
                  className={`mx-3 px-1 pb-1 pt-1 ${idx > 0 ? 'mt-4 border-t border-slate-700/60' : ''}`}
                >
                  <p
                    className="text-[10px] font-bold uppercase text-slate-400"
                    style={{ letterSpacing: '0.12em' }}
                  >
                    {item.secao}
                  </p>
                </div>
              );
            }
            const Icone = item.icone;
            return (
              <NavLink
                key={item.para}
                to={item.para}
                end={item.fim}
                onClick={aoFechar}
                className={({ isActive }) =>
                  `alvo-toque mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-capul-600/20 font-medium text-capul-300'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                  }`
                }
              >
                <Icone className="h-5 w-5 shrink-0" />
                {item.rotulo}
              </NavLink>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-slate-700 p-4">
          {/* ⚠️ Sem isto, quem entra por link direto só sai pelo Sair — que
              derruba a sessão da plataforma inteira. Os cinco módulos têm. */}
          <a
            href="/"
            className="alvo-toque flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Hub
          </a>
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-slate-500">{nome}</span>
            {/* ⚠️ COM RÓTULO — divergência deliberada do padrão (lá é só o
                ícone). Ícone mudo encostado no nome de quem está logado é onde
                um toque errado derruba a sessão da PLATAFORMA, não só a deste
                módulo. Mantido de 06/09; o lugar é que passou a ser o do padrão. */}
            <button
              type="button"
              onClick={logout}
              title="Sair da plataforma"
              className="alvo-toque flex shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
