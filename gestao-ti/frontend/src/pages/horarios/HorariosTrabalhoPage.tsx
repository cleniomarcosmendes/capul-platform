import { useEffect, useState, useMemo } from 'react';
import { Header } from '../../layouts/Header';
import { horarioService } from '../../services/horario.service';
import { dashboardService } from '../../services/dashboard.service';
import { Clock, Save, Trash2, Plus, Settings, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { HorarioTrabalho, TecnicoResumo } from '../../types';

type SortKey = 'nome' | 'expediente' | 'almoco';
type SortDir = 'asc' | 'desc';

export function HorariosTrabalhoPage() {
  const [, setDefaultHorario] = useState<HorarioTrabalho | null>(null);
  const [personalizados, setPersonalizados] = useState<HorarioTrabalho[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Form default
  const [defIni, setDefIni] = useState('08:00');
  const [defFim, setDefFim] = useState('17:00');
  const [defAlmIni, setDefAlmIni] = useState('12:00');
  const [defAlmFim, setDefAlmFim] = useState('13:00');

  // Form novo/editar personalizado
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [novoUsuarioId, setNovoUsuarioId] = useState('');
  const [novoIni, setNovoIni] = useState('08:00');
  const [novoFim, setNovoFim] = useState('17:00');
  const [novoAlmIni, setNovoAlmIni] = useState('12:00');
  const [novoAlmFim, setNovoAlmFim] = useState('13:00');

  // Ordenacao
  const [sortKey, setSortKey] = useState<SortKey>('nome');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-capul-600" /> : <ArrowDown className="w-3 h-3 text-capul-600" />;
  }
  const sortedPersonalizados = useMemo(() => {
    return [...personalizados].sort((a, b) => {
      let va: string, vb: string;
      if (sortKey === 'nome') {
        va = (a.usuario?.nome || '').toLowerCase();
        vb = (b.usuario?.nome || '').toLowerCase();
      } else if (sortKey === 'expediente') {
        va = a.horaInicioExpediente;
        vb = b.horaInicioExpediente;
      } else {
        va = a.horaInicioAlmoco;
        vb = b.horaInicioAlmoco;
      }
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [personalizados, sortKey, sortDir]);

  const carregar = () => {
    setLoading(true);
    Promise.all([
      horarioService.getDefault(),
      horarioService.findAll(),
      dashboardService.getTecnicos(),
    ])
      .then(([def, pers, tecs]) => {
        setDefaultHorario(def);
        setDefIni(def.horaInicioExpediente);
        setDefFim(def.horaFimExpediente);
        setDefAlmIni(def.horaInicioAlmoco);
        setDefAlmFim(def.horaFimAlmoco);
        setPersonalizados(pers);
        setTecnicos(tecs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(carregar, []);

  const salvarDefault = async () => {
    setSaving(true);
    try {
      await horarioService.updateDefault({
        horaInicioExpediente: defIni,
        horaFimExpediente: defFim,
        horaInicioAlmoco: defAlmIni,
        horaFimAlmoco: defAlmFim,
      });
      setMsg('Horario padrao salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { /* */ }
    setSaving(false);
  };

  const iniciarEdicao = (h: HorarioTrabalho) => {
    setEditingUserId(h.usuarioId);
    setNovoUsuarioId(h.usuarioId || '');
    setNovoIni(h.horaInicioExpediente);
    setNovoFim(h.horaFimExpediente);
    setNovoAlmIni(h.horaInicioAlmoco);
    setNovoAlmFim(h.horaFimAlmoco);
    setShowForm(true);
  };

  const cancelarForm = () => {
    setShowForm(false);
    setEditingUserId(null);
    setNovoUsuarioId('');
    setNovoIni('08:00');
    setNovoFim('17:00');
    setNovoAlmIni('12:00');
    setNovoAlmFim('13:00');
  };

  const salvarPersonalizado = async () => {
    if (!novoUsuarioId) return;
    setSaving(true);
    try {
      await horarioService.upsert({
        usuarioId: novoUsuarioId,
        horaInicioExpediente: novoIni,
        horaFimExpediente: novoFim,
        horaInicioAlmoco: novoAlmIni,
        horaFimAlmoco: novoAlmFim,
      });
      cancelarForm();
      carregar();
      setMsg('Horario personalizado salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch { /* */ }
    setSaving(false);
  };

  const remover = async (usuarioId: string) => {
    if (!confirm('Remover horario personalizado? O tecnico usara o padrao do sistema.')) return;
    try {
      await horarioService.remove(usuarioId);
      carregar();
    } catch { /* */ }
  };

  // Tecnicos que ainda não possuem horário personalizado
  const tecnicosDisponiveis = tecnicos.filter(
    (t) => !personalizados.some((p) => p.usuarioId === t.id),
  );

  if (loading) {
    return (
      <>
        <Header title="Horarios de Trabalho" />
        <div className="p-6 text-center text-slate-500">Carregando...</div>
      </>
    );
  }

  return (
    <>
      <Header title="Horarios de Trabalho" />
      <main className="p-6 space-y-6 max-w-4xl">
        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
            {msg}
          </div>
        )}

        {/* Default do Sistema */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-capul-600" />
            <h2 className="text-base font-semibold text-slate-800">Horario Padrao do Sistema</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Aplicado automaticamente a todos os tecnicos que nao possuem horario personalizado.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Inicio Expediente</label>
              <input
                type="time"
                value={defIni}
                onChange={(e) => setDefIni(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fim Expediente</label>
              <input
                type="time"
                value={defFim}
                onChange={(e) => setDefFim(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Inicio Almoco</label>
              <input
                type="time"
                value={defAlmIni}
                onChange={(e) => setDefAlmIni(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fim Almoco</label>
              <input
                type="time"
                value={defAlmFim}
                onChange={(e) => setDefAlmFim(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Horas uteis: {(() => {
                const parseH = (s: string) => { const [h, m] = s.split(':').map(Number); return h + m / 60; };
                const uteis = (parseH(defFim) - parseH(defIni)) - (parseH(defAlmFim) - parseH(defAlmIni));
                return `${uteis.toFixed(1)}h/dia`;
              })()}
            </span>
            <button
              onClick={salvarDefault}
              disabled={saving}
              className="flex items-center gap-2 bg-capul-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-capul-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salvar Padrao
            </button>
          </div>
        </div>

        {/* Horários Personalizados */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-semibold text-slate-800">Horarios Personalizados</h2>
            </div>
            {(tecnicosDisponiveis.length > 0 || editingUserId) && (
              <button
                onClick={() => { cancelarForm(); setShowForm(true); }}
                className="flex items-center gap-1 text-sm text-capul-600 hover:text-capul-800"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            )}
          </div>

          {/* Form novo */}
          {showForm && (
            <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-200">
              <h4 className="text-xs font-semibold text-slate-600 mb-3">{editingUserId ? 'Editar Horario' : 'Novo Horario Personalizado'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tecnico</label>
                  {editingUserId ? (
                    <div className="w-full border border-slate-200 bg-slate-100 rounded-lg px-3 py-2 text-sm text-slate-700">
                      {personalizados.find((p) => p.usuarioId === editingUserId)?.usuario?.nome || 'Tecnico'}
                    </div>
                  ) : (
                    <select
                      value={novoUsuarioId}
                      onChange={(e) => setNovoUsuarioId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-capul-500"
                    >
                      <option value="">Selecione...</option>
                      {tecnicosDisponiveis.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Inicio</label>
                  <input type="time" value={novoIni} onChange={(e) => setNovoIni(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Fim</label>
                  <input type="time" value={novoFim} onChange={(e) => setNovoFim(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Almoco Ini</label>
                  <input type="time" value={novoAlmIni} onChange={(e) => setNovoAlmIni(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Almoco Fim</label>
                  <input type="time" value={novoAlmFim} onChange={(e) => setNovoAlmFim(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 mt-3 justify-end">
                <button onClick={cancelarForm}
                  className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
                  Cancelar
                </button>
                <button onClick={salvarPersonalizado} disabled={!novoUsuarioId || saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <Save className="w-3.5 h-3.5" /> Salvar
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          {personalizados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              Nenhum horario personalizado. Todos os tecnicos usam o padrao do sistema.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-2 px-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <div className="flex-1"><button onClick={() => toggleSort('nome')} className="flex items-center gap-1 hover:text-slate-700">Tecnico <SortIcon col="nome" /></button></div>
                <div className="w-48"><button onClick={() => toggleSort('expediente')} className="flex items-center gap-1 hover:text-slate-700">Expediente <SortIcon col="expediente" /></button></div>
                <div className="w-40"><button onClick={() => toggleSort('almoco')} className="flex items-center gap-1 hover:text-slate-700">Almoco <SortIcon col="almoco" /></button></div>
                <div className="w-20 text-right">Acoes</div>
              </div>
              <div className="space-y-2">
                {sortedPersonalizados.map((h) => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <button onClick={() => iniciarEdicao(h)} className="text-sm font-medium text-capul-600 hover:underline text-left">{h.usuario?.nome || 'Usuario'}</button>
                        <p className="text-xs text-slate-400">{h.usuario?.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-xs text-slate-600 space-x-3">
                        <span>Expediente: <strong>{h.horaInicioExpediente}–{h.horaFimExpediente}</strong></span>
                        <span>Almoco: <strong>{h.horaInicioAlmoco}–{h.horaFimAlmoco}</strong></span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => iniciarEdicao(h)}
                          className="text-slate-400 hover:text-capul-600 transition-colors"
                          title="Editar horario"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => h.usuarioId && remover(h.usuarioId)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Remover (voltar ao padrao)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
