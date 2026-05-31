import { useEffect, useState, type FormEvent } from 'react';
import { Search, Plus, Loader2, MapPin } from 'lucide-react';
import { logisticaApi } from '../services/api';

interface Endereco {
  id: string;
  apelido?: string | null;
  logradouro: string;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}
interface ClienteLocal {
  id: string;
  nome: string;
  telefone?: string | null;
  enderecos?: Endereco[];
}

export function ClientesPage() {
  const [termo, setTermo] = useState('');
  const [clientes, setClientes] = useState<ClienteLocal[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // form novo cliente
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar(q?: string) {
    setLoading(true);
    setErro(null);
    try {
      const { data } = await logisticaApi.get<ClienteLocal[]>('/cadastro/clientes-locais', {
        params: q ? { q } : undefined,
      });
      setClientes(data);
    } catch {
      setErro('Falha ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function criar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await logisticaApi.post('/cadastro/clientes-locais', { nome, telefone: telefone || undefined });
      setNome('');
      setTelefone('');
      await carregar(termo || undefined);
    } catch {
      setErro('Falha ao salvar cliente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Clientes &amp; Endereços</h2>
        <p className="text-sm text-slate-500">Cadastro local (recorrente sem matrícula) e busca.</p>
      </div>

      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && carregar(termo || undefined)}
            placeholder="Buscar por nome ou telefone…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          onClick={() => carregar(termo || undefined)}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          Buscar
        </button>
      </div>

      {/* Novo cliente */}
      <form onSubmit={criar} className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-slate-500">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="w-44">
          <label className="block text-xs font-medium text-slate-500">Telefone</label>
          <input
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={salvando || !nome.trim()}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Novo cliente
        </button>
      </form>

      {erro && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{erro}</div>}

      {/* Lista */}
      <div className="rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum cliente encontrado.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="font-medium text-slate-800">{c.nome}</div>
                <div className="text-xs text-slate-500">{c.telefone || 'sem telefone'}</div>
                {c.enderecos && c.enderecos.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2">
                    {c.enderecos.map((e) => (
                      <span key={e.id} className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        <MapPin className="h-3 w-3" /> {e.logradouro}{e.numero ? `, ${e.numero}` : ''} — {e.cidade}/{e.uf}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
