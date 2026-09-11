/**
 * ⭐ URL DESCONHECIDA DIZ QUE NÃO EXISTE — em vez de fingir que levou a algum lugar.
 *
 * Até 11/09/2026 a rota curinga era `<Route path="*" element={<Navigate to="/" replace />} />`:
 * **qualquer** caminho desconhecido caía na fila do avaliador, calado. Quem
 * abrisse `/gestao-pessoas/resultados` (Resultados vive dentro do ciclo, em
 * `/ciclos/:id/resultados`) via a própria fila e concluía que tinha chegado —
 * ou que o sistema estava quebrado. Alguém ia compartilhar esse link.
 *
 * ⚠️ **A correção não é criar as rotas de topo.** As telas do RH são etapas de
 * um ciclo e o lugar delas está certo. O defeito era o silêncio.
 *
 * ⭐ E a recusa ENSINA O CAMINHO, como a do ciclo encerrado e a do "Excluir":
 * dizer só "não existe" faz a pessoa procurar sozinha, e o que ela acha costuma
 * ser o errado. Os destinos são filtrados pelo papel de quem está lendo — não se
 * oferece porta que vai dar 403.
 */
import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { Vazio } from '../components/Estado';

interface Destino {
  para: string;
  rotulo: string;
  papeis?: string[];
}

/** Espelha o Sidebar de propósito: as mesmas portas, a mesma condição de papel. */
const DESTINOS: Destino[] = [
  { para: '/', rotulo: 'Minhas avaliações' },
  { para: '/ciclos', rotulo: 'Ciclos', papeis: [ROLES.RH_ADMIN, ROLES.RH_CICLO] },
  { para: '/avaliadores', rotulo: 'Quem avalia quem', papeis: [ROLES.RH_ADMIN] },
  { para: '/questionarios', rotulo: 'Questionários', papeis: [ROLES.RH_ADMIN, ROLES.RH_MODELO] },
];

export default function NaoEncontradaPage() {
  const { pathname } = useLocation();
  const { tem } = useAuth();
  const destinos = DESTINOS.filter((d) => !d.papeis || tem(...d.papeis));

  return (
    <div className="px-4 pb-24 pt-5">
      <Vazio
        titulo="Esta página não existe"
        /* ⚠️ O caminho tentado VAI NA MENSAGEM: sem ele, quem clicou num link
           compartilhado não tem como saber o que estava errado — nem como
           avisar quem mandou. */
        detalhe={`Nada responde em ${pathname}. As telas do ciclo — aplicações, designação, painel e resultados — ficam dentro do ciclo, em Ciclos.`}
        acao={
          <nav className="flex flex-wrap justify-center gap-2">
            {destinos.map((d) => (
              <Link
                key={d.para}
                to={d.para}
                className="alvo-toque inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Compass size={15} className="text-slate-400" aria-hidden />
                {d.rotulo}
              </Link>
            ))}
          </nav>
        }
      />
    </div>
  );
}
