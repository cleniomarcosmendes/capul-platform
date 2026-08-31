import { useEffect, useState } from 'react';
import { Truck, ShieldAlert, ShieldCheck, RefreshCw, Sparkles, Database, KeyRound } from 'lucide-react';
import { fiscalApi } from '../../../services/api';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { useToast } from '../../../components/Toast';
import { useConfirm } from '../../../components/ConfirmDialog';
import { useAuth } from '../../../contexts/AuthContext';
import { extractApiError } from '../../../utils/errors';

interface AmbienteStatus {
  ambienteAtivo: 'PRODUCAO' | 'HOMOLOGACAO';
  pauseSync: boolean;
  ultimaAlteracaoEm: string;
  ultimaAlteracaoPor: string | null;
  cteDistribuicaoAtivo: boolean;
  cteDistribuicaoAmbiente: 'PRODUCAO' | 'HOMOLOGACAO';
  cteDistribuicaoAlteradoEm: string | null;
  cteDistribuicaoAlteradoPor: string | null;
  cteProtheusGravaAtivo: boolean;
  cteProtheusGravaAlteradoEm: string | null;
  cteProtheusGravaAlteradoPor: string | null;
}

interface ReprocessoResultado {
  examinados: number;
  corrigidos: number;
  aindaSemChave: Array<{ id: number; schema: string; motivo: string }>;
}

/**
 * Aba "CT-e Distribuição" de /operacao/controle.
 *
 * Centraliza todo controle do serviço CT-e Distribuição num só lugar:
 *   - Switch ATIVO/INATIVO (ADMIN_TI) — substitui env var operacional
 *   - PROD/HOM próprio do CT-e (ADMIN_TI) — independente do global NF-e
 *   - Ações de manutenção (ADMIN_TI): forçar sincronização de filiais,
 *     enriquecimento de pendentes e reprocessamento de metadados
 *   - Auditoria visível: quem alterou, quando
 *
 * Antes desta aba (até 05/05/2026):
 *   - Ativar/desativar exigia editar .env + restart do container (Douglas/SSH)
 *   - Mudar PROD/HOM mexia no global, afetando NF-e e Cadastro junto
 *   - Não havia visibilidade do estado pelo setor fiscal
 */
export function CteDistribuicaoTab() {
  const [status, setStatus] = useState<AmbienteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  // Resultado do ultimo reprocessamento de metadados. Fica NA TELA (nao so no
  // toast) porque o que interessa nessa acao e justamente QUEM RESISTIU e por
  // que — um toast de 6s nao serve pra anotar id/schema/motivo.
  const [reprocesso, setReprocesso] = useState<ReprocessoResultado | null>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const { fiscalRole } = useAuth();
  const isAdmin = fiscalRole === 'ADMIN_TI';

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<AmbienteStatus>('/ambiente');
      setStatus(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleAtivo() {
    if (!status) return;
    const novoEstado = !status.cteDistribuicaoAtivo;
    const ambiente = status.cteDistribuicaoAmbiente;
    const ok = await confirm({
      title: novoEstado
        ? `Ativar CT-e Distribuição em ${ambiente}?`
        : 'Desativar CT-e Distribuição?',
      description: novoEstado
        ? ambiente === 'PRODUCAO'
          ? 'Scheduler começará a varrer SEFAZ-PROD a cada 15min consultando NSUs por filial. Confirme que cert A1 e contrato fiscal estão alinhados antes de ativar em PROD.'
          : 'Scheduler começará a varrer SEFAZ-HOM. Útil pra validar fluxo antes de PROD.'
        : 'Scheduler ficará silencioso (não toca SEFAZ). Sincronização de filiais e enriquecimento continuam funcionando (DB-only).',
      variant: novoEstado && ambiente === 'PRODUCAO' ? 'warning' : 'info',
      confirmLabel: novoEstado ? `Ativar (${ambiente})` : 'Desativar',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.put('/ambiente/cte-distribuicao/ativo', { ativo: novoEstado });
      toast.success(novoEstado ? 'CT-e Distribuição ATIVADO' : 'CT-e Distribuição DESATIVADO');
      load();
    } catch (err) {
      toast.error('Falha ao alterar', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }

  async function handleToggleAmbiente() {
    if (!status) return;
    const novo: 'PRODUCAO' | 'HOMOLOGACAO' =
      status.cteDistribuicaoAmbiente === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO';
    const ok = await confirm({
      title: `Trocar ambiente CT-e para ${novo}?`,
      description:
        novo === 'PRODUCAO'
          ? 'CT-e passará a varrer SEFAZ-PROD. Cert A1 deve ser válido pra PROD. Atenção: ambiente do CT-e é independente do global (NF-e continua no que está).'
          : 'CT-e passará a varrer SEFAZ-HOM. Útil pra implantação ou troubleshoot — NF-e/Cadastro não são afetados.',
      variant: 'warning',
      confirmLabel: `Trocar para ${novo}`,
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.put('/ambiente/cte-distribuicao/ambiente', { ambiente: novo });
      toast.success(`Ambiente CT-e alterado para ${novo}`);
      load();
    } catch (err) {
      toast.error('Falha ao trocar ambiente', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }

  async function handleSincronizarFiliais() {
    setActing(true);
    try {
      const r = await fiscalApi.post<{
        cnpjsCacheados: number;
        cursoresCriados: number;
        cursoresReativados: number;
        cursoresInativados: number;
      }>('/cte/distribuicao/recarregar-cnpjs-capul');
      const { cnpjsCacheados, cursoresCriados, cursoresReativados, cursoresInativados } = r.data;
      toast.success(
        'Sincronização concluída',
        `${cnpjsCacheados} CNPJs em cache · ${cursoresCriados} novos · ${cursoresReativados} reativados · ${cursoresInativados} inativados`,
      );
    } catch (err) {
      toast.error('Falha ao sincronizar filiais', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }

  async function handleToggleProtheusGrava() {
    if (!status) return;
    const novoEstado = !status.cteProtheusGravaAtivo;
    const ok = await confirm({
      title: novoEstado
        ? 'Ativar gravação automática no Protheus?'
        : 'Desativar gravação automática no Protheus?',
      description: novoEstado
        ? 'A cada execução do enriquecimento (cron hh:30 ou botão), CT-es procCTe/procCTeSimp já enriquecidos serão gravados em SZR010+SZQ010 do Protheus via grvXML. É best-effort — falhas de gravação não param o cron, mas podem deixar CT-es marcados FALHA_TECNICA pra retry. Confirme só após validar tela e fluxo em HOM.'
        : 'CT-es novos param de ser gravados no Protheus pelo enriquecimento. Os já gravados permanecem (idempotente). Schedulers de varredura e enriquecimento continuam.',
      variant: novoEstado ? 'warning' : 'info',
      confirmLabel: novoEstado ? 'Ativar gravação' : 'Desativar',
    });
    if (!ok) return;
    setActing(true);
    try {
      await fiscalApi.put('/ambiente/cte-distribuicao/protheus-grava', { ativo: novoEstado });
      toast.success(
        novoEstado
          ? 'Gravação Protheus ATIVADA'
          : 'Gravação Protheus DESATIVADA',
      );
      load();
    } catch (err) {
      toast.error('Falha ao alterar', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }

  async function handleEnriquecer() {
    setActing(true);
    try {
      const r = await fiscalApi.post<{
        varridos: number;
        enriquecidos: number;
        comAnomalia: number;
      }>('/cte/distribuicao/enriquecer');
      toast.success(
        'Enriquecimento concluído',
        `${r.data.varridos} varridos · ${r.data.enriquecidos} atualizados${
          r.data.comAnomalia > 0 ? ` · ${r.data.comAnomalia} anomalias` : ''
        }`,
      );
    } catch (err) {
      toast.error('Falha ao enriquecer', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }


  /**
   * Repassa os metadados dos documentos que estao com `chave = NULL`.
   *
   * Chave/modelo/dhEmi sao extraidos NA INGESTAO, uma vez — entao corrigir o
   * parser vale para o PROXIMO documento: o que entrou torto ANTES do deploy
   * continua torto ate este repasse. Foi o caso do CT-e Simplificado da
   * Distribuidora Carvalho (1950 em 19/08 e 1989 em 24/08): XML integro na
   * base, `chave` nula, invisivel para a busca da tela.
   *
   * Nao consulta SEFAZ — trabalha so sobre o XML ja guardado (deliberado: o
   * certificado da CAPUL ja levou um 656). Idempotente.
   */
  async function handleReprocessarMetadados() {
    setActing(true);
    try {
      const r = await fiscalApi.post<ReprocessoResultado>(
        '/cte/distribuicao/reprocessar-metadados?limite=500',
      );
      const { examinados, corrigidos, aindaSemChave } = r.data;
      setReprocesso(r.data);
      if (examinados === 0) {
        toast.info('Nada a reprocessar', 'Nenhum documento com chave em branco.');
      } else if (aindaSemChave.length === 0) {
        toast.success(
          'Reprocessamento concluído',
          `${corrigidos} de ${examinados} documento(s) ganharam chave.`,
        );
      } else {
        // Resistente nao e sucesso parcial silencioso: e variante que o parser
        // ainda nao le. Avisa em amarelo e deixa a lista na tela.
        toast.warning(
          `${aindaSemChave.length} documento(s) seguem sem chave`,
          `${corrigidos} corrigido(s) de ${examinados}. Veja a lista abaixo do botão.`,
        );
      }
    } catch (err) {
      toast.error('Falha ao reprocessar metadados', extractApiError(err) ?? undefined);
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="text-slate-500">Carregando…</div>;
  if (!status) return <div className="text-red-600">Falha ao carregar configuração CT-e.</div>;

  const ativo = status.cteDistribuicaoAtivo;
  const ambiente = status.cteDistribuicaoAmbiente;
  const protheusGrava = status.cteProtheusGravaAtivo;

  return (
    <>
      {/* Card 1 — Status global ATIVO/INATIVO */}
      <div
        className={`mb-6 rounded-lg border p-5 ${
          ativo ? 'border-emerald-200 bg-emerald-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
              ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {ativo ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <h3 className={`text-sm font-semibold ${ativo ? 'text-emerald-900' : 'text-slate-700'}`}>
              {ativo ? 'CT-e Distribuição ATIVO' : 'CT-e Distribuição INATIVO'}
            </h3>
            <p className={`mt-1 text-xs ${ativo ? 'text-emerald-800' : 'text-slate-600'}`}>
              {ativo
                ? `Scheduler @Cron varre SEFAZ a cada 15min. Filiais Capul ativas serão consultadas conforme adaptive backoff (60min synced / 15min com trabalho).`
                : 'Scheduler silencioso — não toca SEFAZ. Sincronização de filiais e enriquecimento continuam (DB-only, OK).'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Badge variant={ativo ? 'green' : 'gray'}>{ativo ? 'ATIVO' : 'INATIVO'}</Badge>
              <Badge variant={ambiente === 'PRODUCAO' ? 'red' : 'yellow'}>
                Ambiente SEFAZ: {ambiente}
              </Badge>
              {isAdmin && (
                <>
                  <Button
                    variant={ativo ? 'danger' : 'primary'}
                    size="sm"
                    onClick={handleToggleAtivo}
                    loading={acting}
                  >
                    {ativo ? 'Desativar' : `Ativar em ${ambiente}`}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card 2 — Ambiente CT-e (PROD/HOM independente) */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="h-4 w-4 text-slate-500" />
              Ambiente SEFAZ do CT-e
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={ambiente === 'PRODUCAO' ? 'red' : 'yellow'}>{ambiente}</Badge>
              <span className="text-xs text-slate-500">
                (global NF-e: {status.ambienteAtivo})
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-600 max-w-2xl">
              <strong>Independente do ambiente global.</strong> Permite cenário "CT-e em HOM
              enquanto NF-e roda PROD" durante implantação ou troubleshoot. Cada serviço pode
              ter seu próprio ambiente. Usar mesmo ambiente do global é o caso normal em rotina.
            </p>
          </div>
          {isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleAmbiente}
              loading={acting}
            >
              Trocar para {ambiente === 'PRODUCAO' ? 'HOMOLOGACAO' : 'PRODUCAO'}
            </Button>
          )}
        </div>
      </div>

      {/* Card 3 — Gravação automática no Protheus (SZR010+SZQ010) */}
      <div
        className={`mb-6 rounded-lg border p-5 ${
          protheusGrava ? 'border-emerald-200 bg-emerald-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${
              protheusGrava ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            <Database className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3
              className={`text-sm font-semibold ${
                protheusGrava ? 'text-emerald-900' : 'text-slate-700'
              }`}
            >
              Gravação automática no Protheus (SZR010 + SZQ010)
            </h3>
            <p className={`mt-1 text-xs ${protheusGrava ? 'text-emerald-800' : 'text-slate-600'}`}>
              {protheusGrava
                ? 'CT-es procCTe/procCTeSimp enriquecidos são gravados automaticamente no Protheus via grvXML após cada execução do enriquecimento. Best-effort — falhas marcam protheus_status=FALHA_TECNICA pra retry no próximo ciclo.'
                : 'CT-es novos NÃO são gravados no Protheus pelo enriquecimento — apenas persistidos em fiscal.cte_documento. Setor fiscal vê na tela /fiscal/cte mas Protheus não recebe. Ative quando fluxo estiver validado.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Badge variant={protheusGrava ? 'green' : 'gray'}>
                {protheusGrava ? 'GRAVANDO' : 'NÃO GRAVA'}
              </Badge>
              {isAdmin && (
                <Button
                  variant={protheusGrava ? 'danger' : 'primary'}
                  size="sm"
                  onClick={handleToggleProtheusGrava}
                  loading={acting}
                >
                  {protheusGrava ? 'Desativar gravação' : 'Ativar gravação Protheus'}
                </Button>
              )}
            </div>
            {status.cteProtheusGravaAlteradoEm && (
              <p className="mt-3 text-xs text-slate-500">
                Última alteração:{' '}
                {new Date(status.cteProtheusGravaAlteradoEm).toLocaleString('pt-BR')}
                {status.cteProtheusGravaAlteradoPor &&
                  ` por ${status.cteProtheusGravaAlteradoPor}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card 4 — Ações de manutenção. ADMIN_TI, não GESTOR_FISCAL: as TRÊS
          rotas daqui são @RoleMinima('ADMIN_TI'). Enquanto o card era gateado
          por GESTOR_FISCAL, o gestor via os botões e tomava 403 ao clicar —
          botão visível que nega é pior que botão ausente. (31/08) */}
      {isAdmin && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Manutenção</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded border border-slate-200 p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={14} className="text-slate-500" />
                <span className="text-sm font-medium">Sincronizar filiais</span>
              </div>
              <p className="text-xs text-slate-500 flex-1 mb-2">
                Atualiza cache de CNPJs Capul + cursores em <code>cte_controle_nsu</code> com
                filiais ativas em <code>core.filiais</code>. Roda automático a cada 15min;
                aqui força execução imediata após cadastro de filial nova.
              </p>
              <span title="Lê core.filiais (status=ATIVO) e: (1) atualiza cache do PapelDetector com os 35 CNPJs Capul; (2) cria cursor em cte_controle_nsu para filiais novas; (3) reativa cursor de filiais que voltaram a ATIVO; (4) desativa cursor de filiais inativadas. NÃO consulta SEFAZ — apenas DB. Use após cadastrar/inativar filial no Configurador para aplicar imediatamente sem esperar 15min do scheduler.">
                <Button variant="ghost" size="sm" onClick={handleSincronizarFiliais} loading={acting}>
                  Forçar sync
                </Button>
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-slate-500" />
                <span className="text-sm font-medium">Enriquecer pendentes</span>
              </div>
              <p className="text-xs text-slate-500 flex-1 mb-2">
                Varre <code>cte_documento</code> com <code>processado_em IS NULL</code>,
                aplica PapelDetector e popula <code>papel_capul</code>. Cron de 1h (hh:30)
                roda automático; aqui força execução imediata.
              </p>
              <span title="Aplica PapelDetector em CT-es ainda não classificados (papel_capul = NULL) e preenche TOMA/DEST/REM/EXPED/RECEB/AUTXML/TERCEIRO. NÃO consulta SEFAZ — apenas processa XMLs já recebidos. Idempotente: registros já processados são pulados. Use após cadastrar filial nova (junto com Forçar sync) para reprocessar histórico, ou para aparecer categorização imediata em vez de esperar até hh:30.">
                <Button variant="ghost" size="sm" onClick={handleEnriquecer} loading={acting}>
                  Forçar enriquecimento
                </Button>
              </span>
            </div>
            <div className="rounded border border-slate-200 p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <KeyRound size={14} className="text-slate-500" />
                <span className="text-sm font-medium">Reprocessar metadados</span>
              </div>
              <p className="text-xs text-slate-500 flex-1 mb-2">
                Reextrai <code>chave</code>/<code>modelo</code>/<code>dhEmi</code> do XML já
                guardado dos documentos com <code>chave IS NULL</code> — os que entraram
                antes de uma correção de parser e ficaram <strong>invisíveis</strong> na busca.
                Rodar após todo deploy que mexa no parser.
              </p>
              <span title="Varre cte_documento com chave IS NULL (ate 500 por execucao) e reextrai os metadados do XML ja guardado. NAO consulta SEFAZ — deliberado, o certificado da CAPUL ja levou um 656. Idempotente: a 2a execucao processa zero. Necessario porque a chave e extraida na INGESTAO, uma vez: documento gravado antes da correcao do parser continua sem chave ate este repasse.">
                <Button variant="ghost" size="sm" onClick={handleReprocessarMetadados} loading={acting}>
                  Reprocessar metadados
                </Button>
              </span>
              {reprocesso && (
                <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                  <p className="text-slate-600">
                    {reprocesso.examinados} examinado(s) ·{' '}
                    <strong className="text-emerald-700">{reprocesso.corrigidos} corrigido(s)</strong>
                    {reprocesso.aindaSemChave.length > 0 && (
                      <>
                        {' '}·{' '}
                        <strong className="text-amber-700">
                          {reprocesso.aindaSemChave.length} sem chave
                        </strong>
                      </>
                    )}
                  </p>
                  {reprocesso.aindaSemChave.length > 0 && (
                    <>
                      <p className="mt-1 text-slate-500">
                        Variante que o parser ainda não lê — o motivo diz qual raiz o XML traz:
                      </p>
                      <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                        {reprocesso.aindaSemChave.map((d) => (
                          <li key={d.id} className="text-slate-600">
                            <code>#{d.id}</code> <span className="text-slate-400">{d.schema}</span> — {d.motivo}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Pra re-tentar gravacao Protheus em batch (FALHA_TECNICA / PROTHEUS_DESISTIU),
            usar <strong>/fiscal/cte</strong> com filtros de data + status (botao habilitado
            quando criterio temporal preenchido).
          </p>
        </div>
      )}

      {/* Card 4 — Auditoria */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        <h4 className="mb-2 text-xs font-semibold text-slate-700">Auditoria</h4>
        <p>
          Última alteração CT-e:{' '}
          {status.cteDistribuicaoAlteradoEm
            ? new Date(status.cteDistribuicaoAlteradoEm).toLocaleString('pt-BR')
            : '—'}
          {status.cteDistribuicaoAlteradoPor && ` por ${status.cteDistribuicaoAlteradoPor}`}
        </p>
        <p className="mt-1 text-slate-500">
          Histórico completo de execuções em <code>fiscal.cte_lote_consulta</code> (audit
          via SQL ou tela futura).
        </p>
      </div>
    </>
  );
}
