import { useEffect, useState, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';
import { ArrowLeft, Trash2, Users, UserPlus, UserMinus, KeyRound } from 'lucide-react';
import { licencaCompraService } from '../../services/licencaCompra.service';
import { licencaService } from '../../services/licenca.service';
import { protheusService } from '../../services/protheus.service';
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
  const [buscandoNome, setBuscandoNome] = useState(false);
  // null = ainda não buscou; true = nome veio do Protheus; false = não achou (manual)
  const [nomeAuto, setNomeAuto] = useState<boolean | null>(null);

  // Autofill do nome pela matrícula (Protheus / portal RH). Se não encontrar,
  // mantém edição manual. Não bloqueia o fluxo se o Protheus estiver fora.
  async function buscarNome() {
    const m = mat.trim();
    if (!m) { setNomeAuto(null); return; }
    setBuscandoNome(true);
    try {
      const r = await protheusService.buscarColaborador(m);
      if (r.encontrado && r.nome) { setNomeFunc(r.nome); setNomeAuto(true); }
      else setNomeAuto(false);
    } finally {
      setBuscandoNome(false);
    }
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
    setExpandLic(licId); setMat(''); setNomeFunc(''); setNomeAuto(null);
    try { setFuncs(await licencaService.listarFuncionarios(licId)); } catch { setFuncs([]); }
  }
  async function atribuir(licId: string) {
    const m = mat.trim(); const nm = nomeFunc.trim();
    if (!m || !nm) return;
    setSavingFunc(true);
    try {
      await licencaService.atribuirFuncionario(licId, m, nm);
      setFuncs(await licencaService.listarFuncionarios(licId));
      setMat(''); setNomeFunc(''); setNomeAuto(null);
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
                            <div className="flex flex-wrap gap-2 mb-1">
                              <input value={mat} onChange={(e) => { setMat(e.target.value); setNomeAuto(null); setNomeFunc(''); }} onBlur={buscarNome} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscarNome(); } }} placeholder="Matrícula" className="w-32 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-capul-600" />
                              <input value={nomeFunc} readOnly placeholder={buscandoNome ? 'Buscando nome…' : 'Nome (do Protheus)'} title="Nome vem do Protheus pela matrícula — não editável" className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50 text-slate-700 cursor-default focus:outline-none" />
                              <button onClick={() => atribuir(l.id)} disabled={!mat.trim() || !nomeFunc.trim() || savingFunc || buscandoNome || (l.quantidade != null && funcs.length >= l.quantidade)} className="flex items-center gap-1 bg-capul-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50">
                                <UserPlus className="w-3.5 h-3.5" />{savingFunc ? 'Atribuindo...' : 'Atribuir'}
                              </button>
                            </div>
                            <p className="text-xs mb-3">
                              {buscandoNome ? <span className="text-slate-400">Buscando funcionário no Protheus…</span>
                                : nomeAuto === true ? <span className="text-green-600">✓ Funcionário identificado no Protheus.</span>
                                : nomeAuto === false ? <span className="text-amber-600">Matrícula não encontrada no Protheus — não é possível atribuir.</span>
                                : <span className="text-slate-400">Informe a matrícula — o nome é buscado no Protheus (não editável).</span>}
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
