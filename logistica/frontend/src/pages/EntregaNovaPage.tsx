import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, Trash2, Package, X } from 'lucide-react';
import { logisticaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

type TipoCliente = 'IDENTIFICADO' | 'RECORRENTE_LOCAL' | 'EVENTUAL';

interface Cupom { numeroCupom: string; valor: string }
interface EntregaItem {
  id: string;
  numero: number;
  destinatarioNome: string;
  telefone?: string | null;
  endLogradouro: string;
  endNumero?: string | null;
  endBairro?: string | null;
  endCidade?: string | null;
  quantidadeVolumes: number;
  status: string;
  totalCupons: number;
}

const TIPOS: { v: TipoCliente; label: string }[] = [
  { v: 'IDENTIFICADO', label: 'Com matrícula' },
  { v: 'RECORRENTE_LOCAL', label: 'Recorrente (local)' },
  { v: 'EVENTUAL', label: 'Eventual' },
];

export function EntregaNovaPage() {
  const { usuario } = useAuth();
  const filialId = usuario?.filialAtual?.id ?? usuario?.filiais?.[0]?.id ?? '';

  const [tipoCliente, setTipoCliente] = useState<TipoCliente>('EVENTUAL');
  const [matricula, setMatricula] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('Unaí');
  const [cep, setCep] = useState('');
  const [referencia, setReferencia] = useState('');
  const [volumes, setVolumes] = useState(1);
  const [observacoes, setObservacoes] = useState('');
  const [cupons, setCupons] = useState<Cupom[]>([{ numeroCupom: '', valor: '' }]);

  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pendentes, setPendentes] = useState<EntregaItem[]>([]);

  const totalCupons = cupons.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);

  async function carregarPendentes() {
    try {
      const { data } = await logisticaApi.get<EntregaItem[]>('/entregas', {
        params: filialId ? { filialId } : undefined,
      });
      setPendentes(data);
    } catch { /* lista vazia em caso de erro */ }
  }
  useEffect(() => { void carregarPendentes(); }, [filialId]);

  function resetForm() {
    setMatricula(''); setDestinatarioNome(''); setTelefone('');
    setLogradouro(''); setNumero(''); setBairro(''); setCep(''); setReferencia('');
    setVolumes(1); setObservacoes(''); setCupons([{ numeroCupom: '', valor: '' }]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!filialId) { setMsg({ tipo: 'erro', texto: 'Sem filial no perfil — selecione uma filial no Hub.' }); return; }
    setSalvando(true);
    try {
      const { data } = await logisticaApi.post('/entregas', {
        filialId,
        tipoCliente,
        matricula: tipoCliente === 'IDENTIFICADO' ? matricula || undefined : undefined,
        destinatarioNome,
        telefone: telefone || undefined,
        endLogradouro: logradouro,
        endNumero: numero || undefined,
        endBairro: bairro || undefined,
        endCidade: cidade || undefined,
        endCep: cep || undefined,
        endReferencia: referencia || undefined,
        quantidadeVolumes: volumes,
        observacoes: observacoes || undefined,
        cupons: cupons
          .filter((c) => c.numeroCupom || c.valor)
          .map((c) => ({ numeroCupom: c.numeroCupom || undefined, valor: c.valor ? parseFloat(c.valor) : undefined })),
      });
      setMsg({ tipo: 'ok', texto: `Entrega nº ${data.numero} registrada.` });
      resetForm();
      void carregarPendentes();
    } catch {
      setMsg({ tipo: 'erro', texto: 'Falha ao registrar entrega.' });
    } finally {
      setSalvando(false);
    }
  }

  async function cancelar(id: string) {
    try {
      await logisticaApi.post(`/entregas/${id}/cancelar`, { motivo: 'Cancelada no balcão' });
      void carregarPendentes();
    } catch { /* ignore */ }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Formulário */}
      <form onSubmit={submit} className="lg:col-span-2 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-800">Nova entrega</h2>

        <div className="flex gap-2">
          {TIPOS.map((t) => (
            <button type="button" key={t.v} onClick={() => setTipoCliente(t.v)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${tipoCliente === t.v ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tipoCliente === 'IDENTIFICADO' && (
          <div>
            <label className="block text-xs font-medium text-slate-500">Matrícula</label>
            <input value={matricula} onChange={(e) => setMatricula(e.target.value)} className={inp} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Destinatário *</label>
            <input value={destinatarioNome} onChange={(e) => setDestinatarioNome(e.target.value)} required className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500">Telefone</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid grid-cols-6 gap-3">
          <div className="col-span-4">
            <label className="block text-xs font-medium text-slate-500">Logradouro *</label>
            <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} required className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Número</label>
            <input value={numero} onChange={(e) => setNumero(e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Bairro</label>
            <input value={bairro} onChange={(e) => setBairro(e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Cidade</label>
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">CEP</label>
            <input value={cep} onChange={(e) => setCep(e.target.value)} className={inp} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500">Ponto de referência</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inp} />
        </div>

        {/* Cupons */}
        <div>
          <label className="block text-xs font-medium text-slate-500">Cupons / Notas</label>
          <div className="mt-1 space-y-2">
            {cupons.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Nº cupom" value={c.numeroCupom}
                  onChange={(e) => setCupons((p) => p.map((x, j) => j === i ? { ...x, numeroCupom: e.target.value } : x))}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input placeholder="Valor" type="number" step="0.01" value={c.valor}
                  onChange={(e) => setCupons((p) => p.map((x, j) => j === i ? { ...x, valor: e.target.value } : x))}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button type="button" onClick={() => setCupons((p) => p.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setCupons((p) => [...p, { numeroCupom: '', valor: '' }])}
            className="mt-2 flex items-center gap-1 text-xs text-sky-700 hover:underline"><Plus className="h-3 w-3" /> Adicionar cupom</button>
          <div className="mt-1 text-right text-sm text-slate-600">Total: <strong>R$ {totalCupons.toFixed(2)}</strong></div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500">Volumes</label>
            <input type="number" min={1} value={volumes} onChange={(e) => setVolumes(Math.max(1, parseInt(e.target.value) || 1))} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500">Observações</label>
            <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={inp} />
          </div>
        </div>

        {msg && (
          <div className={`rounded-lg px-4 py-2 text-sm ${msg.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.texto}
          </div>
        )}

        <button type="submit" disabled={salvando}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Registrar entrega
        </button>
      </form>

      {/* Pendentes */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Pendentes ({pendentes.length})</h3>
        {pendentes.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma entrega pendente.</p>
        ) : (
          <ul className="space-y-2">
            {pendentes.map((e) => (
              <li key={e.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">#{e.numero} · {e.destinatarioNome}</span>
                  <button onClick={() => cancelar(e.id)} className="text-slate-400 hover:text-red-600" title="Cancelar"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="text-slate-500">{e.endLogradouro}{e.endNumero ? `, ${e.endNumero}` : ''} — {e.endBairro}</div>
                <div className="text-slate-400">{e.quantidadeVolumes} vol · R$ {e.totalCupons.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
