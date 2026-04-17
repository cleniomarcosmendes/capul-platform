import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useAuth, hasMinRole } from '../contexts/AuthContext';
import { extractApiError } from '../utils/errors';
import type { CertificadoPublico } from '../types';

export function CertificadoAdminPage() {
  const { fiscalRole } = useAuth();
  const isAdmin = hasMinRole(fiscalRole, 'ADMIN_TI');
  const toast = useToast();
  const confirm = useConfirm();
  const [certs, setCerts] = useState<CertificadoPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const { data } = await fiscalApi.get<CertificadoPublico[]>('/certificado');
      setCerts(data);
    } catch (err) {
      setError(extractApiError(err, 'Falha ao carregar certificados.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAtivar(id: string) {
    try {
      await fiscalApi.post(`/certificado/${id}/ativar`);
      toast.success('Certificado ativado', 'O certificado está pronto para uso nas consultas SEFAZ.');
      load();
    } catch (err) {
      toast.error('Falha ao ativar certificado', extractApiError(err));
    }
  }

  async function handleRemover(id: string) {
    const ok = await confirm({
      title: 'Remover certificado?',
      description:
        'O arquivo .pfx será apagado permanentemente do servidor. Esta ação não pode ser desfeita.',
      variant: 'danger',
      confirmLabel: 'Remover',
    });
    if (!ok) return;
    try {
      await fiscalApi.delete(`/certificado/${id}`);
      toast.success('Certificado removido');
      load();
    } catch (err) {
      toast.error('Falha ao remover certificado', extractApiError(err));
    }
  }

  return (
    <PageWrapper title="Certificado A1">
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button leftIcon={<Upload className="h-4 w-4" />} onClick={() => setUploadOpen(true)}>
            Novo certificado
          </Button>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando…</div>
      ) : certs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <div className="text-sm font-medium text-slate-900">
            Nenhum certificado cadastrado
          </div>
          <div className="mt-1 text-xs text-slate-500">
            O Módulo Fiscal precisa de um certificado A1 ativo para acessar o SEFAZ.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c) => (
            <CertCard key={c.id} cert={c} isAdmin={isAdmin} onAtivar={handleAtivar} onRemover={handleRemover} />
          ))}
        </div>
      )}

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={load} />}
    </PageWrapper>
  );
}

function CertCard({
  cert,
  isAdmin,
  onAtivar,
  onRemover,
}: {
  cert: CertificadoPublico;
  isAdmin: boolean;
  onAtivar: (id: string) => void;
  onRemover: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-lg border p-5 shadow-sm ${
        cert.ativo ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {cert.ativo && (
              <Badge variant="green">
                <CheckCircle2 className="h-3 w-3" /> Ativo
              </Badge>
            )}
            {cert.vencendoEmMenosDe60Dias && (
              <Badge variant="yellow">
                Vencendo em {cert.diasParaVencer} dia(s)
              </Badge>
            )}
            {cert.diasParaVencer < 0 && <Badge variant="red">Expirado</Badge>}
          </div>

          <div className="font-mono text-sm text-slate-900">{cert.cnpjMascarado}</div>
          <div className="mt-1 text-xs text-slate-500">
            Arquivo: <code className="rounded bg-slate-100 px-1.5">{cert.nomeArquivo}</code>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Validade:{' '}
            {new Date(cert.validoDe).toLocaleDateString('pt-BR')} –{' '}
            <span className={cert.vencendoEmMenosDe60Dias ? 'font-semibold text-amber-700' : ''}>
              {new Date(cert.validoAte).toLocaleDateString('pt-BR')}
            </span>
          </div>
          {cert.observacoes && (
            <div className="mt-2 text-xs text-slate-600">{cert.observacoes}</div>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2">
            {!cert.ativo && (
              <Button size="sm" variant="secondary" onClick={() => onAtivar(cert.id)}>
                Ativar
              </Button>
            )}
            {!cert.ativo && (
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => onRemover(cert.id)}
              >
                Remover
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Selecione um arquivo .pfx');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('senha', senha);
      if (observacoes) fd.append('observacoes', observacoes);
      await fiscalApi.post('/certificado/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded();
      onClose();
    } catch (err) {
      setError(extractApiError(err, 'Falha no upload do certificado.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 className="mb-1 text-lg font-bold text-slate-900">Upload de certificado A1</h2>
        <p className="mb-4 text-xs text-slate-500">
          Arquivo .pfx/.p12 (até 100 KB). A senha é cifrada com AES-256-GCM antes de ser
          persistida. O certificado não é ativado automaticamente — ative depois via botão.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Arquivo</span>
          <input
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-slate-800"
            required
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Senha do .pfx</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
            required
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Observações</span>
          <input
            type="text"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Ex.: Certificado dedicado ao Módulo Fiscal — HOM"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:ring-slate-500"
          />
        </label>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
