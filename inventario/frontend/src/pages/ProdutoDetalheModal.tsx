import { useEffect, useState } from 'react';
import { productService } from '../services/product.service';
import {
  X,
  Loader2,
  Package,
  Layers,
  Barcode,
  Warehouse,
  FlaskConical,
  MapPin,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  productId: string;
  onClose: () => void;
}

interface ClassInfo {
  codigo: string;
  descricao: string;
}

interface ProductDetail {
  codigo: string;
  descricao: string;
  tipo: string;
  unidade: string;
  localizacao_padrao: string;
  grupo: ClassInfo | null;
  categoria: ClassInfo | null;
  subcategoria: ClassInfo | null;
  segmento: ClassInfo | null;
  grupo_inventario: ClassInfo | null;
  controla_lote: boolean;
  codigo_barras_principal: string;
  codigos_barras: { filial: string; codigo: string; produto: string }[];
  indicadores_filial: { filial: string; codigo: string; local: string; localizacao1: string; localizacao2: string; localizacao3: string }[];
  saldos_estoque: { filial: string; local: string; quantidade_atual: number; quantidade_empenhada: number; quantidade_reservada: number; quantidade_disponivel: number; custo_medio: number; valor_total: number; entradas_pos: number }[];
  saldos_lote: { filial: string; local: string; lote: string; sublote: string; saldo: number; data_validade: string | null }[];
}

type Tab = 'barcodes' | 'stock' | 'lots';

function fmt(v: number, decimals = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(v: number) {
  return 'R$ ' + fmt(v);
}

function fmtDate(raw: string | null): string {
  if (!raw) return '-';
  // Format: YYYYMMDD → DD/MM/YYYY
  if (raw.length === 8) {
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
  }
  // Try ISO
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString('pt-BR');
}

function isExpired(raw: string | null): boolean {
  if (!raw) return false;
  let dateStr = raw;
  if (raw.length === 8) {
    dateStr = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return new Date(dateStr) < new Date();
}

export function ProdutoDetalheModal({ productId, onClose }: Props) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('stock');

  useEffect(() => {
    setLoading(true);
    setError(false);
    productService.buscarPorId(productId)
      .then((data) => setProduct(data as unknown as ProductDetail))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-capul-100 rounded-lg shrink-0">
              <Package className="w-5 h-5 text-capul-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-slate-900 truncate">
                {loading ? 'Carregando...' : product?.descricao ?? 'Produto'}
              </h2>
              {product && <p className="text-xs text-slate-500 font-mono">{product.codigo}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-capul-500" />
              <p className="text-sm text-slate-500">Carregando detalhes...</p>
            </div>
          ) : error || !product ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-600">Erro ao carregar detalhes do produto.</p>
              <button onClick={onClose} className="text-sm text-capul-600 hover:underline">Fechar</button>
            </div>
          ) : (
            <>
              {/* Info Cards Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Info */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Informacoes Basicas</h3>
                  <InfoRow label="Codigo" value={product.codigo} mono />
                  <InfoRow label="Descricao" value={product.descricao} />
                  <InfoRow label="Tipo" value={product.tipo} />
                  <InfoRow label="Unidade" value={product.unidade} />
                  <InfoRow label="Localizacao Padrao" value={product.localizacao_padrao || '-'} />
                  <InfoRow label="Controla Lote" value={
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${product.controla_lote ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                      {product.controla_lote ? 'Sim' : 'Nao'}
                    </span>
                  } />
                </div>

                {/* Classifications */}
                <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Classificacao</h3>
                  <ClassRow label="Grupo" info={product.grupo} color="bg-blue-100 text-blue-700" />
                  <ClassRow label="Categoria" info={product.categoria} color="bg-amber-100 text-amber-700" />
                  <ClassRow label="Subcategoria" info={product.subcategoria} color="bg-cyan-100 text-cyan-700" />
                  <ClassRow label="Segmento" info={product.segmento} color="bg-slate-200 text-slate-700" />
                  <ClassRow label="Grupo Inventario" info={product.grupo_inventario} color="bg-purple-100 text-purple-700" />
                </div>
              </div>

              {/* Indicators */}
              {product.indicadores_filial.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-700">Indicadores por Filial</h3>
                    <span className="text-xs text-slate-400">(SBZ010)</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Filial</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Localizacao 1</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Localizacao 2</th>
                        <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Localizacao 3</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.indicadores_filial.map((ind, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 px-4">
                            <span className="px-2 py-0.5 bg-capul-100 text-capul-700 rounded text-xs font-medium">{ind.filial || '-'}</span>
                          </td>
                          <td className="py-2 px-4 text-slate-600">{ind.localizacao1 || '-'}</td>
                          <td className="py-2 px-4 text-slate-600">{ind.localizacao2 || '-'}</td>
                          <td className="py-2 px-4 text-slate-600">{ind.localizacao3 || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tabs */}
              <div className="border-b border-slate-200">
                <div className="flex gap-1">
                  <TabButton
                    active={activeTab === 'barcodes'}
                    onClick={() => setActiveTab('barcodes')}
                    icon={Barcode}
                    label="Codigos de Barras"
                    count={product.codigos_barras.length}
                  />
                  <TabButton
                    active={activeTab === 'stock'}
                    onClick={() => setActiveTab('stock')}
                    icon={Warehouse}
                    label="Saldo em Estoque"
                    count={product.saldos_estoque.length}
                  />
                  {product.controla_lote && (
                    <TabButton
                      active={activeTab === 'lots'}
                      onClick={() => setActiveTab('lots')}
                      icon={FlaskConical}
                      label="Saldo por Lote"
                      count={product.saldos_lote.length}
                    />
                  )}
                </div>
              </div>

              {/* Tab: Barcodes */}
              {activeTab === 'barcodes' && (
                <div className="space-y-3">
                  {product.codigo_barras_principal && (
                    <div className="flex items-center gap-2 p-3 bg-capul-50 border border-capul-200 rounded-lg">
                      <Barcode className="w-5 h-5 text-capul-600" />
                      <span className="font-mono text-sm font-medium text-capul-800">{product.codigo_barras_principal}</span>
                      <span className="text-xs text-capul-500">(principal)</span>
                    </div>
                  )}
                  {product.codigos_barras.length === 0 ? (
                    <EmptyState text="Nenhum codigo de barras cadastrado." />
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Filial</th>
                            <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Codigo de Barras</th>
                            <th className="text-left py-2 px-4 text-xs font-medium text-slate-500">Produto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.codigos_barras.map((bc, i) => (
                            <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                              <td className="py-2 px-4">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{bc.filial || '-'}</span>
                              </td>
                              <td className="py-2 px-4 font-mono text-sm text-slate-800">{bc.codigo}</td>
                              <td className="py-2 px-4 text-xs text-slate-400">{bc.produto}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Stock */}
              {activeTab === 'stock' && (
                product.saldos_estoque.length === 0 ? (
                  <EmptyState text="Nenhum saldo em estoque encontrado." />
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Filial</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Local</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Qtd Atual</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Qtd Emp.</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Qtd Res.</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Custo Medio</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Valor Total</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Ent. POS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.saldos_estoque.map((s, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-capul-100 text-capul-700 rounded text-xs font-medium">{s.filial}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{s.local}</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">{fmt(s.quantidade_atual)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{fmt(s.quantidade_empenhada)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{fmt(s.quantidade_reservada)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{fmtCurrency(s.custo_medio)}</td>
                            <td className="py-2 px-3 text-right font-mono font-medium text-slate-800">{fmtCurrency(s.valor_total)}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{fmt(s.entradas_pos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {/* Tab: Lots */}
              {activeTab === 'lots' && product.controla_lote && (
                product.saldos_lote.length === 0 ? (
                  <EmptyState text="Nenhum lote encontrado." />
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Filial</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Local</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Lote</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Sublote</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-slate-500">Saldo</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-slate-500">Dt. Validade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.saldos_lote.map((l, i) => {
                          const expired = isExpired(l.data_validade);
                          return (
                            <tr key={i} className={`border-b border-slate-50 hover:bg-slate-50 ${expired ? 'bg-red-50/50' : ''}`}>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">{l.filial}</span>
                              </td>
                              <td className="py-2 px-3">
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{l.local}</span>
                              </td>
                              <td className="py-2 px-3 font-mono text-xs font-medium text-slate-800">{l.lote}</td>
                              <td className="py-2 px-3 font-mono text-xs text-slate-400">{l.sublote || '-'}</td>
                              <td className="py-2 px-3 text-right font-mono text-capul-700 font-medium">{fmt(l.saldo)}</td>
                              <td className={`py-2 px-3 text-center text-xs ${expired ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                {fmtDate(l.data_validade)}
                                {expired && <span className="ml-1" title="Lote vencido">⚠️</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// === Sub-components ===

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function ClassRow({ label, info, color }: { label: string; info: ClassInfo | null; color: string }) {
  if (!info) return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs text-slate-400">-</span>
    </div>
  );
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{info.descricao}</span>
        <span className="text-[10px] text-slate-400 font-mono">{info.codigo}</span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        active
          ? 'border-capul-600 text-capul-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      {count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${active ? 'bg-capul-100 text-capul-700' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
