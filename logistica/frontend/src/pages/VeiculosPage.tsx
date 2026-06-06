import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Truck, Plus } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { maskPlaca } from '../utils/format';

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
interface Veiculo {
  id: string;
  placa: string;
  modelo?: string | null;
  marca?: string | null;
  tipo: string;
  situacao: string;
  kmAtual: number;
  filialId: string;
  departamentoLotacaoId: string;
  supervisorId: string;
}

const TIPOS = ['CARRO', 'UTILITARIO', 'CAMINHAO', 'OUTRO'];
const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);

export function VeiculosPage() {
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [departamentos, setDepartamentos] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [marca, setMarca] = useState('');
  const [ano, setAno] = useState('');
  const [tipo, setTipo] = useState('CARRO');
  const [kmAtual, setKmAtual] = useState('0');
  const [filialId, setFilialId] = useState('');
  const [departamentoLotacaoId, setDepartamentoId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  async function carregar() {
    setLoading(true);
    try {
      const [v, f, d, u] = await Promise.all([
        logisticaApi.get<Veiculo[]>('/veiculos'),
        coreApi.get<CoreItem[]>('/filiais').catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/departamentos').catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
      ]);
      setVeiculos(v.data);
      setFiliais(f.data);
      setDepartamentos(d.data);
      setUsuarios(u.data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void carregar(); }, []);

  const nomePorId = (lista: CoreItem[], id: string) => {
    const i = lista.find((x) => x.id === id);
    return i ? labelCore(i) : id.slice(0, 8);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!filialId || !departamentoLotacaoId || !supervisorId) {
      setMsg({ tipo: 'erro', texto: 'Filial, departamento e supervisor são obrigatórios.' });
      return;
    }
    setSalvando(true);
    try {
      await logisticaApi.post('/veiculos', {
        filialId,
        placa,
        modelo: modelo || undefined,
        marca: marca || undefined,
        ano: ano ? parseInt(ano) : undefined,
        tipo,
        kmAtual: kmAtual ? parseInt(kmAtual) : 0,
        departamentoLotacaoId,
        supervisorId,
      });
      setMsg({ tipo: 'ok', texto: `Veículo ${placa.toUpperCase()} cadastrado.` });
      setPlaca(''); setModelo(''); setMarca(''); setAno(''); setKmAtual('0');
      void carregar();
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setMsg({ tipo: 'erro', texto: Array.isArray(m) ? m.join(', ') : m || 'Falha ao cadastrar veículo.' });
    } finally {
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <form onSubmit={submit} className="lg:col-span-1 space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800"><Truck className="h-5 w-5 text-sky-600" /> Novo veículo</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-xs font-medium text-slate-500">Placa *</label><input value={placa} onChange={(e) => setPlaca(maskPlaca(e.target.value))} required placeholder="ABC1D23" maxLength={7} className={`${inp} font-mono uppercase`} /></div>
          <div><label className="block text-xs font-medium text-slate-500">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div><label className="block text-xs font-medium text-slate-500">Modelo</label><input value={modelo} onChange={(e) => setModelo(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-500">Marca</label><input value={marca} onChange={(e) => setMarca(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-500">Ano</label><input type="number" value={ano} onChange={(e) => setAno(e.target.value)} className={inp} /></div>
          <div><label className="block text-xs font-medium text-slate-500">KM atual</label><input type="number" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} className={inp} /></div>
        </div>
        <div><label className="block text-xs font-medium text-slate-500">Filial *</label>
          <select value={filialId} onChange={(e) => setFilialId(e.target.value)} className={inp}><option value="">—</option>{filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}</select>
        </div>
        <div><label className="block text-xs font-medium text-slate-500">Departamento de lotação *</label>
          <select value={departamentoLotacaoId} onChange={(e) => setDepartamentoId(e.target.value)} className={inp}><option value="">—</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{labelCore(d)}</option>)}</select>
        </div>
        <div><label className="block text-xs font-medium text-slate-500">Supervisor responsável *</label>
          <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inp}><option value="">—</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{labelCore(u)}</option>)}</select>
        </div>
        {msg && <div className={`rounded-lg px-3 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.texto}</div>}
        <button type="submit" disabled={salvando} className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Cadastrar
        </button>
      </form>

      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">Frota ({veiculos.length})</div>
        {loading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : veiculos.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum veículo cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2 text-left">Placa</th><th className="px-4 py-2 text-left">Modelo</th><th className="px-4 py-2 text-left">Situação</th><th className="px-4 py-2 text-left">Supervisor</th><th className="px-4 py-2 text-right">KM</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {veiculos.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-mono font-medium">{v.placa}</td>
                  <td className="px-4 py-2">{v.marca} {v.modelo}</td>
                  <td className="px-4 py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{v.situacao}</span></td>
                  <td className="px-4 py-2 text-slate-600">{nomePorId(usuarios, v.supervisorId)}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.kmAtual}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
