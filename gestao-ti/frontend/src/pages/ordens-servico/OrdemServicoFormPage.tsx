import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { ordemServicoService } from '../../services/ordem-servico.service';
import { coreService } from '../../services/core.service';
import { useToast } from '../../components/Toast';
import { ArrowLeft } from 'lucide-react';
import type { UsuarioCore, FilialResumo } from '../../types';
import { isWorkspaceModulo } from '../../lib/workspace-modulo';

/**
 * Nova Ordem de Serviço — página dedicada (antes era um form inline na lista).
 * Padrão de layout do Workspace: card centralizado.
 */
export function OrdemServicoFormPage() {
  const navigate = useNavigate();
  const { usuario, gestaoTiRole } = useAuth();
  const { toast } = useToast();

  const [tecnicos, setTecnicos] = useState<UsuarioCore[]>([]);
  const [filiais, setFiliais] = useState<FilialResumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [filialId, setFilialId] = useState(usuario?.filialAtual?.id || '');
  const [tecnicoId, setTecnicoId] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    // Técnicos atribuíveis = staff de T.I. (mesma regra da lista de chamados).
    coreService
      .listarUsuarios()
      .then((users) => {
        const rolesStaff = ['ADMIN', 'GESTOR', 'SUPORTE'];
        const staff = users.filter((u) =>
          u.permissoes?.some((p) => isWorkspaceModulo(p.modulo?.codigo) && rolesStaff.includes(p.roleModulo?.codigo)),
        );
        setTecnicos(staff);
      })
      .catch(() => {});
    const isStaff = gestaoTiRole && ['ADMIN', 'GESTOR'].includes(gestaoTiRole);
    if (isStaff) {
      coreService.listarFiliais().then(setFiliais).catch(() => {});
    } else if (usuario?.filiais?.length) {
      setFiliais(usuario.filiais.map((f) => ({ id: f.id, codigo: f.codigo, nomeFantasia: f.nome })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await ordemServicoService.criar({
        titulo,
        descricao: descricao || undefined,
        filialId,
        tecnicoId: tecnicoId || undefined,
        dataAgendamento: dataAgendamento ? new Date(dataAgendamento).toISOString() : undefined,
        observacoes: observacoes || undefined,
      });
      toast('success', `OS #${created.numero} criada.`);
      navigate('/gestao-ti/ordens-servico');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Erro ao criar OS');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Nova Ordem de Serviço" />
      <div className="p-6 mx-auto max-w-3xl">
        <button
          onClick={() => navigate('/gestao-ti/ordens-servico')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4 shadow-sm">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Titulo *</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filial *</label>
              <select value={filialId} onChange={(e) => setFilialId(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Selecione a filial...</option>
                {filiais.map((f) => <option key={f.id} value={f.id}>{f.codigo} — {f.nomeFantasia}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tecnico Responsavel</label>
              <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
                <option value="">Selecione (adicionar depois)</option>
                {tecnicos.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descricao</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data Agendamento</label>
              <input type="datetime-local" value={dataAgendamento} onChange={(e) => setDataAgendamento(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observacoes</label>
              <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="(opcional)" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="bg-capul-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-capul-700 disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar OS'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
