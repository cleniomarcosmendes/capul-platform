import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { catalogo, type ColaboradorDaBusca } from '../services/api';

/**
 * Busca de pessoa por nome ou matrícula — a mesma peça para escolher QUEM AVALIA
 * (cadastro e designação do ciclo) e para escolher QUEM SERÁ AVALIADO.
 *
 * ⚠️ A busca do catálogo **não marca a própria linha** de quem está usando, e
 * isso é decisão registrada (§3.1.1 do ESTADO): aqui a linha é uma PESSOA, não
 * uma avaliação — e escolher a si mesma como avaliadora é legítimo (a gestora
 * avalia 13). Marcar sinalizaria como suspeito um ato normal.
 *
 * ── Dois defeitos de 07/09 que esta peça passou a evitar ────────────────────
 *
 * ⭐ **A escolha NÃO pode ficar invisível.** A lista se refaz a cada busca, e a
 * pessoa escolhida some dela assim que o texto muda — mas a escolha continua
 * valendo, e o botão de confirmar continua habilitado. Quem olha vê uma lista
 * sem ninguém marcado e um botão vivo: não dá para saber o que vai ser gravado.
 * Por isso a escolha aparece **fora da lista**, em uma tarja que sobrevive à
 * busca seguinte e traz o X para desfazer.
 *
 * ⭐ **Enter não escolhe ninguém.** Digitar antes de o foco assentar mandava a
 * tecla para o primeiro botão da lista, que "clicava" em quem estivesse ali —
 * seleção aleatória, e invisível pelo defeito acima. O foco agora é posto por
 * `ref` depois da montagem (determinístico, ao contrário do `autoFocus`), e o
 * Enter dentro do campo é **engolido**: escolher é ato de clique.
 *
 * O `debounce` de 250ms existe porque a lista sai do banco com 1.036 nomes atrás.
 */
export function SeletorDeColaborador({
  escolhido,
  aoEscolher,
  aoLimpar,
  rotulo = 'Buscar por nome ou matrícula',
  autoFoco = false,
}: {
  escolhido: ColaboradorDaBusca | null;
  aoEscolher: (c: ColaboradorDaBusca) => void;
  /** Sem isto, a tarja da escolha não tem como ser desfeita. */
  aoLimpar?: () => void;
  rotulo?: string;
  autoFoco?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<ColaboradorDaBusca[]>([]);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFoco) campo.current?.focus();
  }, [autoFoco]);

  useEffect(() => {
    const t = setTimeout(() => {
      catalogo.colaboradores(busca).then(setAchados).catch(() => setAchados([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <>
      {escolhido && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-capul-600 bg-capul-50 px-3 py-2 text-sm">
          <Check size={15} className="shrink-0 text-capul-700" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-capul-900">
            <strong className="font-semibold">{escolhido.nome}</strong>
            <span className="text-capul-800/70">
              {' '}
              · {escolhido.matricula} · {escolhido.cargoDescricao ?? 'sem cargo'}
            </span>
          </span>
          {aoLimpar && (
            <button
              type="button"
              onClick={aoLimpar}
              aria-label="Desfazer a escolha"
              className="shrink-0 rounded-lg p-1 text-capul-800/60 hover:bg-capul-100 hover:text-capul-900"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}

      <input
        ref={campo}
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        // ⚠️ Enter não escolhe: sem isto a tecla vazava para o primeiro botão da
        // lista e selecionava quem estivesse ali.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        placeholder={rotulo}
        aria-label={rotulo}
        className="alvo-toque w-full rounded-xl border border-slate-300 px-3 text-slate-800"
      />
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
        {achados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => aoEscolher(c)}
              className={`alvo-toque flex w-full items-center gap-2 rounded-lg px-2 text-left text-sm ${
                escolhido?.id === c.id
                  ? 'bg-capul-50 text-capul-800'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {escolhido?.id === c.id && <Check size={15} aria-hidden />}
              {/* ⭐ A ÁREA entra aqui (08/09): escolher avaliador por nome e
                  cargo, entre homônimos de unidades diferentes, é escolher no
                  escuro. `centroCustoDescricao` já vinha no payload e a tela
                  descartava — achado da varredura do §3.1.9. */}
              <span className="min-w-0 flex-1 truncate">
                <strong className="font-medium">{c.nome}</strong>
                <span className="text-slate-500">
                  {' '}
                  · {c.matricula} · {c.cargoDescricao ?? 'sem cargo'}
                  {c.centroCustoDescricao ? ` · ${c.centroCustoDescricao}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {achados.length === 0 && (
          <li className="px-2 py-3 text-center text-sm text-slate-500">Nenhum resultado.</li>
        )}
      </ul>
    </>
  );
}
