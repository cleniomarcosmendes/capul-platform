import { useEffect, useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Carregando, Erro } from '../components/Estado';
import { EtiquetaDeCiclo } from '../components/Etiqueta';
import { useAuth } from '../contexts/AuthContext';
import { ROLES } from '../lib/roles';
import { ciclos, mensagemDoErro, painel, type CicloDetalhado, type ResumoDoCiclo } from '../services/api';
import { data, dataHora } from '../lib/formato';

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
          {resumo?.status === 'RASCUNHO' && <FaixaDoRascunho resumo={resumo} />}
          {resumo?.status === 'ENCERRADO' && <FaixaDoEncerrado resumo={resumo} />}

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
      {/* ⭐ Um ciclo REABERTO duas vezes é informação, não detalhe — e some da
          tela assim que ele volta a ABERTO, se ninguém disser. Fica aqui, na
          linha que está sempre visível. */}
      {resumo.reaberturas > 0 && resumo.ultimaReabertura && (
        <p className="mt-1 text-xs text-slate-500">
          Reaberto {resumo.reaberturas}× · última em {dataHora(resumo.ultimaReabertura.em)}
          {resumo.ultimaReabertura.por ? ` por ${resumo.ultimaReabertura.por}` : ''}
          {resumo.ultimaReabertura.motivo ? ` — “${resumo.ultimaReabertura.motivo}”` : ''}
        </p>
      )}

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

/**
 * ⭐⭐ A FAIXA DO RASCUNHO — o que só se faz agora, e o que abrir fecha.
 *
 * O estado era uma etiqueta e nada mais: não dizia o que RASCUNHO permite, o que
 * a abertura fecha, nem — o mais caro — que **não há volta**. Não existe rota de
 * ABERTO para RASCUNHO, e nada avisava antes do clique.
 *
 * ⚠️ Aparece na TELA DO CICLO, não só na lista: quem cria um ciclo trabalha
 * aqui dentro (aplicações, público, designação), e um aviso que só existe na
 * lista é um aviso que a pessoa leu antes de precisar dele. A lista de Ciclos
 * tem a CONFIRMAÇÃO, que é onde o clique acontece.
 *
 * ⭐ A lista de pendências vem do backend, da MESMA função que a abertura roda
 * (`problemasParaAbrir`). Lista vazia aqui significa que o clique passa lá — se
 * fossem duas implementações, a tela diria "pode abrir" e a API recusaria.
 */
function FaixaDoRascunho({ resumo }: { resumo: ResumoDoCiclo }) {
  const pendencias = resumo.pendenciasParaAbrir ?? [];
  const pode = pendencias.length === 0;
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="flex items-start gap-2 text-sm text-amber-900">
        <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">RASCUNHO — é agora que se monta.</strong> Criar
          aplicação e mudar peso só valem enquanto o ciclo é rascunho.{' '}
          <strong>Abrir é definitivo: não há volta para rascunho.</strong>
        </span>
      </p>

      <div className="mt-2 rounded-lg border border-amber-200 bg-white p-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          O que falta para abrir
        </p>
        {pode ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden />
            Nada — a validação da abertura passa. O botão fica na lista de Ciclos.
          </p>
        ) : (
          <ul className="mt-1 space-y-1">
            {pendencias.map((p) => (
              <li key={p} className="flex items-start gap-1.5 text-sm text-slate-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ⚠️ O PASSO 0 não tem tela, e hoje o RH descobre isso procurando por ela.
          Dizer onde ele mora custa uma frase e evita a busca. */}
      <p className="mt-2 text-xs text-amber-900/80">
        Questionários e critérios (com as faixas) são cadastrados pela T.I. — ainda não têm tela
        neste módulo.
      </p>
    </div>
  );
}

/**
 * ⭐⭐ A FAIXA DO ENCERRADO — a tela passa a saber do que o backend recusa.
 *
 * A regra do ciclo encerrado (§3.1.12) nasceu no backend e as telas não sabiam:
 * os botões continuavam com aparência normal e a pessoa só descobria no erro,
 * **depois** do clique. Aqui ela lê antes — e a frase aponta para o botão de
 * reabrir, que agora existe.
 *
 * ⚠️ Diz também o que CONTINUA valendo. "Encerrado" sem isso soa como tela
 * morta, e ela não é: resultados, memória de cálculo e painel seguem abrindo —
 * que é justamente para o que um ciclo encerrado serve.
 */
function FaixaDoEncerrado({ resumo }: { resumo: ResumoDoCiclo }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-300 bg-slate-100 p-3">
      <p className="flex items-start gap-2 text-sm text-slate-700">
        <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">
            Ciclo encerrado{resumo.encerradoEm ? ` em ${data(resumo.encerradoEm)}` : ''}.
          </strong>{' '}
          Designar, mexer no público e apurar estão fechados — os botões aparecem desabilitados,
          com o motivo. <strong>Continua valendo:</strong> resultados, memória de cálculo, painel e
          a lista de designação.
        </span>
      </p>
      <p className="mt-1.5 text-sm text-slate-600">
        Para voltar a mexer,{' '}
        <Link to="/ciclos" className="font-medium text-capul-700 underline">
          reabra o ciclo na lista de Ciclos
        </Link>{' '}
        — é ato do RH_ADMIN, exige motivo e fica registrado.
      </p>
    </div>
  );
}
