import { useEffect, useState, type FormEvent } from 'react';
import { fiscalApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface CertificadoPublico {
  id: string;
  nomeArquivo: string;
  cnpj: string;
  cnpjMascarado: string;
  validoDe: string;
  validoAte: string;
  ativo: boolean;
  diasParaVencer: number;
  vencendoEmMenosDe60Dias: boolean;
  observacoes: string | null;
}

export function CertificadoFiscalPage() {
  const { configuradorRole } = useAuth();
  const isAdmin = configuradorRole === 'ADMIN';
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
      const msg = (err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem;
      setError(msg ?? 'Falha ao carregar certificados. Verifique se o Módulo Fiscal está rodando.');
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
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem;
      alert(msg ?? 'Falha ao ativar.');
    }
  }

  async function handleRemover(id: string) {
    if (!confirm('Remover este certificado? Esta ação não pode ser desfeita.')) return;
    try {
      await fiscalApi.delete(`/certificado/${id}`);
      load();
    } catch (err) {
      const msg = (err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem;
      alert(msg ?? 'Falha ao remover.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Certificado Digital A1</h2>
          <p className="text-xs text-slate-500">
            Gestão do certificado ICP-Brasil usado pelo Módulo Fiscal para acessar os web services SEFAZ via mTLS.
            Em produção, use um certificado dedicado (separado do Protheus emissão).
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Novo certificado
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-slate-500">Carregando…</div>
      ) : certs.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <svg className="mx-auto mb-3 h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="text-sm font-medium text-slate-900">Nenhum certificado cadastrado</div>
          <div className="mt-1 text-xs text-slate-500">
            O Módulo Fiscal precisa de um certificado A1 ativo para acessar o SEFAZ.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border p-5 shadow-sm ${
                c.ativo ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {c.ativo && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Ativo
                      </span>
                    )}
                    {c.vencendoEmMenosDe60Dias && c.diasParaVencer >= 0 && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Vencendo em {c.diasParaVencer} dia(s)
                      </span>
                    )}
                    {c.diasParaVencer < 0 && (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Expirado
                      </span>
                    )}
                  </div>

                  <div className="font-mono text-sm text-slate-900">{c.cnpjMascarado}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Arquivo: <code className="rounded bg-slate-100 px-1.5">{c.nomeArquivo}</code>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Validade:{' '}
                    {new Date(c.validoDe).toLocaleDateString('pt-BR')} –{' '}
                    <span className={c.vencendoEmMenosDe60Dias ? 'font-semibold text-amber-700' : ''}>
                      {new Date(c.validoAte).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {c.observacoes && (
                    <div className="mt-2 text-xs text-slate-600">{c.observacoes}</div>
                  )}
                </div>

                {isAdmin && !c.ativo && (
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleAtivar(c.id)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Ativar
                    </button>
                    <button
                      onClick={() => handleRemover(c.id)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} onUploaded={load} />}
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
      const msg = (err as { response?: { data?: { mensagem?: string } } }).response?.data?.mensagem;
      setError(msg ?? 'Falha no upload.');
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
            className="w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-emerald-700"
            required
          />
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Senha do .pfx</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500"
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500"
          />
        </label>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-emerald-300 transition-colors"
          >
            {loading ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  );
}
