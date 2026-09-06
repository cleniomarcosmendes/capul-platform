import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Carregando, Erro } from '../components/Estado';
import { EtiquetaDeCiclo } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { ciclos, mensagemDoErro, type CicloDetalhado } from '../services/api';
import { data } from '../lib/formato';

/**
 * A moldura do ciclo. As quatro telas do RH (aplicações, designação, painel e
 * resultados) são etapas do MESMO objeto, e trocá-las por um menu global faria
 * a gestora escolher o ciclo de novo a cada passo.
 *
 * ⭐ O status e a data-base ficam fixos no topo porque quase toda pergunta que
 * essas telas respondem depende deles: em RASCUNHO ainda se monta, ABERTO já
 * tem nota nascendo, e a data-base é o que congela todo cálculo temporal.
 */
export default function CicloPage() {
  const { cicloId = '' } = useParams();
  const { tem } = useAuth();
  const [ciclo, setCiclo] = useState<CicloDetalhado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCiclo(null);
    setErro(null);
    ciclos
      .obter(cicloId)
      .then((c) => vivo && setCiclo(c))
      .catch((e) => vivo && setErro(mensagemDoErro(e, 'Não foi possível carregar o ciclo.')));
    return () => {
      vivo = false;
    };
  }, [cicloId]);

  return (
    <div className="px-4 pb-24 pt-4">
      <Link
        to="/ciclos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} aria-hidden /> Ciclos
      </Link>

      {erro && (
        <div className="mt-3">
          <Erro mensagem={erro} />
        </div>
      )}
      {!erro && !ciclo && (
        <div className="mt-3">
          <Carregando linhas={1} />
        </div>
      )}

      {ciclo && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-lg font-semibold text-slate-800">{ciclo.nome}</h2>
            <EtiquetaDeCiclo status={ciclo.status} />
            <span className="text-sm text-slate-500">
              data-base <strong className="font-medium text-slate-700">{data(ciclo.dataBase)}</strong>
            </span>
          </div>

          <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Etapas do ciclo">
            <Aba para="aplicacoes" rotulo="Aplicações" />
            <Aba para="designacao" rotulo="Designação" />
            <Aba para="painel" rotulo="Painel" />
            {tem(ROLES.RH_ADMIN) && <Aba para="resultados" rotulo="Resultados" />}
          </nav>

          <div className="pt-5">
            <Outlet context={{ ciclo }} />
          </div>
        </>
      )}
    </div>
  );
}

function Aba({ para, rotulo }: { para: string; rotulo: string }) {
  return (
    <NavLink
      to={para}
      className={({ isActive }) =>
        `alvo-toque flex items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
          isActive
            ? 'border-capul-600 text-capul-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
        }`
      }
    >
      {rotulo}
    </NavLink>
  );
}

export interface ContextoDoCiclo {
  ciclo: CicloDetalhado;
}
