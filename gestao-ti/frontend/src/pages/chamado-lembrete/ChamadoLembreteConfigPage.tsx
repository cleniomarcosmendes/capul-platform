import { useEffect, useState } from 'react';
import { Header } from '../../layouts/Header';
import { useToast } from '../../components/Toast';
import {
  chamadoLembreteService,
  type ChamadoLembreteConfig,
  type VarreduraResumo,
} from '../../services/chamadoLembrete.service';
import { BellRing, Save, Eye, AlertTriangle } from 'lucide-react';

/**
 * Gestão de chamado parado — config dos lembretes/escalonamento/auto-fechamento.
 * Admin/Gestor. O job diário avisa quem está segurando o chamado e fecha
 * PENDENTE_USUARIO sem resposta. "Pré-visualizar" roda a varredura em dry-run
 * (mostra quem SERIA notificado/fechado, sem enviar nada).
 */
export function ChamadoLembreteConfigPage() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<ChamadoLembreteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState<VarreduraResumo | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Form local
  const [f, setF] = useState({
    enabled: false, diasInatividadeEquipe: 3, diasInatividadeSolicitante: 3, diasEscala: 7,
    intervaloReenvioDias: 3, maxLembretes: 3, autoFechar: true, diasAutoFechamento: 3, horaExecucao: 8,
  });

  function aplicar(c: ChamadoLembreteConfig) {
    setCfg(c);
    setF({
      enabled: c.enabled, diasInatividadeEquipe: c.diasInatividadeEquipe,
      diasInatividadeSolicitante: c.diasInatividadeSolicitante, diasEscala: c.diasEscala,
      intervaloReenvioDias: c.intervaloReenvioDias, maxLembretes: c.maxLembretes,
      autoFechar: c.autoFechar, diasAutoFechamento: c.diasAutoFechamento, horaExecucao: c.horaExecucao,
    });
  }

  useEffect(() => {
    chamadoLembreteService.getConfig().then(aplicar)
      .catch(() => toast('error', 'Falha ao carregar a configuração.'))
      .finally(() => setLoading(false));
  }, [toast]);

  async function salvar() {
    setSalvando(true);
    try {
      aplicar(await chamadoLembreteService.updateConfig(f));
      toast('success', 'Configuração salva.');
    } catch {
      toast('error', 'Falha ao salvar.');
    } finally { setSalvando(false); }
  }

  async function preVisualizar() {
    setPreviewing(true);
    setPrevia(null);
    try {
      setPrevia(await chamadoLembreteService.executar(true));
    } catch {
      toast('error', 'Falha ao pré-visualizar.');
    } finally { setPreviewing(false); }
  }

  const set = (k: keyof typeof f) => (v: number | boolean) => setF((s) => ({ ...s, [k]: v }));

  return (
    <>
      <Header title="Gestão de chamado parado" />
      <div className="p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {loading ? (
            <div className="text-slate-500 text-sm">Carregando…</div>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Um job diário (às {f.horaExecucao}h) avisa por e-mail quem está segurando o chamado parado:
                <strong> técnico</strong> (chamado da equipe) ou <strong>solicitante</strong> (aguardando resposta),
                escala à <strong>equipe</strong> ao passar do prazo/SLA, e <strong>fecha</strong> automaticamente o
                que fica sem resposta do solicitante. Evita chamado aberto eternamente.
              </p>

              {!f.enabled && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Está <strong>desligado</strong>. Use <strong>Pré-visualizar</strong> para conferir o impacto antes de ligar — nada é enviado no dry-run.</span>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-capul-600" /> Regras
                  </h3>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${cfg?.enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {cfg?.enabled ? `Ativo — roda às ${cfg.horaExecucao}h` : 'Desligado'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 -mt-2">O estado reflete a config <strong>salva</strong>. Salve para aplicar.</p>

                <Toggle label="Ligado (dispara lembretes automaticamente)" checked={f.enabled} onChange={set('enabled')} />

                <div className="grid sm:grid-cols-2 gap-4">
                  <Num label="Dias parado → lembrar TÉCNICO" hint="Chamado da equipe sem interação." value={f.diasInatividadeEquipe} onChange={set('diasInatividadeEquipe')} />
                  <Num label="Dias parado → lembrar SOLICITANTE" hint="PENDENTE_USUARIO (aguardando resposta dele)." value={f.diasInatividadeSolicitante} onChange={set('diasInatividadeSolicitante')} />
                  <Num label="Dias parado → ESCALAR à equipe" hint="Também avisa os membros (ou se o SLA estourou)." value={f.diasEscala} onChange={set('diasEscala')} />
                  <Num label="Intervalo entre reenvios (dias)" hint="Não repete o lembrete antes disso." value={f.intervaloReenvioDias} onChange={set('intervaloReenvioDias')} />
                  <Num label="Máx. de lembretes por chamado" value={f.maxLembretes} onChange={set('maxLembretes')} />
                  <Num label="Hora da varredura (0–23)" value={f.horaExecucao} onChange={set('horaExecucao')} min={0} max={23} />
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <Toggle label="Fechar automaticamente por inatividade (PENDENTE_USUARIO)" hint="Após esgotar os lembretes sem resposta do solicitante." checked={f.autoFechar} onChange={set('autoFechar')} />
                  {f.autoFechar && (
                    <div className="sm:w-1/2">
                      <Num label="Dias após o último lembrete → fechar" value={f.diasAutoFechamento} onChange={set('diasAutoFechamento')} />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button onClick={preVisualizar} disabled={previewing}
                    className="inline-flex items-center gap-2 bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
                    <Eye className="w-4 h-4" /> {previewing ? 'Calculando…' : 'Pré-visualizar (dry-run)'}
                  </button>
                  <button onClick={salvar} disabled={salvando}
                    className="inline-flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                    <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>

              {previa && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-700 text-sm mb-3">Pré-visualização (nada foi enviado)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <Stat label="Lembrar técnico" n={previa.lembrarTecnico.length} nums={previa.lembrarTecnico} />
                    <Stat label="Lembrar solicitante" n={previa.lembrarSolicitante.length} nums={previa.lembrarSolicitante} />
                    <Stat label="Escalar à equipe" n={previa.escalados.length} nums={previa.escalados} />
                    <Stat label="Fechar por inatividade" n={previa.fechados.length} nums={previa.fechados} danger />
                    <Stat label="SAC (pulados)" n={previa.sacPulados} />
                    <Stat label="Sem destinatário" n={previa.semDestino} />
                  </div>
                </div>
              )}

              {cfg?.lastRunAt && (
                <p className="text-xs text-slate-400">
                  Última varredura automática: {new Date(cfg.lastRunAt).toLocaleString('pt-BR')}{cfg.lastResumo ? ` — ${cfg.lastResumo}` : ''}.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1" />
      <span>
        <span className="text-sm text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );
}

function Num({ label, hint, value, onChange, min = 1, max = 365 }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500">{label}</span>
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
      {hint && <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>}
    </label>
  );
}

function Stat({ label, n, nums, danger }: { label: string; n: number; nums?: number[]; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${danger && n > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`text-2xl font-semibold ${danger && n > 0 ? 'text-red-700' : 'text-slate-700'}`}>{n}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {nums && nums.length > 0 && (
        <div className="text-[11px] text-slate-400 mt-1 truncate" title={nums.map((x) => `#${x}`).join(', ')}>
          {nums.slice(0, 8).map((x) => `#${x}`).join(', ')}{nums.length > 8 ? ` +${nums.length - 8}` : ''}
        </div>
      )}
    </div>
  );
}
