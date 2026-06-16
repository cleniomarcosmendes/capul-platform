import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Truck, Wrench } from 'lucide-react';
import { coreApi, logisticaApi } from '../services/api';
import { maskPlaca } from '../utils/format';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToast } from '../components/Toast';

// Form de veículo (padrão FormPage do workspace): /veiculos/novo e
// /veiculos/:id/editar no MESMO componente.

interface CoreItem { id: string; nome?: string; codigo?: string; nomeFantasia?: string }
const labelCore = (i: CoreItem) => i.nomeFantasia || i.nome || i.codigo || i.id.slice(0, 8);

const TIPOS = ['CARRO', 'UTILITARIO', 'CAMINHAO', 'OUTRO'];
const PROPRIEDADES: [string, string][] = [['PROPRIO', 'Próprio'], ['ALUGADO', 'Alugado']];
const SITUACOES = ['DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'BAIXADO'];

export function VeiculoFormPage() {
  const { id } = useParams<{ id: string }>();
  const modoEdicao = !!id;
  const navigate = useNavigate();

  const [filiais, setFiliais] = useState<CoreItem[]>([]);
  const [departamentos, setDepartamentos] = useState<CoreItem[]>([]);
  const [usuarios, setUsuarios] = useState<CoreItem[]>([]);

  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [marca, setMarca] = useState('');
  const [ano, setAno] = useState('');
  const [tipo, setTipo] = useState('CARRO');
  const [propriedade, setPropriedade] = useState('PROPRIO');
  const [kmAtual, setKmAtual] = useState('0');
  const [intervaloManutencaoKm, setIntervalo] = useState('');
  const [kmUltimaManutencao, setKmUltima] = useState<number | null>(null);
  const [kmProximaManutencao, setKmProxima] = useState<number | null>(null);
  const [filialId, setFilialId] = useState('');
  const [departamentoLotacaoId, setDepartamentoId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [situacao, setSituacao] = useState('DISPONIVEL');
  const [carregando, setCarregando] = useState(modoEdicao);
  const [salvando, setSalvando] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { ConfirmDialog: DirtyDialog } = useUnsavedChanges(dirty);
  const { toast } = useToast();

  useEffect(() => {
    void (async () => {
      const [f, d, u] = await Promise.all([
        coreApi.get<CoreItem[]>('/filiais').catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/departamentos').catch(() => ({ data: [] })),
        coreApi.get<CoreItem[]>('/usuarios').catch(() => ({ data: [] })),
      ]);
      setFiliais(f.data); setDepartamentos(d.data); setUsuarios(u.data);
    })();
  }, []);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const { data: v } = await logisticaApi.get<{
          placa: string; modelo?: string | null; marca?: string | null; ano?: number | null;
          tipo: string; propriedade?: string; kmAtual: number; filialId: string; departamentoLotacaoId: string;
          supervisorId: string; situacao: string;
          intervaloManutencaoKm?: number | null; kmUltimaManutencao?: number | null; kmProximaManutencao?: number | null;
        }>(`/veiculos/${id}`);
        setPlaca(v.placa); setModelo(v.modelo ?? ''); setMarca(v.marca ?? '');
        setAno(v.ano ? String(v.ano) : ''); setTipo(v.tipo); setPropriedade(v.propriedade ?? 'PROPRIO'); setKmAtual(String(v.kmAtual ?? 0));
        setIntervalo(v.intervaloManutencaoKm != null ? String(v.intervaloManutencaoKm) : '');
        setKmUltima(v.kmUltimaManutencao ?? null); setKmProxima(v.kmProximaManutencao ?? null);
        setFilialId(v.filialId); setDepartamentoId(v.departamentoLotacaoId);
        setSupervisorId(v.supervisorId); setSituacao(v.situacao);
      } catch {
        toast('error', 'Veículo não encontrado.');
      } finally { setCarregando(false); }
    })();
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!filialId || !departamentoLotacaoId || !supervisorId) {
      toast('warning', 'Filial, departamento e supervisor são obrigatórios.');
      return;
    }
    setSalvando(true);
    const payload = {
      filialId,
      placa,
      modelo: modelo || undefined,
      marca: marca || undefined,
      ano: ano ? parseInt(ano) : undefined,
      tipo,
      propriedade,
      kmAtual: kmAtual ? parseInt(kmAtual) : 0,
      intervaloManutencaoKm: intervaloManutencaoKm ? parseInt(intervaloManutencaoKm) : undefined,
      departamentoLotacaoId,
      supervisorId,
      ...(modoEdicao ? { situacao } : {}),
    };
    try {
      if (modoEdicao) await logisticaApi.patch(`/veiculos/${id}`, payload);
      else await logisticaApi.post('/veiculos', payload);
      setDirty(false);
      toast('success', modoEdicao ? 'Veículo atualizado.' : 'Veículo cadastrado.');
      navigate('/veiculos');
    } catch (err) {
      const m = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast('error', Array.isArray(m) ? m.join(', ') : m || 'Falha ao salvar veículo.');
      setSalvando(false);
    }
  }

  const inp = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none';
  const lbl = 'block text-xs font-medium text-slate-500';

  if (carregando) return <div className="p-6 text-sm text-slate-500"><Loader2 className="inline h-4 w-4 animate-spin" /> Carregando…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4" onChange={() => setDirty(true)}>
      {DirtyDialog}
      <Link to="/veiculos" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Voltar para Frota
      </Link>

      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
          <Truck className="h-5 w-5 text-sky-600" /> {modoEdicao ? `Editar veículo ${placa}` : 'Novo veículo'}
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Placa *</label>
            <input value={placa} onChange={(e) => setPlaca(maskPlaca(e.target.value))} required placeholder="ABC1D23" maxLength={7} className={`${inp} font-mono uppercase`} /></div>
          <div><label className={lbl}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className={lbl}>Propriedade</label>
            <select value={propriedade} onChange={(e) => setPropriedade(e.target.value)} className={inp}>{PROPRIEDADES.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}</select></div>
          <div><label className={lbl}>Marca</label><input value={marca} onChange={(e) => setMarca(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Modelo</label><input value={modelo} onChange={(e) => setModelo(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>Ano</label><input type="number" value={ano} onChange={(e) => setAno(e.target.value)} className={inp} /></div>
          <div><label className={lbl}>KM atual</label><input type="number" value={kmAtual} onChange={(e) => setKmAtual(e.target.value)} className={inp} /></div>
          {modoEdicao && (
            <div className="col-span-2"><label className={lbl}>Situação</label>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={inp}>{SITUACOES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div><label className={lbl}>Filial *</label>
            <select value={filialId} onChange={(e) => setFilialId(e.target.value)} className={inp}><option value="">—</option>{filiais.map((f) => <option key={f.id} value={f.id}>{labelCore(f)}</option>)}</select></div>
          <div><label className={lbl}>Departamento de lotação *</label>
            <select value={departamentoLotacaoId} onChange={(e) => setDepartamentoId(e.target.value)} className={inp}><option value="">—</option>{departamentos.map((d) => <option key={d.id} value={d.id}>{labelCore(d)}</option>)}</select></div>
          <div><label className={lbl}>Supervisor responsável *</label>
            <select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)} className={inp}><option value="">—</option>{usuarios.map((u) => <option key={u.id} value={u.id}>{labelCore(u)}</option>)}</select></div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Wrench className="h-3.5 w-3.5" /> Manutenção preventiva (por KM)
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><label className={lbl}>Intervalo de revisão (km)</label>
              <input type="number" min={0} value={intervaloManutencaoKm} onChange={(e) => setIntervalo(e.target.value)} placeholder="ex.: 10000" className={inp} /></div>
            <div><label className={lbl}>Última manutenção (km)</label>
              <input value={kmUltimaManutencao != null ? kmUltimaManutencao.toLocaleString('pt-BR') : '—'} disabled className={`${inp} bg-slate-100 text-slate-500`} /></div>
            <div><label className={lbl}>Próxima revisão (km)</label>
              <input value={kmProximaManutencao != null ? kmProximaManutencao.toLocaleString('pt-BR') : '—'} disabled className={`${inp} bg-slate-100 text-slate-500`} /></div>
          </div>
          <p className="mt-2 text-xs text-slate-400">A próxima revisão é recalculada ao registrar a manutenção no Monitor da Frota (última + intervalo).</p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Link to="/veiculos" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancelar</Link>
          <button type="submit" disabled={salvando}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
            {modoEdicao ? 'Salvar alterações' : 'Cadastrar veículo'}
          </button>
        </div>
      </form>
    </div>
  );
}
