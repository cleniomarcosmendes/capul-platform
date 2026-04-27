import { useEffect, useState } from 'react';
import { backupService } from '../../services/backup.service';
import type { BackupExecucao, BackupStatus, DrConfig, TestResult } from '../../services/backup.service';

const statusCores: Record<string, string> = {
  SUCESSO: 'bg-green-100 text-green-700',
  FALHA: 'bg-red-100 text-red-700',
  EM_ANDAMENTO: 'bg-amber-100 text-amber-700',
};

function formatBytes(bytes: string | null): string {
  if (!bytes) return '—';
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function formatDuracao(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}min ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatData(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR');
}

function formatDataCurta(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function BackupDrPage() {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [execucoes, setExecucoes] = useState<BackupExecucao[]>([]);
  const [config, setConfig] = useState<DrConfig | null>(null);
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [draft, setDraft] = useState<Partial<DrConfig>>({});
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, TestResult | 'loading'>>({});

  useEffect(() => {
    Promise.all([
      backupService.status(),
      backupService.listar(50),
      backupService.getConfig(),
    ])
      .then(([s, e, c]) => {
        setStatus(s);
        setExecucoes(e);
        setConfig(c);
        setDraft(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function startEdit() {
    setDraft(config ?? {});
    setEditingConfig(true);
  }

  function cancelEdit() {
    setDraft(config ?? {});
    setEditingConfig(false);
  }

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const updated = await backupService.updateConfig(draft);
      setConfig(updated);
      setDraft(updated);
      setEditingConfig(false);
    } catch (err) {
      console.error(err);
    }
    setSavingConfig(false);
  }

  async function runTest(key: string, fn: () => Promise<TestResult>) {
    setTestResults((prev) => ({ ...prev, [key]: 'loading' }));
    try {
      const result = await fn();
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          ok: false,
          message: err?.response?.data?.message || 'Erro ao executar teste',
          detail: err?.message,
        },
      }));
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Backup & Disaster Recovery</h1>
        <p className="text-sm text-slate-500 mt-1">
          Visibilidade das execuções de backup, política de retenção, objetivos RTO/RPO e procedimento de restore.
          A operação propriamente dita roda em <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">scripts/backup.sh</code> agendado por systemd timer no host.
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400">Carregando...</p>
      ) : (
        <>
          {/* Cards de status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Último backup com sucesso</p>
              {status?.ultimoSucesso ? (
                <>
                  <p className="text-lg font-semibold text-slate-800">{formatData(status.ultimoSucesso.iniciadoEm)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {status.ultimoSucesso.tipo} · {formatBytes(status.ultimoSucesso.tamanhoBytes)} · {formatDuracao(status.ultimoSucesso.duracaoMs)}
                  </p>
                </>
              ) : (
                <p className="text-amber-700 text-sm">⚠️ Nenhum backup com sucesso registrado</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Última falha</p>
              {status?.ultimaFalha ? (
                <>
                  <p className="text-lg font-semibold text-red-700">{formatData(status.ultimaFalha.iniciadoEm)}</p>
                  <p className="text-xs text-slate-500 mt-1 truncate">{status.ultimaFalha.mensagem || '—'}</p>
                </>
              ) : (
                <p className="text-green-700 text-sm">✅ Sem falhas registradas</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Últimos 7 dias</p>
              <div className="flex gap-4 mt-1">
                <div>
                  <p className="text-2xl font-bold text-green-600">{status?.contagem7d.SUCESSO ?? 0}</p>
                  <p className="text-xs text-slate-500">sucesso</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{status?.contagem7d.FALHA ?? 0}</p>
                  <p className="text-xs text-slate-500">falha</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de configuração DR (RTO/RPO + retenção + alertas + destino) */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700">Objetivos & Política DR</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  RTO (Recovery Time) e RPO (Recovery Point) — metas formais aprovadas pela Diretoria. Política de retenção, destino off-site, alertas.
                </p>
              </div>
              {!editingConfig ? (
                <button onClick={startEdit} className="text-sm text-capul-600 hover:underline">
                  Editar
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="text-sm text-slate-500 hover:underline">
                    Cancelar
                  </button>
                  <button
                    onClick={saveConfig}
                    disabled={savingConfig}
                    className="text-sm bg-capul-600 text-white px-3 py-1 rounded hover:bg-capul-700 disabled:opacity-50"
                  >
                    {savingConfig ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
              <Field
                label="RTO (horas)"
                hint="Tempo máximo aceitável fora do ar"
                value={draft.rtoHoras}
                editing={editingConfig}
                type="number"
                onChange={(v) => setDraft({ ...draft, rtoHoras: v === '' ? null : Number(v) })}
                display={config?.rtoHoras != null ? `${config.rtoHoras}h` : '—'}
              />
              <Field
                label="RPO (horas)"
                hint="Quanto dado podemos perder no pior caso"
                value={draft.rpoHoras}
                editing={editingConfig}
                type="number"
                onChange={(v) => setDraft({ ...draft, rpoHoras: v === '' ? null : Number(v) })}
                display={config?.rpoHoras != null ? `${config.rpoHoras}h` : '—'}
              />
              <Field
                label="Próxima revisão"
                hint="Recomendado a cada 6 meses"
                value={draft.proximaRevisao?.split('T')[0]}
                editing={editingConfig}
                type="date"
                onChange={(v) => setDraft({ ...draft, proximaRevisao: v ? new Date(v).toISOString() : null })}
                display={formatDataCurta(config?.proximaRevisao ?? null)}
              />

              <Field
                label="Aprovado por"
                value={draft.aprovadoPor ?? ''}
                editing={editingConfig}
                onChange={(v) => setDraft({ ...draft, aprovadoPor: v || null })}
                display={config?.aprovadoPor ?? '—'}
              />
              <Field
                label="Aprovado em"
                value={draft.aprovadoEm?.split('T')[0]}
                editing={editingConfig}
                type="date"
                onChange={(v) => setDraft({ ...draft, aprovadoEm: v ? new Date(v).toISOString() : null })}
                display={formatDataCurta(config?.aprovadoEm ?? null)}
              />
              <div /> {/* gap */}

              <Field
                label="Retenção diários (dias)"
                value={draft.retencaoDiarios}
                editing={editingConfig}
                type="number"
                onChange={(v) => setDraft({ ...draft, retencaoDiarios: v === '' ? null : Number(v) })}
                display={config?.retencaoDiarios != null ? `${config.retencaoDiarios}d` : '—'}
              />
              <Field
                label="Retenção semanais (semanas)"
                value={draft.retencaoSemanas}
                editing={editingConfig}
                type="number"
                onChange={(v) => setDraft({ ...draft, retencaoSemanas: v === '' ? null : Number(v) })}
                display={config?.retencaoSemanas != null ? `${config.retencaoSemanas} sem` : '—'}
              />
              <Field
                label="Retenção mensais (meses)"
                value={draft.retencaoMeses}
                editing={editingConfig}
                type="number"
                onChange={(v) => setDraft({ ...draft, retencaoMeses: v === '' ? null : Number(v) })}
                display={config?.retencaoMeses != null ? `${config.retencaoMeses} mes` : '—'}
              />

              <Field
                label="Destino off-site"
                hint="Bucket S3 / URL Backblaze / etc."
                value={draft.destinoOffsite ?? ''}
                editing={editingConfig}
                onChange={(v) => setDraft({ ...draft, destinoOffsite: v || null })}
                display={config?.destinoOffsite ?? '—'}
              />
              <Field
                label="E-mail alerta"
                value={draft.emailAlerta ?? ''}
                editing={editingConfig}
                onChange={(v) => setDraft({ ...draft, emailAlerta: v || null })}
                display={config?.emailAlerta ?? '—'}
              />
              <Field
                label="Webhook alerta (Slack/Teams)"
                value={draft.webhookAlerta ?? ''}
                editing={editingConfig}
                onChange={(v) => setDraft({ ...draft, webhookAlerta: v || null })}
                display={config?.webhookAlerta ?? '—'}
              />

              <Field
                label="Agendamento (cron)"
                hint="Exibido pra referência. Configurado em scripts/systemd/."
                value={draft.agendamentoCron ?? ''}
                editing={editingConfig}
                onChange={(v) => setDraft({ ...draft, agendamentoCron: v || null })}
                display={config?.agendamentoCron ?? '—'}
              />
            </div>
          </div>

          {/* Card de Testes & Operações */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-700">Testes & Operações</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Valide as integrações configuradas. Operações que precisam executar no host (backup/DR test) geram comando pra copiar e rodar via SSH.
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Webhook */}
              <TestRow
                title="Testar webhook (Slack/Teams/Discord)"
                hint="Envia mensagem de teste pra URL configurada acima"
                buttonLabel="Testar"
                onClick={() => runTest('webhook', () => backupService.testWebhook())}
                result={testResults.webhook}
              />

              {/* E-mail */}
              <TestRow
                title="Testar e-mail de alerta"
                hint="Envia e-mail de teste pra endereço configurado"
                buttonLabel="Testar"
                onClick={() => runTest('email', () => backupService.testEmail())}
                result={testResults.email}
              />

              {/* S3 */}
              <TestRow
                title="Testar destino off-site (S3)"
                hint="Lista o bucket configurado pra confirmar credentials/permissão"
                buttonLabel="Testar"
                onClick={() => runTest('s3', () => backupService.testS3())}
                result={testResults.s3}
              />

              {/* Operação que requer SSH */}
              <TestRow
                title="Executar backup completo agora"
                hint="Operação requer SSH no servidor (segurança). Botão gera o comando."
                buttonLabel="Gerar comando"
                onClick={() => runTest('exec', () => backupService.comandoExecutarBackup())}
                result={testResults.exec}
                onCopy={copyToClipboard}
              />

              <TestRow
                title="Validar restore (DR test)"
                hint="Restaura backup mais recente em banco temporário, sem tocar PROD. Requer SSH."
                buttonLabel="Gerar comando"
                onClick={() => runTest('drtest', () => backupService.comandoDrTest())}
                result={testResults.drtest}
                onCopy={copyToClipboard}
              />
            </div>
          </div>

          {/* Orientação inline */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-slate-700 space-y-2">
            <p className="font-semibold text-slate-800">ℹ️ O que é coberto</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Banco PostgreSQL completo (todos os schemas)</li>
              <li><code className="bg-white px-1 rounded text-xs">.env</code> (cifrado) — JWT_SECRET, FISCAL_MASTER_KEY, DB_PASSWORD</li>
              <li>Certificado A1 fiscal (cifrado) — <code className="bg-white px-1 rounded text-xs">.pfx</code> + senha</li>
              <li>Redis (cifrado) — sessões, BullMQ, circuit breakers SEFAZ</li>
              <li>Uploads (anexos chamados/projetos)</li>
              <li>Código fonte da aplicação</li>
            </ul>
            <p className="font-semibold text-slate-800 mt-3">🛠️ Como ajustar</p>
            <p>
              Os valores do card "Objetivos & Política DR" acima são editáveis. A operação efetiva (frequência do timer, sync S3, alertas) lê essas configs no host —
              ver <code className="bg-white px-1 rounded text-xs">docs/DEPLOY_BACKUP_DR_DOUGLAS.md</code> para configurar em produção.
            </p>
          </div>

          {/* Histórico */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-700">Histórico ({execucoes.length})</h2>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-capul-600 hover:underline"
              >
                Atualizar
              </button>
            </div>
            {execucoes.length === 0 ? (
              <p className="px-6 py-8 text-center text-slate-400 text-sm">
                Nenhuma execução registrada ainda. Quando o script <code>scripts/backup.sh</code> rodar (manual ou via timer), aparece aqui.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Início</th>
                      <th className="px-4 py-2.5 text-left">Tipo</th>
                      <th className="px-4 py-2.5 text-left">Status</th>
                      <th className="px-4 py-2.5 text-right">Tamanho</th>
                      <th className="px-4 py-2.5 text-right">Duração</th>
                      <th className="px-4 py-2.5 text-left">Host</th>
                      <th className="px-4 py-2.5 text-left">Destino</th>
                      <th className="px-4 py-2.5 text-center">Cifrado</th>
                      <th className="px-4 py-2.5 text-left">Mensagem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {execucoes.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-700">{formatData(e.iniciadoEm)}</td>
                        <td className="px-4 py-2 text-slate-600">{e.tipo}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCores[e.status] || 'bg-slate-100 text-slate-700'}`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatBytes(e.tamanhoBytes)}</td>
                        <td className="px-4 py-2 text-right text-slate-600">{formatDuracao(e.duracaoMs)}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{e.hostname || '—'}</td>
                        <td className="px-4 py-2 text-slate-500 text-xs">{e.destino || '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {e.cifrado ? (
                            <span className="text-green-600">🔒</span>
                          ) : (
                            <span className="text-amber-500">🔓</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-xs max-w-md truncate" title={e.mensagem || undefined}>
                          {e.mensagem || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  value: string | number | null | undefined;
  display: string;
  editing: boolean;
  type?: 'text' | 'number' | 'date';
  onChange: (v: string) => void;
}

function Field({ label, hint, value, display, editing, type = 'text', onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {editing ? (
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
      ) : (
        <p className="text-sm text-slate-800 font-medium">{display}</p>
      )}
      {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

interface TestRowProps {
  title: string;
  hint: string;
  buttonLabel: string;
  onClick: () => void;
  result: TestResult | 'loading' | undefined;
  onCopy?: (text: string) => void;
}

function TestRow({ title, hint, buttonLabel, onClick, result, onCopy }: TestRowProps) {
  const isLoading = result === 'loading';
  const r = !isLoading ? (result as TestResult | undefined) : undefined;

  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
        </div>
        <button
          onClick={onClick}
          disabled={isLoading}
          className="text-sm bg-capul-600 text-white px-3 py-1.5 rounded hover:bg-capul-700 disabled:opacity-50 whitespace-nowrap"
        >
          {isLoading ? 'Executando...' : buttonLabel}
        </button>
      </div>

      {r && (
        <div
          className={`mt-3 p-3 rounded text-sm ${
            r.ok ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'
          }`}
        >
          <p className="font-medium">{r.ok ? '✅ ' : '⚠️ '}{r.message}</p>
          {r.detail && (
            <div className="mt-2">
              <pre className="text-xs bg-slate-900 text-slate-100 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                {r.detail}
              </pre>
              {onCopy && (
                <button
                  onClick={() => onCopy(r.detail || '')}
                  className="text-xs mt-1 text-slate-500 hover:text-slate-700 underline"
                >
                  Copiar comando
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
