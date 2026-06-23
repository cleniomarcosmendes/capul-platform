import { useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Loader2 } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { maskTelefone } from '../utils/format';

interface Endereco {
  id?: string; apelido?: string | null; logradouro: string; numero?: string | null; complemento?: string | null;
  bairro?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null;
}
interface ClienteLocal { id: string; nome: string; telefone?: string | null; enderecos?: Endereco[] }
interface Historico {
  destinatarioNome: string; telefone?: string | null;
  endLogradouro?: string | null; endNumero?: string | null; endBairro?: string | null; endCidade?: string | null;
}
interface ProtheusCliente {
  nome: string; telefone: string | null;
  enderecos: { logradouro: string; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null; rotulo: string }[];
}
interface BuscaResp {
  clientesLocais: ClienteLocal[];
  historicoEntregas: Historico[];
  protheus?: { clientes: ProtheusCliente[] };
}

type Origem = 'Cliente local' | 'Histórico' | 'Protheus';
interface Linha {
  nome: string; telefone?: string | null; endereco: string; cidadeUf: string; origem: Origem;
}

const COR: Record<Origem, string> = {
  'Cliente local': 'bg-capul-100 text-capul-700',
  'Histórico': 'bg-slate-100 text-slate-600',
  'Protheus': 'bg-amber-100 text-amber-700',
};

/**
 * Consulta consolidada de ENDEREÇOS — read-only. Um termo (telefone, nome ou
 * matrícula E#####) varre todas as fontes (clientes locais, histórico de
 * entregas e Protheus) e mostra os endereços vinculados. Não cadastra nada —
 * o cadastro de cliente/endereço acontece no fluxo da Nova Entrega.
 */
export function ClientesPage() {
  const [termo, setTermo] = useState('');
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [sortKey, setSortKey] = useState<keyof Linha>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function montarLinhas(d: BuscaResp): Linha[] {
    const out: Linha[] = [];
    for (const c of d.clientesLocais) {
      for (const e of c.enderecos ?? []) {
        out.push({
          nome: c.nome, telefone: c.telefone,
          endereco: `${e.logradouro}${e.numero ? `, ${e.numero}` : ''}${e.bairro ? ` — ${e.bairro}` : ''}`,
          cidadeUf: [e.cidade, e.uf].filter(Boolean).join('/'), origem: 'Cliente local',
        });
      }
    }
    for (const h of d.historicoEntregas) {
      out.push({
        nome: h.destinatarioNome, telefone: h.telefone,
        endereco: `${h.endLogradouro ?? ''}${h.endNumero ? `, ${h.endNumero}` : ''}${h.endBairro ? ` — ${h.endBairro}` : ''}`,
        cidadeUf: h.endCidade ?? '', origem: 'Histórico',
      });
    }
    for (const p of d.protheus?.clientes ?? []) {
      for (const e of p.enderecos) {
        out.push({
          nome: p.nome, telefone: p.telefone,
          endereco: `${e.logradouro}${e.bairro ? ` — ${e.bairro}` : ''}`,
          cidadeUf: [e.cidade, e.uf].filter(Boolean).join('/'), origem: 'Protheus',
        });
      }
    }
    // dedupe por nome+endereço+cidade
    const vistos = new Set<string>();
    return out.filter((l) => {
      const k = `${l.nome}|${l.endereco}|${l.cidadeUf}`.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }

  async function buscar(e?: FormEvent) {
    e?.preventDefault();
    const q = termo.trim();
    if (q.length < 3) { setErro('Informe ao menos 3 caracteres (telefone, nome ou matrícula).'); return; }
    setLoading(true); setErro(null);
    try {
      const { data } = await logisticaApi.get<BuscaResp>('/cadastro/busca', { params: { termo: q } });
      setLinhas(montarLinhas(data));
    } catch {
      setErro('Falha na consulta.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: keyof Linha) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  const SortIcon = ({ col }: { col: keyof Linha }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-capul-600" /> : <ArrowDown className="h-3 w-3 text-capul-600" />;
  };
  const ordenadas = useMemo(() => {
    const arr = [...(linhas ?? [])];
    arr.sort((a, b) => {
      const cmp = String(a[sortKey] ?? '').localeCompare(String(b[sortKey] ?? ''), 'pt-BR');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [linhas, sortKey, sortDir]);

  const th = 'px-3 py-2.5';
  const btnSort = 'flex items-center gap-1 hover:text-slate-700';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Consulta de Endereços</h2>
        <p className="text-sm text-slate-500">
          Busque por telefone, nome ou matrícula e veja os endereços vinculados (clientes locais, histórico e Protheus).
          O cadastro é feito na <strong>Nova Entrega</strong>.
        </p>
      </div>

      <form onSubmit={buscar} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Telefone, nome ou matrícula (ex.: E01047)…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-capul-500 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-capul-600 px-4 py-2 text-sm font-medium text-white hover:bg-capul-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
        </button>
      </form>

      {erro && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}

      {linhas !== null && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {ordenadas.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum endereço encontrado para “{termo}”.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className={th}><button onClick={() => toggleSort('nome')} className={btnSort}>Nome <SortIcon col="nome" /></button></th>
                  <th className={th}><button onClick={() => toggleSort('endereco')} className={btnSort}>Endereço <SortIcon col="endereco" /></button></th>
                  <th className={th}><button onClick={() => toggleSort('cidadeUf')} className={btnSort}>Cidade <SortIcon col="cidadeUf" /></button></th>
                  <th className={th}><button onClick={() => toggleSort('telefone')} className={btnSort}>Telefone <SortIcon col="telefone" /></button></th>
                  <th className={th}><button onClick={() => toggleSort('origem')} className={btnSort}>Origem <SortIcon col="origem" /></button></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ordenadas.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-700">{l.nome}</td>
                    <td className="px-3 py-2 text-slate-600">{l.endereco}</td>
                    <td className="px-3 py-2 text-slate-500">{l.cidadeUf || '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{l.telefone ? maskTelefone(l.telefone) : '—'}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${COR[l.origem]}`}>{l.origem}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
