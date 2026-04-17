import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { compraService } from '../../services/compra.service';
import { useToast } from '../../components/Toast';
import { ArrowLeft, Pencil, Copy, FileText, FolderKanban, Paperclip, Download, Trash2, Upload } from 'lucide-react';
import { formatDateBR, formatDateTimeBR } from '../../utils/date';
import type { NotaFiscal } from '../../types';

const statusCores: Record<string, string> = {
  REGISTRADA: 'bg-blue-100 text-blue-700',
  CONFERIDA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  REGISTRADA: 'Registrada',
  CONFERIDA: 'Conferida',
  CANCELADA: 'Cancelada',
};

export function NotaFiscalDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const { toast, confirm } = useToast();
  const canManage = ['ADMIN', 'GESTOR_TI', 'SUPORTE_TI'].includes(gestaoTiRole || '');
  const canDelete = gestaoTiRole === 'ADMIN' || gestaoTiRole === 'GESTOR_TI';

  const [nf, setNf] = useState<NotaFiscal | null>(null);
  const [loading, setLoading] = useState(true);
  const [anexos, setAnexos] = useState<{ id: string; nomeOriginal: string; mimeType: string; tamanho: number; createdAt: string; usuario: { id: string; nome: string } }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) carregar();
  }, [id]);

  async function carregar() {
    setLoading(true);
    try {
      const [nfData, anexosData] = await Promise.all([
        compraService.buscarNotaFiscal(id!),
        compraService.listarAnexosNF(id!),
      ]);
      setNf(nfData);
      setAnexos(anexosData);
    } catch {
      toast('error', 'Erro ao carregar nota fiscal');
    }
    setLoading(false);
  }

  async function handleUploadAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !nf) return;
    setUploading(true);
    try {
      for (const file of Array.from(e.target.files)) {
        const novo = await compraService.uploadAnexoNF(nf.id, file);
        setAnexos((prev) => [novo, ...prev]);
      }
      toast('success', 'Arquivo(s) anexado(s)');
    } catch { toast('error', 'Erro ao anexar arquivo'); }
    setUploading(false);
    e.target.value = '';
  }

  async function handleRemoveAnexo(anexoId: string) {
    if (!nf) return;
    const ok = await confirm('Remover Anexo', 'Deseja remover este anexo?', { variant: 'danger' });
    if (!ok) return;
    try {
      await compraService.removerAnexoNF(nf.id, anexoId);
      setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
      toast('success', 'Anexo removido');
    } catch { toast('error', 'Erro ao remover anexo'); }
  }

  async function handleAlterarStatus(status: string) {
    if (!nf) return;
    const label = status === 'CONFERIDA' ? 'conferir' : status === 'CANCELADA' ? 'cancelar' : 'reabrir';
    const ok = await confirm('Alterar Status', `Deseja ${label} esta nota fiscal?`, { variant: status === 'CANCELADA' ? 'danger' : 'default' });
    if (!ok) return;
    try {
      await compraService.atualizarNotaFiscal(nf.id, { status });
      toast('success', `Nota fiscal ${statusLabels[status]?.toLowerCase() || status}`);
      carregar();
    } catch {
      toast('error', 'Erro ao alterar status');
    }
  }

  async function handleDuplicar() {
    if (!nf) return;
    try {
      const nova = await compraService.duplicarNotaFiscal(nf.id);
      toast('success', 'Nota fiscal duplicada');
      navigate(`/gestao-ti/notas-fiscais/${nova.id}`);
    } catch {
      toast('error', 'Erro ao duplicar');
    }
  }

  async function handleExcluir() {
    if (!nf) return;
    const ok = await confirm('Excluir NF', 'Deseja excluir esta nota fiscal permanentemente?', { variant: 'danger' });
    if (!ok) return;
    try {
      await compraService.excluirNotaFiscal(nf.id);
      toast('success', 'Nota fiscal excluida');
      navigate('/gestao-ti/notas-fiscais', { replace: true });
    } catch (err: unknown) {
      toast('error', (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir');
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Nota Fiscal" />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  if (!nf) {
    return (
      <>
        <Header title="Nota Fiscal" />
        <div className="p-6 text-center text-slate-500">Nota fiscal nao encontrada</div>
      </>
    );
  }

  return (
    <>
      <Header title={`NF ${nf.numero}`} />
      <div className="p-6 max-w-6xl">
        <div className="flex items-center justify-between mb-4">
          <Link to="/gestao-ti/notas-fiscais"
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          {canManage && nf.status !== 'CANCELADA' && (
            <div className="flex items-center gap-2">
              <button onClick={handleDuplicar}
                className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5">
                <Copy className="w-4 h-4" /> Duplicar
              </button>
              <Link to={`/gestao-ti/notas-fiscais/${nf.id}/editar`}
                className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700 border border-capul-300 rounded-lg px-3 py-1.5">
                <Pencil className="w-4 h-4" /> Editar
              </Link>
              {nf.status === 'REGISTRADA' && (
                <button onClick={() => handleAlterarStatus('CONFERIDA')}
                  className="text-sm bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700">
                  Conferir
                </button>
              )}
              {nf.status === 'CONFERIDA' && (
                <button onClick={() => handleAlterarStatus('REGISTRADA')}
                  className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700">
                  Reabrir
                </button>
              )}
              <button onClick={() => handleAlterarStatus('CANCELADA')}
                className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700">
                Cancelar NF
              </button>
            </div>
          )}
          {canDelete && nf.status === 'CANCELADA' && (
            <button onClick={handleExcluir}
              className="text-sm text-red-600 hover:text-red-700 border border-red-300 rounded-lg px-3 py-1.5">
              Excluir
            </button>
          )}
        </div>

        {/* Cabecalho */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-capul-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-800">NF {nf.numero}</h2>
                <span className={`text-xs px-2 py-1 rounded-full ${statusCores[nf.status]}`}>
                  {statusLabels[nf.status] || nf.status}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs">Data Lancamento</p>
              <p className="text-slate-800 font-medium">{formatDateBR(nf.dataLancamento)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Data Vencimento</p>
              <p className="text-slate-800 font-medium">{nf.dataVencimento ? formatDateBR(nf.dataVencimento) : '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500 text-xs">Fornecedor</p>
              <p className="text-slate-800 font-medium">{nf.fornecedor.codigo} - {nf.fornecedor.nome}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Valor Total</p>
              <p className="text-slate-800 font-bold text-lg">
                R$ {Number(nf.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-slate-500 text-xs">Equipe</p>
              {nf.equipe ? (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full text-white font-medium mt-0.5"
                  style={{ backgroundColor: nf.equipe.cor || '#64748b' }}
                >
                  {nf.equipe.sigla} - {nf.equipe.nome}
                </span>
              ) : (
                <p className="text-slate-400">Nao definida</p>
              )}
            </div>
            <div>
              <p className="text-slate-500 text-xs">Filial</p>
              <p className="text-slate-800">{nf.filial.codigo} - {nf.filial.nomeFantasia}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Registrado por</p>
              <p className="text-slate-800">{nf.criadoPor.nome}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Data Registro</p>
              <p className="text-slate-800">{formatDateTimeBR(nf.createdAt)}</p>
            </div>
          </div>

          {nf.observacao && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <span className="text-xs font-semibold text-amber-700 uppercase">Observacao</span>
              <p className="mt-1 text-sm text-slate-700">{nf.observacao}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 uppercase">
              Itens ({nf.itens.length})
            </h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Produto</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3 text-center">Qtde</th>
                <th className="px-6 py-3 text-right">Valor Unit.</th>
                <th className="px-6 py-3 text-right">Valor Total</th>
                <th className="px-6 py-3">Centro de Custo</th>
                <th className="px-6 py-3">Projeto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nf.itens.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm">
                    <div className="font-medium text-slate-700">{item.produto.descricao}</div>
                    <div className="text-xs text-slate-400">{item.produto.codigo}</div>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {item.produto.tipoProduto?.descricao || '-'}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700 text-center">{item.quantidade}</td>
                  <td className="px-6 py-3 text-sm text-slate-700 text-right">
                    R$ {Number(item.valorUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-slate-800 text-right">
                    R$ {Number(item.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700">{item.centroCusto ? `${item.centroCusto.codigo} - ${item.centroCusto.nome}` : '-'}</td>
                  <td className="px-6 py-3 text-sm">
                    {item.projeto ? (
                      <Link to={`/gestao-ti/projetos/${item.projeto.id}`}
                        className="flex items-center gap-1 text-capul-600 hover:underline">
                        <FolderKanban className="w-3.5 h-3.5" />
                        #{item.projeto.numero} - {item.projeto.nome}
                      </Link>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200">
                <td colSpan={4} className="px-6 py-3 text-sm font-semibold text-slate-700 text-right">Total da Nota Fiscal:</td>
                <td className="px-6 py-3 text-sm font-bold text-capul-700 text-right">
                  R$ {Number(nf.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Anexos */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Anexos ({anexos.length})
            </h3>
            {canManage && nf.status !== 'CANCELADA' && (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-700 disabled:opacity-50">
                <Upload className="w-4 h-4" /> {uploading ? 'Enviando...' : 'Anexar Arquivo'}
              </button>
            )}
            <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleUploadAnexo} disabled={uploading} />
          </div>
          {anexos.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400 text-center">Nenhum anexo</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {anexos.map((a) => (
                <div key={a.id} className="px-6 py-3 flex items-center gap-3">
                  <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => {
                        const viewable = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf', 'text/plain', 'text/csv'];
                        if (viewable.includes(a.mimeType)) {
                          compraService.abrirAnexoNF(nf.id, a.id, a.mimeType).catch(() => {
                            compraService.downloadAnexoNF(nf.id, a.id, a.nomeOriginal);
                          });
                        } else {
                          compraService.downloadAnexoNF(nf.id, a.id, a.nomeOriginal);
                        }
                      }}
                      className="text-sm text-capul-700 hover:text-capul-900 hover:underline truncate text-left"
                      title="Clique para abrir"
                    >
                      {a.nomeOriginal}
                    </button>
                    <p className="text-xs text-slate-400">
                      {(a.tamanho / 1024).toFixed(0)} KB — {a.usuario.nome} — {new Date(a.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button onClick={() => compraService.downloadAnexoNF(nf.id, a.id, a.nomeOriginal)}
                    className="text-slate-400 hover:text-capul-600" title="Download">
                    <Download className="w-4 h-4" />
                  </button>
                  {canManage && nf.status !== 'CANCELADA' && (
                    <button onClick={() => handleRemoveAnexo(a.id)}
                      className="text-slate-400 hover:text-red-500" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
