import { useState } from 'react';
import { Header } from '../../layouts/Header';
import { importService } from '../../services/import.service';
import type { PreviewResult, ExecutarResult } from '../../services/import.service';
import { Upload, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';

type Step = 'upload' | 'preview' | 'resultado';

const entidades = [
  { value: 'ativos', label: 'Ativos de TI' },
  { value: 'softwares', label: 'Softwares' },
];

export function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [entidade, setEntidade] = useState('ativos');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [resultado, setResultado] = useState<ExecutarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const result = await importService.preview(entidade, file);
      setPreview(result);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message || 'Erro ao processar arquivo'
        : 'Erro ao processar arquivo';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecutar() {
    if (!preview) return;
    const linhasValidas = preview.linhas.filter((l) => l.valida).map((l) => l.dados);
    if (linhasValidas.length === 0) return;
    setLoading(true);
    try {
      const result = await importService.executar(entidade, linhasValidas);
      setResultado(result);
      setStep('resultado');
    } catch {
      setError('Erro ao executar importacao');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResultado(null);
    setError('');
  }

  return (
    <>
      <Header title="Importar Dados" />
      <div className="p-6 max-w-4xl">
        {/* Steps indicator */}
        <div className="flex items-center gap-3 mb-6">
          {['Upload', 'Preview', 'Resultado'].map((label, idx) => {
            const stepKeys: Step[] = ['upload', 'preview', 'resultado'];
            const isActive = stepKeys.indexOf(step) >= idx;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-capul-600 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {idx + 1}
                </div>
                <span className={`text-sm ${isActive ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{label}</span>
                {idx < 2 && <div className="w-8 h-px bg-slate-300" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Upload className="w-5 h-5 text-capul-500" />
              <h3 className="text-lg font-semibold text-slate-800">Selecionar Arquivo</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Entidade</label>
                <select
                  value={entidade}
                  onChange={(e) => setEntidade(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  {entidades.map((e) => (
                    <option key={e.value} value={e.value}>{e.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Arquivo .xlsx</label>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">
                      {file ? file.name : 'Clique para selecionar um arquivo .xlsx'}
                    </p>
                    {file && <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>}
                  </label>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-500">
                <p className="font-medium text-slate-600 mb-1">Colunas esperadas:</p>
                {entidade === 'ativos' && <p>tag*, nome*, tipo*, filialCodigo*, fabricante, modelo, so, ip, hostname</p>}
                {entidade === 'softwares' && <p>nome*, tipo*, fabricante, versao_atual</p>}
                <p className="mt-1 text-slate-400">* campos obrigatorios. Primeira linha = cabecalho.</p>
              </div>

              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-capul-700 transition-colors"
              >
                {loading ? 'Processando...' : 'Visualizar Preview'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && preview && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Preview da Importacao</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">Total: <strong>{preview.totalLinhas}</strong></span>
                <span className="text-green-600">Validas: <strong>{preview.validas}</strong></span>
                <span className="text-red-600">Invalidas: <strong>{preview.invalidas}</strong></span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-lg">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-600">Linha</th>
                    <th className="px-3 py-2 text-left text-slate-600">Status</th>
                    <th className="px-3 py-2 text-left text-slate-600">Dados</th>
                    <th className="px-3 py-2 text-left text-slate-600">Erros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.linhas.map((l) => (
                    <tr key={l.linha} className={l.valida ? '' : 'bg-red-50'}>
                      <td className="px-3 py-2 text-slate-600">{l.linha}</td>
                      <td className="px-3 py-2">
                        {l.valida
                          ? <CheckCircle className="w-4 h-4 text-green-500" />
                          : <XCircle className="w-4 h-4 text-red-500" />
                        }
                      </td>
                      <td className="px-3 py-2 text-slate-700 max-w-md truncate">
                        {Object.entries(l.dados).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                      </td>
                      <td className="px-3 py-2 text-red-600">
                        {l.erros.join('; ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mt-4">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleExecutar}
                disabled={preview.validas === 0 || loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
              >
                {loading ? 'Importando...' : `Importar ${preview.validas} registro(s)`}
              </button>
              <button
                onClick={handleReset}
                className="text-slate-500 hover:text-slate-700 text-sm"
              >
                Voltar
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Resultado */}
        {step === 'resultado' && resultado && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-lg font-semibold text-slate-800">Importacao Concluida</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{resultado.criados}</p>
                <p className="text-sm text-green-700">Registros criados</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{resultado.erros.length}</p>
                <p className="text-sm text-red-700">Erros</p>
              </div>
            </div>

            {resultado.erros.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="min-w-full text-xs">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-red-700">Linha</th>
                      <th className="px-3 py-2 text-left text-red-700">Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resultado.erros.map((e, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-600">{e.linha}</td>
                        <td className="px-3 py-2 text-red-600">{e.erro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              onClick={handleReset}
              className="bg-capul-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 transition-colors"
            >
              Nova Importacao
            </button>
          </div>
        )}
      </div>
    </>
  );
}
