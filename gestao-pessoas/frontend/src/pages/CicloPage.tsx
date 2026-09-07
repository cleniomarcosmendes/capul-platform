import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Carregando, Erro } from '../components/Estado';
import { EtiquetaDeCiclo } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { ciclos, mensagemDoErro, painel, type CicloDetalhado, type ResumoDoCiclo } from '../services/api';
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
  const [resumo, setResumo] = useState<ResumoDoCiclo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCiclo(null);
    setErro(null);
    setResumo(null);
    ciclos
      .obter(cicloId)
      .then((c) => vivo && setCiclo(c))
      .catch((e) => vivo && setErro(mensagemDoErro(e, 'Não foi possível carregar o ciclo.')));
    // ⚠️ Falhar aqui NÃO derruba a tela: sem o resumo, some a linha de estado e
    // o ciclo continua abrindo. É informação sobre o trabalho, não o trabalho.
    painel
      .resumo(cicloId)
      .then((r) => vivo && setResumo(r))
      .catch(() => vivo && setResumo(null));
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

          {resumo && <LinhaDeEstado resumo={resumo} cicloId={cicloId} />}

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

/**
 * ⭐⭐ A LINHA DE ESTADO — "onde estou e o que falta", sem um clique.
 *
 * A tela do ciclo não dizia em que passo se estava: o roteiro de tela de 07/09
 * abriu um ciclo e não soube o que fazer. Os números já existiam, espalhados
 * entre as abas; aqui eles ficam acima delas, porque **"o que falta" não é uma
 * seção, é o estado**. A aba Painel continua com o detalhe.
 *
 * ⚠️ NÃO é um stepper. O `EtapaStepper` do Inventário funciona lá porque as
 * etapas são de mão única; aqui volta-se a Aplicações enquanto é rascunho, o
 * público muda depois de designar, designar e apurar são repetíveis. "1→2→3→4"
 * mentiria sobre o processo.
 *
 * ⚠️ Cada número traz o UNIVERSO no rótulo — "sem avaliador neste ciclo", não
 * "sem avaliador". O cabeçalho é onde o número é lido primeiro, e é onde a
 * ambiguidade custa mais: 95 aqui e 108 no cadastro são contas diferentes de
 * coisas diferentes (§3.12).
 */
function LinhaDeEstado({ resumo, cicloId }: { resumo: ResumoDoCiclo; cicloId: string }) {
  const numeros: { valor: number; rotulo: string }[] = [
    { valor: resumo.aplicacoes, rotulo: resumo.aplicacoes === 1 ? 'aplicação' : 'aplicações' },
    { valor: resumo.noPublico, rotulo: 'no público' },
    { valor: resumo.semDesignacao, rotulo: 'sem avaliador neste ciclo' },
    { valor: resumo.enviadas, rotulo: `de ${resumo.designados} enviadas` },
    { valor: resumo.apuradas, rotulo: 'apuradas' },
  ];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
        {numeros.map((n, i) => (
          <span key={n.rotulo} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-slate-300" aria-hidden>·</span>}
            <strong
              className={`font-semibold tabular-nums ${
                n.rotulo.startsWith('sem avaliador') && n.valor > 0 ? 'text-amber-700' : 'text-slate-800'
              }`}
            >
              {n.valor}
            </strong>
            {n.rotulo}
          </span>
        ))}
      </p>

      {/* ⭐ O "→ Próximo" só aparece quando a REGRA sabe responder. Quando não
          sabe — ciclo aberto com tudo designado e ninguém respondendo, por
          exemplo — o backend devolve `null` e aqui não se mostra nada: passo
          chutado manda alguém fazer o que talvez não seja a vez de fazer, e a
          tela passa a mentir com ar de ajuda. */}
      {resumo.proximoPasso && (
        <p className="mt-1.5 flex items-center gap-1.5 text-sm">
          <ArrowRight size={15} className="shrink-0 text-capul-700" aria-hidden />
          <span className="font-medium text-slate-700">Próximo:</span>
          {resumo.proximoPasso.aba ? (
            <Link
              to={`/ciclos/${cicloId}/${resumo.proximoPasso.aba}`}
              className="font-medium text-capul-700 underline"
            >
              {resumo.proximoPasso.rotulo}
            </Link>
          ) : (
            // ABRIR e ENCERRAR moram na lista de Ciclos, não numa aba.
            <Link to="/ciclos" className="font-medium text-capul-700 underline">
              {resumo.proximoPasso.rotulo}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
