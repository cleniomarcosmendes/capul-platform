import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ArrowLeft, Trash2, Users, UserPlus, UserMinus, KeyRound, Search } from 'lucide-react';
import { licencaCompraService } from '../../services/licencaCompra.service';
import { licencaService } from '../../services/licenca.service';
import { protheusService, type FuncionarioProtheus } from '../../services/protheus.service';
import type { LicencaCompra, LicencaFuncionario, SoftwareLicenca } from '../../types';

const modeloLabel: Record<string, string> = {
  SUBSCRICAO: 'Assinatura', PERPETUA: 'Perpétua', POR_USUARIO: 'Por Usuário',
  POR_ESTACAO: 'Por Estação', OEM: 'OEM', FREE_OPENSOURCE: 'Free/Open Source', SAAS: 'SaaS', OUTRO: 'Outro',
};
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : '-'; }
function nomeLic(l: SoftwareLicenca) { return l.software?.nome || l.nome || 'Licença'; }

export function NotaLicencaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { gestaoTiRole } = useAuth();
  const { toast, confirm } = useToast();
  const isAdmin = ['ADMIN', 'GESTOR', 'SUPORTE'].includes(gestaoTiRole || '');

  const [nota, setNota] = useState<LicencaCompra | null>(null);
  const [loading, setLoading] = useState(true);

  // funcionários por licença (expand)
  const [expandLic, setExpandLic] = useState<string | null>(null);
  const [funcs, setFuncs] = useState<LicencaFuncionario[]>([]);
  const [mat, setMat] = useState('');
  const [nomeFunc, setNomeFunc] = useState('');
  const [savingFunc, setSavingFunc] = useState(false);
  // Busca de funcionário por NOME (portal RH) — única forma de alocação.
  const [buscaNome, setBuscaNome] = useState('');
  const [resultados, setResultados] = useState<FuncionarioProtheus[]>([]);
  const [buscandoLista, setBuscandoLista] = useState(false);

  // Debounce (350ms) + mín. 3 chars — não martela o Protheus a cada tecla.
  useEffect(() => {
    const q = buscaNome.trim();
    if (q.length < 3) { setResultados([]); setBuscandoLista(false); return; }
    setBuscandoLista(true);
    const t = setTimeout(() => {
      protheusService.buscarPorNome(q)
        .then(setResultados)
        .finally(() => setBuscandoLista(false));
    }, 350);
    return () => clearTimeout(t);
  }, [buscaNome]);

  function selecionarFuncionario(f: FuncionarioProtheus) {
    setMat(f.matricula);
    setNomeFunc(f.nome);
    setBuscaNome('');
    setResultados([]);
  }

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { setNota(await licencaCompraService.buscar(id)); } catch { /* ignore */ }
    setLoading(false);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function toggleFunc(licId: string) {
    if (expandLic === licId) { setExpandLic(null); return; }
    setExpandLic(licId); setMat(''); setNomeFunc(''); setBuscaNome(''); setResultados([]);
    try { setFuncs(await licencaService.listarFuncionarios(licId)); } catch { setFuncs([]); }
  }
  async function atribuir(licId: string) {
    const m = mat.trim(); const nm = nomeFunc.trim();
    if (!m || !nm) return;
    setSavingFunc(true);
    try {
      await licencaService.atribuirFuncionario(licId, m, nm);
      setFuncs(await licencaService.listarFuncionarios(licId));
      setMat(''); setNomeFunc(''); setBuscaNome(''); setResultados([]);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast('error', msg || 'Erro ao atribuir funcionário');
    }
    setSavingFunc(false);
  }
  async function desatribuir(licId: string, matricula: string) {
    try { await licencaService.desatribuirFuncionario(licId, matricula); setFuncs(await licencaService.listarFuncionarios(licId)); }
    catch (err) { const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message; toast('error', msg || 'Erro ao remover'); }
  }

  async function excluirNota() {
    if (!id) return;
    if (!await confirm('Excluir Nota', 'Excluir esta nota e TODAS as licenças dela (e seus funcionários vinculados)? Não pode ser desfeito.', { variant: 'danger' })) return;
    try { await licencaCompraService.excluir(id); toast('success', 'Nota excluída'); navigate('/gestao-ti/licencas'); }
    catch (err) { const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message; toast('error', msg || 'Erro ao excluir'); }
  }

  if (loading) return (<><Header title="Nota de Licenças" /><div className="p-6 text-slate-500">Carregando...</div></>);
  if (!nota) return (<><Header title="Nota de Licenças" /><div className="p-6 text-slate-500">Nota não encontrada.</div></>);

  return (
    <>
      <Header title={`Nota de Licenças ${nota.semNota ? 'S/N' : nota.numero}`} />
      <div className="p-6 max-w-5xl">
        <button onClick={() => navigate('/gestao-ti/licencas')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Cabeçalho */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-capul-500" /> {nota.semNota ? 'Sem nota fiscal (S/N)' : `NF nº ${nota.numero}`}
            </h3>
            {isAdmin && (
              <button onClick={excluirNota} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="w-3.5 h-3.5" /> Excluir nota
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-xs text-slate-400">Fornecedor</p><p className="text-slate-700">{nota.fornecedor?.nome ?? '-'}</p></div>
            <div><p className="text-xs text-slate-400">Lançamento</p><p className="text-slate-700">{fmtDate(nota.dataLancamento)}</p></div>
            <div><p className="text-xs text-slate-400">Vencimento</p><p className="text-slate-700">{fmtDate(nota.dataVencimento)}</p></div>
            <div><p className="text-xs text-slate-400">Valor Total</p><p className="text-slate-700 font-semibold">R$ {Number(nota.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
            {nota.chaveNfe && (
              <div className="col-span-2 md:col-span-4"><p className="text-xs text-slate-400">Chave NF-e</p>
                <a href={`/fiscal/nfe?chave=${nota.chaveNfe}`} target="_blank" rel="noopener noreferrer" className="text-capul-600 hover:underline font-mono text-xs">{nota.chaveNfe}</a>
              </div>
            )}
            {nota.observacao && <div className="col-span-2 md:col-span-4"><p className="text-xs text-slate-400">Observação</p><p className="text-slate-700">{nota.observacao}</p></div>}
          </div>
        </div>

        {/* Licenças (itens) */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-700 uppercase">Licenças ({nota.itens?.length ?? 0})</h3></div>
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-left">
              <th className="px-4 py-2 font-medium text-slate-600">Licença</th>
              <th className="px-4 py-2 font-medium text-slate-600">Modelo</th>
              <th className="px-4 py-2 font-medium text-slate-600">Qtd</th>
              <th className="px-4 py-2 font-medium text-slate-600">Depto Alocado</th>
              <th className="px-4 py-2 font-medium text-slate-600">Serial</th>
              <th className="px-4 py-2 font-medium text-slate-600">Funcionários</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {nota.itens?.map((l) => (
                <Fragment key={l.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-700">{nomeLic(l)}{l.categoria && <span className="text-xs text-slate-400 ml-1">({l.categoria.nome})</span>}</td>
                    <td className="px-4 py-2 text-slate-600">{l.modeloLicenca ? modeloLabel[l.modeloLicenca] || l.modeloLicenca : '-'}</td>
                    <td className="px-4 py-2 text-slate-600">{l.quantidade ?? '-'}</td>
                    <td className="px-4 py-2 text-slate-600">{l.departamento?.nome ?? '-'}</td>
                    <td className="px-4 py-2 text-xs font-mono text-slate-500">{l.chaveSerial || '-'}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => toggleFunc(l.id)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${expandLic === l.id ? 'bg-capul-100 text-capul-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                        <Users className="w-3 h-3" />{l._count?.funcionarios ?? 0}/{l.quantidade ?? '∞'}
                      </button>
                    </td>
                  </tr>
                  {expandLic === l.id && (
                    <tr><td colSpan={6} className="px-4 py-3 bg-slate-50">
                      <div className="border border-slate-200 rounded-lg bg-white p-4">
                        {isAdmin && l.status === 'ATIVA' && (
                          <>
                            {/* Busca principal: por NOME (autocomplete, portal RH) */}
                            <div className="relative mb-2 max-w-md">
                              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-[9px]" />
                              <input value={buscaNome} onChange={(e) => setBuscaNome(e.target.value)} placeholder="Buscar funcionário por nome (mín. 3 letras)…" className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                              {buscaNome.trim().length >= 3 && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                  {buscandoLista ? (
                                    <div className="px-3 py-2 text-sm text-slate-400">Buscando no Protheus…</div>
                                  ) : resultados.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-slate-400">Nenhum funcionário encontrado (ou sem acesso ao portal RH).</div>
                                  ) : resultados.map((f) => (
                                    <button key={f.matricula} type="button" onClick={() => selecionarFuncionario(f)} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                      <span className="text-sm font-medium text-slate-800">{f.nome}</span>
                                      <span className="text-xs text-slate-400 ml-2">mat. {f.matricula}{f.cc ? ` · cc ${f.cc}` : ''}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <input value={nomeFunc} readOnly placeholder="Selecione um funcionário na busca acima" className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50 text-slate-700 cursor-default focus:outline-none" />
                              <button onClick={() => atribuir(l.id)} disabled={!mat.trim() || !nomeFunc.trim() || savingFunc || (l.quantidade != null && funcs.length >= l.quantidade)} className="flex items-center gap-1 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                                <UserPlus className="w-3.5 h-3.5" />{savingFunc ? 'Atribuindo...' : 'Atribuir'}
                              </button>
                            </div>
                            <p className="text-xs mb-3">
                              {mat.trim() && nomeFunc.trim()
                                ? <span className="text-green-600">✓ {nomeFunc} (mat. {mat}) — clique em Atribuir.</span>
                                : <span className="text-slate-400">Busque o funcionário pelo nome e selecione na lista.</span>}
                            </p>
                          </>
                        )}
                        {funcs.length === 0 ? <p className="text-sm text-slate-400 text-center py-2">Nenhum funcionário atribuído</p> : (
                          <div className="space-y-1">
                            {funcs.map((f) => (
                              <div key={f.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-slate-50">
                                <div><span className="text-sm font-medium text-slate-800">{f.nome}</span><span className="text-xs text-slate-400 ml-2">mat. {f.matricula}</span></div>
                                {isAdmin && <button onClick={() => desatribuir(l.id, f.matricula)} className="text-red-400 hover:text-red-600" title="Remover"><UserMinus className="w-4 h-4" /></button>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
