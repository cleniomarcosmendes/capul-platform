import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../../layouts/Header';
import { useAuth } from '../../contexts/AuthContext';
import { chamadoService } from '../../services/chamado.service';
import { equipeService } from '../../services/equipe.service';
import { coreService } from '../../services/core.service';
import { Plus, Eye, Download, Star } from 'lucide-react';
import { exportService } from '../../services/export.service';
import type { Chamado, EquipeTI, Departamento, StatusChamado, Visibilidade, TipoDepartamento } from '../../types';

interface FilialOption {
  id: string;
  codigo: string;
  nomeFantasia: string;
}

const statusLabels: Record<StatusChamado, string> = {
  ABERTO: 'Aberto',
  EM_ATENDIMENTO: 'Em Atendimento',
  PENDENTE: 'Pendente',
  RESOLVIDO: 'Resolvido',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
  REABERTO: 'Reaberto',
};

const statusColors: Record<StatusChamado, string> = {
  ABERTO: 'bg-blue-100 text-blue-700',
  EM_ATENDIMENTO: 'bg-yellow-100 text-yellow-700',
  PENDENTE: 'bg-orange-100 text-orange-700',
  RESOLVIDO: 'bg-green-100 text-green-700',
  FECHADO: 'bg-slate-100 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-600',
  REABERTO: 'bg-purple-100 text-purple-700',
};

const prioridadeColors: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-700',
  ALTA: 'bg-orange-100 text-orange-700',
  MEDIA: 'bg-yellow-100 text-yellow-700',
  BAIXA: 'bg-green-100 text-green-700',
};

export function ChamadosListPage() {
  const { gestaoTiRole, usuario } = useAuth();
  const [searchParams] = useSearchParams();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [equipes, setEquipes] = useState<EquipeTI[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [filiais, setFiliais] = useState<FilialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusChamado | ''>('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterVisibilidade, setFilterVisibilidade] = useState<Visibilidade | ''>('');
  const [meusChamados, setMeusChamados] = useState(gestaoTiRole !== 'USUARIO_FINAL');
  // 'atual' = filial do usuario, '' = todas, uuid = filial especifica
  const [filterFilial, setFilterFilial] = useState<string>('atual');
  const [filterDepartamento, setFilterDepartamento] = useState('');
  const [pendentesAvaliacao, setPendentesAvaliacao] = useState(searchParams.get('pendentes') === '1');

  const isUsuarioFinal = gestaoTiRole === 'USUARIO_FINAL';

  useEffect(() => {
    equipeService.listar('ATIVO').then(setEquipes).catch(() => {});
    coreService.listarFiliais().then(setFiliais).catch(() => {});
    coreService.listarDepartamentos().then(setDepartamentos).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    if (pendentesAvaliacao) {
      chamadoService
        .listar({ pendentesAvaliacao: true })
        .then(setChamados)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const filialId = filterFilial === 'atual'
        ? usuario?.filialAtual?.id
        : filterFilial || undefined;
      chamadoService
        .listar({
          status: filterStatus || undefined,
          equipeId: filterEquipe || undefined,
          visibilidade: filterVisibilidade || undefined,
          meusChamados: meusChamados || undefined,
          filialId,
          departamentoId: filterDepartamento || undefined,
        })
        .then(setChamados)
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [filterStatus, filterEquipe, filterVisibilidade, meusChamados, filterFilial, filterDepartamento, usuario, pendentesAvaliacao]);

  return (
    <>
      <Header title="Chamados" />
      <div className="p-6">
        {/* Tabs para USUARIO_FINAL */}
        {isUsuarioFinal && (
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            <button
              onClick={() => setPendentesAvaliacao(false)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                !pendentesAvaliacao
                  ? 'border-capul-600 text-capul-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Meus Chamados
            </button>
            <button
              onClick={() => setPendentesAvaliacao(true)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                pendentesAvaliacao
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Star className="w-4 h-4" />
              Pendentes de Avaliacao
            </button>
          </div>
        )}

        {/* Banner de pendentes */}
        {pendentesAvaliacao && !loading && chamados.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
            <Star className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Voce tem {chamados.length} chamado(s) pendente(s) de avaliacao
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Sua avaliacao ajuda a melhorar nosso atendimento!
              </p>
            </div>
          </div>
        )}

        {/* Filtros - esconder quando pendentesAvaliacao esta ativo */}
        {!pendentesAvaliacao && (
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-3">
              <select
                value={filterFilial}
                onChange={(e) => setFilterFilial(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="atual">Filial Atual{usuario?.filialAtual ? ` (${usuario.filialAtual.codigo})` : ''}</option>
                <option value="">Todas as Filiais</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>{f.codigo} - {f.nomeFantasia}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusChamado | '')}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos os Status</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {!isUsuarioFinal && (
                <>
                  <select
                    value={filterEquipe}
                    onChange={(e) => setFilterEquipe(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todas as Equipes</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>{e.sigla} - {e.nome}</option>
                    ))}
                  </select>

                  <select
                    value={filterVisibilidade}
                    onChange={(e) => setFilterVisibilidade(e.target.value as Visibilidade | '')}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todas Visibilidades</option>
                    <option value="PUBLICO">Publico</option>
                    <option value="PRIVADO">Privado</option>
                  </select>

                  <select
                    value={filterDepartamento}
                    onChange={(e) => setFilterDepartamento(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Todos Departamentos</option>
                    {(['ADMINISTRATIVO', 'COMERCIAL', 'OPERACIONAL', 'TECNOLOGIA'] as TipoDepartamento[]).map((tipo) => {
                      const deptosDoTipo = departamentos.filter((d) => d.tipo === tipo);
                      if (deptosDoTipo.length === 0) return null;
                      const labels: Record<TipoDepartamento, string> = {
                        ADMINISTRATIVO: 'Administrativo',
                        COMERCIAL: 'Comercial',
                        OPERACIONAL: 'Operacional',
                        TECNOLOGIA: 'Tecnologia',
                      };
                      return (
                        <optgroup key={tipo} label={labels[tipo]}>
                          {deptosDoTipo.map((d) => (
                            <option key={d.id} value={d.id}>{d.nome}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>

                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={meusChamados}
                      onChange={(e) => setMeusChamados(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Meus chamados
                  </label>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {!isUsuarioFinal && (
                <button
                  onClick={() => exportService.exportar('chamados')}
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-4 h-4" /> Exportar
                </button>
              )}
              <Link
                to="/gestao-ti/chamados/novo"
                className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Novo Chamado
              </Link>
            </div>
          </div>
        )}

        {/* Botao Novo Chamado quando pendentes ativo */}
        {pendentesAvaliacao && (
          <div className="flex justify-end mb-4">
            <Link
              to="/gestao-ti/chamados/novo"
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Chamado
            </Link>
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Carregando...</p>
        ) : chamados.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            {pendentesAvaliacao
              ? 'Nenhum chamado pendente de avaliacao. Tudo em dia!'
              : 'Nenhum chamado encontrado'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Titulo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Prioridade</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Equipe</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Tecnico</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Solicitante</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Depto</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Filial</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chamados.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 font-mono">#{c.numero}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={`/gestao-ti/chamados/${c.id}`} className="font-medium text-slate-800 hover:text-capul-600 max-w-[250px] truncate">{c.titulo}</Link>
                        {c.visibilidade === 'PRIVADO' && (
                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">PRIVADO</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[c.status]}`}>
                        {statusLabels[c.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${prioridadeColors[c.prioridade]}`}>
                        {c.prioridade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.equipeAtual.cor || '#006838' }} />
                        <span className="text-slate-600">{c.equipeAtual.sigla}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.tecnico?.nome || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.solicitante.nome}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.departamento?.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{c.filial?.codigo || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/gestao-ti/chamados/${c.id}`}
                          className="text-capul-600 hover:text-capul-800"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        {pendentesAvaliacao && (
                          <Link
                            to={`/gestao-ti/chamados/${c.id}`}
                            className="flex items-center gap-1 text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600"
                          >
                            <Star className="w-3 h-3" /> Avaliar
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
