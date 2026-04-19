import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { fiscalApi } from '../services/api';
import { PageWrapper } from '../components/PageWrapper';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { extractApiError } from '../utils/errors';

type Criticidade = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
type StatusDiv = 'ABERTA' | 'RESOLVIDA' | 'IGNORADA';

interface Divergencia {
  id: string;
  contribuinteId: string;
  campo: string;
  valorProtheus: string | null;
  valorSefaz: string | null;
  criticidade: Criticidade;
  status: StatusDiv;
  detectadaEm: string;
  resolvidaEm: string | null;
  resolvidaPor: string | null;
  contribuinte: {
    cnpj: string;
    uf: string;
    razaoSocial: string | null;
    situacao: string;
  };
}

interface ListResp {
  total: number;
  take: number;
  skip: number;
  items: Divergencia[];
}

export function DivergenciasListPage() {
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusDiv | ''>('ABERTA');
  const [filtroCriticidade, setFiltroCriticidade] = useState<Criticidade | ''>('');
  const [filtroUf, setFiltroUf] = useState('');
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filtroStatus) params.set('status', filtroStatus);
      if (filtroCriticidade) params.set('criticidade', filtroCriticidade);
      if (filtroUf) params.set('uf', filtroUf);
      const { data: resp } = await fiscalApi.get<ListResp>(`/divergencias?${params.toString()}`);
      setData(resp);
    } catch (err) {
      toast.error('Falha ao carregar divergências', extractApiError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filtroStatus, filtroCriticidade, filtroUf]);

  async function handleAcao(id: string, novoStatus: 'RESOLVIDA' | 'IGNORADA') {
    const ok = await confirm({
      title: novoStatus === 'RESOLVIDA' ? 'Marcar como resolvida?' : 'Ignorar divergência?',
      description:
        novoStatus === 'RESOLVIDA'
          ? 'Confirma que o cadastro do Protheus foi corrigido para bater com o SEFAZ?'
          : 'A divergência ficará arquivada mas não contará como resolvida. Use para falsos positivos.',
      confirmLabel: novoStatus === 'RESOLVIDA' ? 'Resolver' : 'Ignorar',
    });
    if (!ok) return;
    try {
      await fiscalApi.patch(`/divergencias/${id}`, { status: novoStatus });
      toast.success(novoStatus === 'RESOLVIDA' ? 'Divergência resolvida' : 'Divergência ignorada');
      load();
    } catch (err) {
      toast.error('Falha ao atualizar', extractApiError(err));
    }
  }

  return (
    <PageWrapper title="Divergências Protheus × SEFAZ">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Discrepâncias entre o cadastro do Protheus (SA1010/SA2010) e os dados oficiais do SEFAZ
        detectadas no cruzamento cadastral. Alimentada automaticamente pelas corridas 12:00 e
        06:00 e pelos cruzamentos manuais.
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <FilterSelect
          label="Status"
          value={filtroStatus}
          options={[
            { v: '', l: 'Todos' },
            { v: 'ABERTA', l: 'Abertas' },
            { v: 'RESOLVIDA', l: 'Resolvidas' },
            { v: 'IGNORADA', l: 'Ignoradas' },
          ]}
          onChange={(v) => setFiltroStatus(v as StatusDiv | '')}
        />
        <FilterSelect
          label="Criticidade"
          value={filtroCriticidade}
          options={[
            { v: '', l: 'Todas' },
            { v: 'CRITICA', l: 'Crítica' },
            { v: 'ALTA', l: 'Alta' },
            { v: 'MEDIA', l: 'Média' },
            { v: 'BAIXA', l: 'Baixa' },
          ]}
          onChange={(v) => setFiltroCriticidade(v as Criticidade | '')}
        />
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <span className="font-medium">UF:</span>
          <input
            type="text"
            value={filtroUf}
            onChange={(e) => setFiltroUf(e.target.value.toUpperCase().slice(0, 2))}
            maxLength={2}
            placeholder="MG"
            className="w-16 rounded border border-slate-300 px-2 py-1 font-mono uppercase"
          />
        </label>
      </div>

      {loading ? (
        <div className="text-slate-500">Carregando…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          Nenhuma divergência encontrada com os filtros atuais.
        </div>
      ) : (
        <>
          <div className="mb-2 text-xs text-slate-500">
            {data.total} divergência(s) {filtroStatus ? `com status ${filtroStatus}` : 'no total'}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">CNPJ / UF</th>
                  <th className="px-4 py-2">Razão social</th>
                  <th className="px-4 py-2">Campo</th>
                  <th className="px-4 py-2">Protheus</th>
                  <th className="px-4 py-2">SEFAZ</th>
                  <th className="px-4 py-2">Criticidade</th>
                  <th className="px-4 py-2">Detectada</th>
                  <th className="px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100 text-xs">
                    <td className="px-4 py-2 font-mono">
                      {d.contribuinte.cnpj}
                      <span className="ml-1 text-slate-400">/{d.contribuinte.uf}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-800">
                      {d.contribuinte.razaoSocial ?? '-'}
                    </td>
                    <td className="px-4 py-2 font-semibold">{d.campo}</td>
                    <td className="px-4 py-2 text-slate-700">{d.valorProtheus ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-700">{d.valorSefaz ?? '—'}</td>
                    <td className="px-4 py-2">
                      <Badge variant={corCriticidade(d.criticidade)}>{d.criticidade}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(d.detectadaEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">
                      {d.status === 'ABERTA' ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => handleAcao(d.id, 'RESOLVIDA')}>
                            Resolver
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleAcao(d.id, 'IGNORADA')}
                          >
                            Ignorar
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={d.status === 'RESOLVIDA' ? 'green' : 'gray'}>
                          {d.status}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </PageWrapper>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ v: string; l: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <span className="font-medium">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function corCriticidade(c: Criticidade): 'red' | 'yellow' | 'blue' | 'gray' {
  if (c === 'CRITICA') return 'red';
  if (c === 'ALTA') return 'red';
  if (c === 'MEDIA') return 'yellow';
  return 'gray';
}

