import { useState, useRef } from 'react';
import { Header } from '../layouts/Header';
import { importService } from '../services/import.service';
import type { ImportResult } from '../services/import.service';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

type Step = 'upload' | 'preview' | 'result';

export function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [tableName, setTableName] = useState('SB1010');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setStep('preview');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      setStep('preview');
    }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const res = await importService.importarArquivo(file, tableName);
      setResult(res);
      setStep('result');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar.';
      setResult({
        success_count: 0,
        error_count: 1,
        errors: [{ line_number: 0, message: msg }],
        total_processed: 0,
      });
      setStep('result');
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep('upload');
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <>
      <Header title="Importacao de Dados" />
      <div className="p-6">
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { key: 'upload', label: '1. Upload' },
            { key: 'preview', label: '2. Preview' },
            { key: 'result', label: '3. Resultado' },
          ].map((s, idx) => (
            <div key={s.key} className="flex items-center gap-2">
              {idx > 0 && <div className="w-8 h-px bg-slate-300" />}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                step === s.key
                  ? 'bg-capul-600 text-white font-medium'
                  : step === 'result' && s.key !== 'result'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Selecionar Arquivo</h3>

              {/* Table type selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de dados</label>
                <select
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-capul-500"
                >
                  <option value="SB1010">Produtos (SB1)</option>
                  <option value="SB2010">Saldos de Estoque (SB2)</option>
                  <option value="SB8010">Lotes (SB8)</option>
                  <option value="SBZ010">Localizacoes (SBZ)</option>
                  <option value="SLK010">Codigos de Barras (SLK)</option>
                </select>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-capul-400 hover:bg-capul-50/30 transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-600 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-xs text-slate-400 mt-1">Formatos aceitos: CSV, Excel (.xlsx, .xls)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && file && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-800 mb-4">Preview do Arquivo</h3>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg mb-4">
                <FileSpreadsheet className="w-8 h-8 text-capul-600" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB — Tipo: {tableName}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>O arquivo sera importado para a tabela <strong>{tableName}</strong>. Registros existentes serao atualizados.</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700 disabled:opacity-50"
                >
                  {importing ? (
                    <>Importando...</>
                  ) : (
                    <>
                      Importar
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && result && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-center mb-6">
                {result.success_count > 0 ? (
                  <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                )}
                <h3 className="font-semibold text-slate-800">
                  {result.success_count > 0 ? 'Importacao Concluida' : 'Erro na Importacao'}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{result.success_count}</p>
                  <p className="text-xs text-green-700">Importados</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{result.error_count}</p>
                  <p className="text-xs text-red-700">Erros</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">Erros encontrados:</p>
                  <div className="max-h-40 overflow-auto bg-slate-50 rounded-lg p-3 space-y-1">
                    {result.errors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-xs text-red-600">
                        {err.line_number > 0 ? `Linha ${err.line_number}: ` : ''}{err.message}
                      </p>
                    ))}
                    {result.errors.length > 20 && (
                      <p className="text-xs text-slate-500">... e mais {result.errors.length - 20} erros</p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700"
              >
                <RotateCcw className="w-4 h-4" />
                Nova Importacao
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
