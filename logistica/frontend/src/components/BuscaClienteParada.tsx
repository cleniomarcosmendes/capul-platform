import { useEffect, useState } from 'react';
import { Search, Loader2, MapPin, User } from 'lucide-react';
import { logisticaApi } from '../services/api';

// Busca de cliente para a ROTA PLANEJADA (Saída de Veículos / Planejar visitas).
// Reusa o mesmo motor da Entrega (`GET /cadastro/busca`): matrícula/telefone/nome
// → cliente + endereço da propriedade (Protheus SA1) ou cliente local. Ao escolher,
// devolve um rótulo legível "Nome (matrícula) — endereço · município" que vira a
// parada planejada. Quem é prospect ("sem cadastro") segue digitando livre no
// textarea ao lado.

interface EnderecoP { logradouro: string; bairro: string | null; cidade: string | null; uf: string | null }
interface ClienteProtheus { matricula: string; nome: string; enderecos: EnderecoP[] }
interface EnderecoLocal { logradouro: string; bairro?: string | null; cidade?: string | null; uf?: string | null }
interface ClienteLocal { id: string; nome: string; enderecos: EnderecoLocal[] }
interface BuscaResp { clientesLocais: ClienteLocal[]; protheus?: { clientes: ClienteProtheus[] } }

function fmtEnd(e?: { logradouro?: string; bairro?: string | null; cidade?: string | null; uf?: string | null }): string {
  if (!e) return '';
  const cidade = e.cidade ? (e.uf ? `${e.cidade}/${e.uf}` : e.cidade) : '';
  return [e.logradouro, e.bairro, cidade].filter(Boolean).join(', ');
}

export function BuscaClienteParada({ onAdd, disabled }: { onAdd: (rotulo: string) => void; disabled?: boolean }) {
  const [termo, setTermo] = useState('');
  const [resp, setResp] = useState<BuscaResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < 3) { setResp(null); setAberto(false); return; }
    setLoading(true);
    const h = setTimeout(async () => {
      try {
        const { data } = await logisticaApi.get<BuscaResp>('/cadastro/busca', { params: { termo: t } });
        setResp(data); setAberto(true);
      } catch { setResp(null); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(h);
  }, [termo]);

  function escolher(rotulo: string) {
    onAdd(rotulo);
    setTermo(''); setResp(null); setAberto(false);
  }

  const protheus = resp?.protheus?.clientes ?? [];
  const locais = resp?.clientesLocais ?? [];
  const temAlgo = protheus.length > 0 || locais.length > 0;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onFocus={() => { if (temAlgo) setAberto(true); }}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          disabled={disabled}
          placeholder="Buscar cliente (matrícula, nome ou telefone)…"
          className="w-full rounded-lg border border-slate-300 pl-8 pr-8 py-2 text-sm disabled:bg-slate-100"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>

      {aberto && termo.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {!temAlgo ? (
            <div className="px-3 py-2.5 text-xs text-slate-400">
              {loading ? 'Buscando…' : 'Nenhum cliente. Para prospect, digite o nome no campo ao lado.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {protheus.map((c, i) => {
                const end = c.enderecos[0];
                const rotulo = `${c.nome} (${c.matricula})${fmtEnd(end) ? ` — ${fmtEnd(end)}` : ''}`;
                return (
                  <li key={`p${i}`}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(rotulo)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-capul-50">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-capul-600" />
                      <span className="min-w-0">
                        <span className="font-medium text-slate-700">{c.nome}</span>
                        <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">{c.matricula}</span>
                        {fmtEnd(end) && <span className="block text-xs text-slate-500">{fmtEnd(end)}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {locais.map((c) => {
                const end = c.enderecos[0];
                const rotulo = `${c.nome}${fmtEnd(end) ? ` — ${fmtEnd(end)}` : ''}`;
                return (
                  <li key={`l${c.id}`}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(rotulo)}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-capul-50">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span className="font-medium text-slate-700">{c.nome}</span>
                        <span className="ml-1 text-[10px] text-slate-400">cadastro local</span>
                        {fmtEnd(end) && <span className="block text-xs text-slate-500">{fmtEnd(end)}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
