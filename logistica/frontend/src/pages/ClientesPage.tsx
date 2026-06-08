import { useState, type FormEvent } from 'react';
import { Search, Loader2, MapPin } from 'lucide-react';
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
  'Cliente local': 'bg-sky-100 text-sky-700',
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
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Consultar
        </button>
      </form>

      {erro && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}

      {linhas !== null && (
        <div className="rounded-xl border border-slate-200 bg-white">
          {linhas.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Nenhum endereço encontrado para “{termo}”.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {linhas.map((l, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{l.nome}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${COR[l.origem]}`}>{l.origem}</span>
                    </div>
                    <div className="text-sm text-slate-600">{l.endereco}{l.cidadeUf ? ` · ${l.cidadeUf}` : ''}</div>
                    <div className="text-xs text-slate-400">{l.telefone ? maskTelefone(l.telefone) : 'sem telefone'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
