import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useToast } from '../../components/Toast';
import { sacIndicadoresService, type SacIndicadores } from '../../services/sacIndicadores.service';
import { ChevronLeft, ChevronRight, Ticket, CheckCircle2, Layers, Clock, Mail, Inbox } from 'lucide-react';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CANAL_LABEL: Record<string, string> = { BALCAO: 'Balcão', TELEFONE: 'Telefone', EMAIL: 'E-mail', OUTRO: 'Outro', NAO_INFORMADO: 'Não informado' };
const STATUS_LABEL: Record<string, string> = {
  ABERTO: 'Aberto', EM_ATENDIMENTO: 'Em atendimento', PENDENTE: 'Pendente', AGUARDANDO_USUARIO: 'Aguardando usuário',
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado', CANCELADO: 'Cancelado', REABERTO: 'Reaberto',
};

/** SAC 4c — indicadores do SAC (volume, canal, equipe, status, tempo, e-mail). */
export function SacIndicadoresPage() {
  const { toast } = useToast();
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [data, setData] = useState<SacIndicadores | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    sacIndicadoresService
      .buscar(mes, ano)
      .then(setData)
      .catch(() => toast('error', 'Falha ao carregar os indicadores do SAC.'))
      .finally(() => setLoading(false));
  }, [mes, ano, toast]);

  function navMes(delta: number) {
    const d = new Date(ano, mes - 1 + delta, 1);
    setMes(d.getMonth() + 1);
    setAno(d.getFullYear());
  }

  const totalCanal = (data?.porCanal ?? []).reduce((a, c) => a + c.total, 0) || 1;
  const totalStatus = (data?.porStatus ?? []).reduce((a, c) => a + c.total, 0) || 1;
  const totalEquipe = (data?.porEquipe ?? []).reduce((a, c) => a + c.total, 0) || 1;

  return (
    <>
      <Header title="SAC — Indicadores" />
      <div className="p-6 space-y-6">
        {/* Navegação de mês */}
        <div className="flex items-center gap-3">
          <button onClick={() => navMes(-1)} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50"><ChevronLeft className="w-4 h-4" /></button>
          <span className="text-sm font-medium text-slate-700 w-32 text-center">{MESES[mes - 1]} / {ano}</span>
          <button onClick={() => navMes(1)} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {loading || !data ? (
          <div className="text-slate-500 text-sm">Carregando…</div>
        ) : (
          <>
            {/* Cards de volume */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card icon={<Ticket className="w-5 h-5 text-sky-600" />} label="Abertos no mês" value={data.volume.abertosNoMes} />
              <Card icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />} label="Resolvidos no mês" value={data.volume.resolvidosNoMes} />
              <Card icon={<Layers className="w-5 h-5 text-amber-600" />} label="Em aberto (backlog)" value={data.volume.backlogAtual} />
              <Card icon={<Clock className="w-5 h-5 text-slate-600" />} label="Tempo médio resolução"
                value={data.tempoResolucaoMedioHoras != null ? `${data.tempoResolucaoMedioHoras} h` : '—'} />
            </div>

            {/* Breakdowns */}
            <div className="grid md:grid-cols-3 gap-4">
              <Breakdown title="Por canal de origem" itens={data.porCanal.map((c) => ({ label: CANAL_LABEL[c.canal] ?? c.canal, total: c.total }))} total={totalCanal} />
              <Breakdown title="Por equipe" itens={data.porEquipe.map((e) => ({ label: e.nome, total: e.total }))} total={totalEquipe} />
              <Breakdown title="Por status (abertos no mês)" itens={data.porStatus.map((s) => ({ label: STATUS_LABEL[s.status] ?? s.status, total: s.total }))} total={totalStatus} />
            </div>

            {/* E-mail de entrada */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2 mb-3">
                <Mail className="w-4 h-4 text-capul-600" /> E-mail de entrada (no mês)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Mini label="Ingeridos" value={data.email.ingeridosNoMes} />
                <Mini label="Casados" value={data.email.casados} />
                <Mini label="Triagem" value={data.email.triagem} />
                <Mini label="Ignorados/dup" value={data.email.ignorados + data.email.duplicados} />
                <Mini label="Triagem pendente" value={data.email.triagemPendente} destaque={data.email.triagemPendente > 0} icon={<Inbox className="w-4 h-4" />} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">{icon}{label}</div>
      <div className="text-2xl font-semibold text-slate-800 mt-1">{value}</div>
    </div>
  );
}

function Mini({ label, value, destaque, icon }: { label: string; value: number; destaque?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-lg p-3 border ${destaque ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${destaque ? 'text-amber-700' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

function Breakdown({ title, itens, total }: { title: string; itens: { label: string; total: number }[]; total: number }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-semibold text-slate-700 text-sm mb-3">{title}</h3>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400">Sem dados no mês.</p>
      ) : (
        <div className="space-y-2">
          {itens.map((it, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm text-slate-600">
                <span className="truncate pr-2">{it.label}</span>
                <span className="font-medium">{it.total}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-capul-500 rounded-full" style={{ width: `${Math.round((it.total / total) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
