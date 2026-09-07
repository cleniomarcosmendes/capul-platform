import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
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
 * O `debounce` de 250ms existe porque a lista sai do banco com 1.036 nomes atrás:
 * uma consulta por tecla digitada é uma consulta por tecla digitada.
 */
export function SeletorDeColaborador({
  escolhido,
  aoEscolher,
  rotulo = 'Buscar por nome ou matrícula',
  autoFoco = false,
}: {
  escolhido: ColaboradorDaBusca | null;
  aoEscolher: (c: ColaboradorDaBusca) => void;
  rotulo?: string;
  autoFoco?: boolean;
}) {
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<ColaboradorDaBusca[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      catalogo.colaboradores(busca).then(setAchados).catch(() => setAchados([]));
    }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  return (
    <>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={rotulo}
        aria-label={rotulo}
        autoFocus={autoFoco}
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
              <span className="min-w-0 flex-1 truncate">
                <strong className="font-medium">{c.nome}</strong>
                <span className="text-slate-500">
                  {' '}
                  · {c.matricula} · {c.cargoDescricao ?? 'sem cargo'}
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
