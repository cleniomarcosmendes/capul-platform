import { useState, useEffect, useCallback } from 'react';
import { Header } from '../layouts/Header';
import { useAuth } from '../contexts/AuthContext';
import { importService } from '../services/import.service';
import type {
  HierarchySyncResult,
  ProductImportResult,
  SimpleWarehouse,
} from '../services/import.service';
import {
  RefreshCw,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Clock,
} from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Tab = 'hierarquia' | 'produtos';

const HIERARCHY_TABLES = [
  { key: 'SBM010', label: 'Grupos', desc: 'Grupos de produtos' },
  { key: 'SZD010', label: 'Categorias', desc: 'Categorias mercadologicas' },
  { key: 'SZE010', label: 'Subcategorias', desc: 'Subcategorias' },
  { key: 'SZF010', label: 'Segmentos', desc: 'Segmentos' },
  { key: 'SZB010', label: 'Armazens', desc: 'Armazens/localizacoes' },
];

const PRODUCT_TABLES = [
  { key: 'sb1', label: 'SB1010', desc: 'Produtos' },
  { key: 'sb2', label: 'SB2010', desc: 'Saldos por Armazem' },
  { key: 'sb8', label: 'SB8010', desc: 'Lotes' },
  { key: 'sbz', label: 'SBZ010', desc: 'Indicadores' },
  { key: 'slk', label: 'SLK010', desc: 'Codigos de Barras' },
];

export function ImportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('hierarquia');

  const tabs: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'hierarquia', label: 'Hierarquia Mercadologica', icon: Layers },
    { key: 'produtos', label: 'Importacao de Produtos', icon: Package },
  ];

  return (
    <>
      <Header title="Importacao Protheus" />
      <div className="p-4 md:p-6 space-y-4">
        {/* Tabs */}
        <div className="border-b border-slate-200">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-capul-600 text-capul-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'hierarquia' && <TabHierarquia />}
        {activeTab === 'produtos' && <TabProdutos />}
      </div>
    </>
  );
}

// === Tab Hierarquia ===

function TabHierarquia() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<HierarchySyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  async function doSync() {
    setSyncing(true);
    setResult(null);
    setError(null);
    try {
      const res = await importService.syncHierarchy();
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao sincronizar hierarquia.';
      setError(msg);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Card explicativo + botao */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">Hierarquia Mercadologica</h3>
            <p className="text-sm text-slate-500 mt-1">
              Sincroniza a estrutura de classificacao de produtos com o Protheus: grupos, categorias, subcategorias, segmentos e armazens.
            </p>
            <p className="text-xs text-slate-400 mt-1">Tabelas: SBM010, SZD010, SZE010, SZF010, SZB010</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-capul-600 text-white text-sm rounded-lg hover:bg-capul-700 disabled:opacity-50 shrink-0"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Sincronizar Hierarquia"
        description="Atualizar a estrutura de classificacao de produtos com o Protheus?"
        details={[
          'Grupos (SBM010)',
          'Categorias (SZD010)',
          'Subcategorias (SZE010)',
          'Segmentos (SZF010)',
          'Armazens (SZB010)',
        ]}
        variant="info"
        confirmLabel="Sincronizar"
        onConfirm={() => { setShowConfirm(false); doSync(); }}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-200 bg-green-50">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-800">Sincronizacao Concluida</span>
            <span className="text-xs text-green-600 ml-auto flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {result.duration_seconds?.toFixed(1)}s
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Tabela</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Descricao</th>
                <th className="text-center py-2.5 px-4 font-medium text-green-600">Inseridos</th>
                <th className="text-center py-2.5 px-4 font-medium text-blue-600">Atualizados</th>
                <th className="text-center py-2.5 px-4 font-medium text-red-600">Removidos</th>
                <th className="text-center py-2.5 px-4 font-medium text-slate-500">Inalterados</th>
              </tr>
            </thead>
            <tbody>
              {HIERARCHY_TABLES.map((t) => {
                const stats = result.tables?.[t.key];
                return (
                  <tr key={t.key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{t.key}</td>
                    <td className="py-2.5 px-4 text-slate-600">{t.desc}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge value={stats?.inserted ?? 0} color="green" />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge value={stats?.updated ?? 0} color="blue" />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge value={stats?.deleted ?? 0} color="red" />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge value={stats?.unchanged ?? 0} color="slate" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-medium">
                <td className="py-2.5 px-4 text-slate-700" colSpan={2}>Totais</td>
                <td className="py-2.5 px-4 text-center">
                  <Badge value={result.totals?.inserted ?? 0} color="green" />
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge value={result.totals?.updated ?? 0} color="blue" />
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge value={result.totals?.deleted ?? 0} color="red" />
                </td>
                <td className="py-2.5 px-4 text-center">
                  <Badge value={result.totals?.unchanged ?? 0} color="slate" />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Aviso */}
      <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>A sincronizacao da hierarquia deve ser feita <strong>antes</strong> da importacao de produtos, para que os armazens estejam atualizados.</span>
      </div>
    </div>
  );
}

// === Tab Produtos ===

function TabProdutos() {
  const { usuario } = useAuth();
  const filial = usuario?.filialAtual?.codigo ?? '';

  const [warehouses, setWarehouses] = useState<SimpleWarehouse[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ProductImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const list = await importService.getWarehouses();
      setWarehouses(list);
      // Selecionar todos por padrão
      setSelected(new Set(list.map((w) => w.code)));
    } catch {
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  function toggleWarehouse(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(warehouses.map((w) => w.code)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function invertSelection() {
    setSelected((prev) => {
      const next = new Set<string>();
      warehouses.forEach((w) => {
        if (!prev.has(w.code)) next.add(w.code);
      });
      return next;
    });
  }

  function handleImportClick() {
    if (!filial) {
      setError('Filial nao identificada. Faca login novamente.');
      return;
    }
    if (selected.size === 0) {
      setError('Selecione ao menos um armazem.');
      return;
    }
    setShowConfirm(true);
  }

  async function doImport() {
    const armazens = Array.from(selected).sort();
    setImporting(true);
    setResult(null);
    setError(null);
    try {
      const res = await importService.importProducts(filial, armazens);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar produtos.';
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Config card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-slate-800">Importacao de Produtos</h3>
          <p className="text-sm text-slate-500 mt-1">
            Importa produtos, saldos, lotes, indicadores e codigos de barras diretamente da API do Protheus.
          </p>
        </div>

        {/* Filial */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Filial</label>
          <input
            type="text"
            value={filial ? `${filial} - ${usuario?.filialAtual?.nome ?? ''}` : 'Nao identificada'}
            readOnly
            className="w-full max-w-xs border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 text-slate-600"
          />
        </div>

        {/* Armazens */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">
              Armazens ({selected.size}/{warehouses.length} selecionados)
            </label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-capul-600 hover:underline">Todos</button>
              <button onClick={invertSelection} className="text-xs text-capul-600 hover:underline">Inverter</button>
              <button onClick={selectNone} className="text-xs text-capul-600 hover:underline">Nenhum</button>
            </div>
          </div>

          {loadingWarehouses ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando armazens...
            </div>
          ) : warehouses.length === 0 ? (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Nenhum armazem encontrado. Sincronize a hierarquia primeiro.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {warehouses.map((w) => (
                <label
                  key={w.code}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                    selected.has(w.code)
                      ? 'border-capul-400 bg-capul-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(w.code)}
                    onChange={() => toggleWarehouse(w.code)}
                    className="rounded border-slate-300 text-capul-600 focus:ring-capul-500"
                  />
                  <span>
                    <strong className="font-mono">{w.code}</strong>
                    <span className="text-slate-500"> - {w.name}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Botao importar */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleImportClick}
            disabled={importing || selected.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-capul-600 text-white text-sm font-medium rounded-lg hover:bg-capul-700 disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Importando...' : 'Importar Agora'}
          </button>
          {importing && (
            <span className="text-xs text-slate-500">Este processo pode levar varios minutos. Nao feche esta pagina.</span>
          )}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Resultados */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className={`flex items-center gap-2 p-4 border-b border-slate-200 ${
            result.success ? 'bg-green-50' : 'bg-red-50'
          }`}>
            {result.success ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.message || (result.success ? 'Importacao Concluida' : 'Erro na Importacao')}
            </span>
            <span className="text-xs text-slate-500 ml-auto">
              {result.stats?.total_produtos?.toLocaleString('pt-BR')} produtos processados
            </span>
          </div>

          {result.armazens_processados?.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              Armazens processados: <strong>{result.armazens_processados.join(', ')}</strong>
              {result.armazens_com_erro?.length > 0 && (
                <span className="text-red-600 ml-3">
                  Com erro: {result.armazens_com_erro.join(', ')}
                </span>
              )}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Tabela</th>
                <th className="text-left py-2.5 px-4 font-medium text-slate-600">Descricao</th>
                <th className="text-center py-2.5 px-4 font-medium text-green-600">Inseridos</th>
                <th className="text-center py-2.5 px-4 font-medium text-blue-600">Atualizados</th>
                <th className="text-center py-2.5 px-4 font-medium text-red-600">Removidos</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCT_TABLES.map((t) => {
                const stats = result.stats;
                const ins = stats?.[`${t.key}_inserted` as keyof typeof stats] as number ?? 0;
                const upd = stats?.[`${t.key}_updated` as keyof typeof stats] as number ?? 0;
                const del = stats?.[`${t.key}_deleted` as keyof typeof stats] as number ?? 0;
                return (
                  <tr key={t.key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{t.label}</td>
                    <td className="py-2.5 px-4 text-slate-600">{t.desc}</td>
                    <td className="py-2.5 px-4 text-center"><Badge value={ins} color="green" /></td>
                    <td className="py-2.5 px-4 text-center"><Badge value={upd} color="blue" /></td>
                    <td className="py-2.5 px-4 text-center"><Badge value={del} color="red" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Erros detalhados */}
          {result.stats?.errors?.length > 0 && (
            <div className="p-4 border-t border-slate-200">
              <p className="text-sm font-medium text-red-700 mb-2">Erros ({result.stats.errors.length}):</p>
              <div className="max-h-40 overflow-auto bg-red-50 rounded-lg p-3 space-y-1">
                {result.stats.errors.slice(0, 20).map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
                {result.stats.errors.length > 20 && (
                  <p className="text-xs text-slate-500">... e mais {result.stats.errors.length - 20} erros</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aviso */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p>A importacao consulta a API do Protheus e processa cada armazem sequencialmente.</p>
          <p className="mt-1">Tabelas atualizadas: <strong>SB1010</strong> (produtos), <strong>SB2010</strong> (saldos), <strong>SB8010</strong> (lotes), <strong>SBZ010</strong> (indicadores), <strong>SLK010</strong> (codigos de barras).</p>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Importar Produtos"
        description="Importar produtos do Protheus para a filial selecionada? Este processo pode levar varios minutos."
        details={[
          `Filial: ${filial} - ${usuario?.filialAtual?.nome ?? ''}`,
          `Armazens selecionados: ${selected.size}`,
          `Codigos: ${Array.from(selected).sort().join(', ')}`,
        ]}
        variant="warning"
        confirmLabel="Importar Agora"
        onConfirm={() => { setShowConfirm(false); doImport(); }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

// === Componente auxiliar ===

function Badge({ value, color }: { value: number; color: 'green' | 'blue' | 'red' | 'slate' }) {
  if (value === 0) {
    return <span className="text-xs text-slate-400">0</span>;
  }

  const colors = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>
      {value.toLocaleString('pt-BR')}
    </span>
  );
}
