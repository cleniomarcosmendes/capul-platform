import { useEffect, useState } from 'react';
import { logisticaRastreamentoService } from '../../services/logistica-rastreamento.service';
import type { RastreamentoConfig } from '../../services/logistica-rastreamento.service';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

function formatData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

/**
 * Política de Rastreamento GPS da Logística (Fase A/B) — funcionalidade visível
 * no Configurador (regra da plataforma: nada de black box). Documenta o que é
 * coletado, quando, base legal LGPD e a retenção. Os números ao vivo são
 * best-effort: dependem de o usuário ter acesso ao módulo Logística.
 */
export function RastreamentoGpsPage() {
  const confirm = useConfirm();
  const toast = useToast();

  const [cfg, setCfg] = useState<RastreamentoConfig | null>(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purgando, setPurgando] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      setCfg(await logisticaRastreamentoService.getConfig());
      setSemAcesso(false);
    } catch {
      // 403 (sem módulo Logística) ou indisponível — a política segue visível.
      setSemAcesso(true);
    } finally {
      setLoading(false);
    }
  }

  async function purgarAgora() {
    const ok = await confirm({
      title: 'Rodar a purga agora?',
      description:
        'Remove imediatamente as posições de GPS além da janela de retenção. ' +
        'A purga automática já roda todo dia às 03:30. Ação não reversível.',
      variant: 'danger',
      confirmLabel: 'Purgar agora',
    });
    if (!ok) return;
    setPurgando(true);
    try {
      const r = await logisticaRastreamentoService.purgar();
      toast.success(`Purga concluída: ${r.removidas} posição(ões) removida(s).`);
      void refresh();
    } catch {
      toast.error('Falha ao purgar (verifique seu acesso ao módulo Logística).');
    } finally {
      setPurgando(false);
    }
  }

  const retencao = cfg?.retencaoDias ?? 7;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Rastreamento GPS — Política (Logística)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitoramento em tempo real dos veículos/entregadores no app de Entregas. Esta tela
          documenta o que é coletado, quando, a base legal e a retenção — registro de transparência
          da plataforma.
        </p>
      </header>

      {/* Estatísticas ao vivo (best-effort) */}
      {!loading && !semAcesso && cfg && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Retenção atual" value={`${cfg.retencaoDias} dias`} />
          <Card label="Posições armazenadas" value={cfg.totalPosicoes.toLocaleString('pt-BR')} />
          <Card label="Viagens com GPS" value={cfg.viagensComPosicao.toLocaleString('pt-BR')} />
          <Card label="Posição mais antiga" value={formatData(cfg.posicaoMaisAntiga)} />
        </section>
      )}
      {!loading && semAcesso && (
        <div className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
          Estatísticas ao vivo indisponíveis neste perfil (requer acesso ao módulo Logística).
          A política abaixo continua válida.
        </div>
      )}

      {/* Política / orientação — sempre visível */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-800">Como funciona</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>O app do entregador/condutor envia a posição de GPS <strong>somente enquanto há uma viagem em curso</strong> — liga na saída e <strong>desliga automaticamente no retorno</strong>. Rastreia a <em>entrega/viagem</em>, não a pessoa 24h.</li>
          <li>O gestor acompanha no <strong>Monitor da Frota</strong> (mapa ao vivo, OpenStreetMap). Visível só para <strong>GESTOR_ENTREGA / GESTOR_FROTA / ADMIN</strong>.</li>
          <li><strong>Transparência ao entregador:</strong> aviso visível no app ("Localização ativa durante a viagem") e consentimento via diálogo de permissão do sistema; em segundo plano, notificação fixa do serviço.</li>
          <li>Fase A: rastreia com o app aberto. Fase B (build standalone): também com o app em segundo plano.</li>
        </ul>

        <h2 className="text-lg font-semibold text-slate-800 pt-2">Base legal (LGPD)</h2>
        <p>
          Aparelhos <strong>corporativos</strong> de uso exclusivo de trabalho — base de legítimo
          interesse / execução de contrato. A coleta é restrita à jornada (viagem ativa), o acesso é
          restrito a gestores e o dado bruto tem retenção curta (abaixo).
        </p>

        <h2 className="text-lg font-semibold text-slate-800 pt-2">Retenção e descarte</h2>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>O rastro bruto (<code className="bg-slate-100 px-1 rounded">logistica.posicao_veiculo</code>) é mantido por <strong>{retencao} dias</strong> e depois apagado por uma purga automática diária (03:30).</li>
          <li>Configurável pela variável de ambiente <code className="bg-slate-100 px-1 rounded">RASTREAMENTO_RETENCAO_DIAS</code> no backend da Logística.</li>
          <li>O GPS da <strong>prova de entrega/baixa</strong> é um dado separado (lastro de cobrança) e <strong>não</strong> é afetado por esta purga.</li>
        </ul>
      </section>

      {/* Operação */}
      {!semAcesso && (
        <section className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-2">Operações</h2>
          <p className="text-sm text-slate-600 mb-4">
            A purga roda automaticamente todo dia às 03:30. Use o botão abaixo apenas para forçar a
            execução agora (ex.: revisão de conformidade).
          </p>
          <button
            disabled={purgando || loading}
            onClick={purgarAgora}
            className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {purgando ? 'Purgando…' : 'Rodar purga agora'}
          </button>
        </section>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
