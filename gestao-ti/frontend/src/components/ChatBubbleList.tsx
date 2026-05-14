import { useState } from 'react';
import type { ReactNode } from 'react';
import { Bell, Check, Edit3, Paperclip, RotateCcw } from 'lucide-react';

/**
 * Extrai marcadores [anexo:uuid] do texto pra protegê-los na edição.
 * O usuário não enxerga/edita os marcadores no textarea — eles voltam
 * intactos ao final do texto no save (a posição inline original é
 * perdida, mas o link nunca quebra). Decidido em 14/05/2026 a pedido
 * do setor de suporte.
 *
 * Quando `validAnexoIds` é passado, marcadores cujo UUID não consta
 * (órfãos — anexo deletado da sidebar) são silenciosamente descartados
 * pra limpar o comentário no próximo save.
 */
function extractAnexoMarkers(texto: string, validAnexoIds?: Set<string>): { textOnly: string; markers: string[] } {
  const regex = /\[anexo:([a-f0-9-]{36})\]/gi;
  const all: { full: string; id: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    all.push({ full: m[0], id: m[1] });
  }
  const markers = validAnexoIds
    ? all.filter((x) => validAnexoIds.has(x.id)).map((x) => x.full)
    : all.map((x) => x.full);
  const textOnly = texto
    .replace(/\[anexo:[a-f0-9-]{36}\]/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
  return { textOnly, markers };
}

/**
 * Componente reutilizável que renderiza um histórico de eventos no estilo
 * WhatsApp:
 *   - **Mensagens minhas** (autor = currentUserId): alinhadas à DIREITA, fundo cor verde-claro
 *   - **Mensagens dos outros**: alinhadas à ESQUERDA, fundo cor cinza-claro
 *   - **Eventos especiais** (SOLICITACAO_INFO, RETOMADA_USUARIO): bubble destacada (âmbar/azul) cobrindo a largura toda, com ícone
 *   - **Eventos de sistema** (ABERTURA, ASSUMIDO, RESOLVIDO, transferências, etc.): divisor centralizado em texto cinza
 *
 * Atualmente usado em ChamadoDetalhePage e ProjetoDetalhePage. Item do
 * backlog 25/04/2026 ("Bubbles WhatsApp") implementado em 29/04/2026 junto
 * com o status PENDENTE_USUARIO.
 */

export interface ChatEvent {
  id: string;
  tipo: string;
  descricao: string;
  usuarioId: string;
  usuario: { id: string; nome: string; username?: string };
  publico?: boolean;
  createdAt: string;
  /** Metadados específicos opcionais (transferência, etc.) */
  equipeOrigem?: { sigla: string } | null;
  equipeDestino?: { sigla: string } | null;
  tecnicoOrigem?: { nome: string } | null;
  tecnicoDestino?: { nome: string } | null;
}

export interface ChatBubbleListProps {
  eventos: ChatEvent[];
  currentUserId: string;
  /** Tipos que viram bubbles (default: COMENTARIO). Demais viram divisor. */
  bubbleTypes?: string[];
  /** Tipos especiais que ganham bubble destacada (default: SOLICITACAO_INFO, RETOMADA_USUARIO). */
  highlightTypes?: string[];
  /**
   * Labels customizadas para tipos de sistema (divisores). Default cobre os
   * tipos de chamado (ABERTURA, ASSUMIDO, etc.). Em 13/05/2026 virou prop
   * para que pendência (tipos STATUS_ALTERADO, RESPONSAVEL_ALTERADO, ANEXO)
   * possa injetar suas próprias labels.
   */
  systemLabels?: Record<string, string>;
  /** Resolve papel do autor pra exibir badge (Solicitante, Técnico, etc.). */
  getPapel?: (usuarioId: string) => { label: string; cls: string } | null;
  /** Permite editar bubble. Recebe id + novo texto. */
  onEditComentario?: (id: string, novoTexto: string) => Promise<void>;
  /** Verifica se o usuário corrente pode editar este evento específico. */
  canEdit?: (evento: ChatEvent) => boolean;
  /**
   * Renderer customizado da descrição do comentário. Usado em 13/05/2026
   * para parsear marcadores `[anexo:uuid]` em chips clicáveis. Se omitido,
   * renderiza descricao como texto puro (comportamento legado).
   *
   * O segundo argumento `eventId` foi adicionado em 14/05/2026 pra permitir
   * lookups exatos por id (antes era find-by-descricao, ambíguo quando dois
   * comentários têm texto idêntico).
   */
  renderTexto?: (descricao: string, eventId: string) => React.ReactNode;
  /**
   * IDs de anexos vivos. Quando passado, marcadores [anexo:uuid] órfãos
   * (anexo já removido da sidebar) são silenciosamente removidos no save
   * da edição — o chip "anexo removido" some quando o usuário re-salva.
   */
  validAnexoIds?: Set<string>;
}

const SYSTEM_LABELS: Record<string, string> = {
  ABERTURA: 'Chamado aberto',
  ASSUMIDO: 'Chamado assumido',
  TRANSFERENCIA_EQUIPE: 'Transferência de equipe',
  TRANSFERENCIA_TECNICO: 'Transferência de técnico',
  RESOLVIDO: 'Chamado resolvido',
  FECHADO: 'Chamado fechado',
  REABERTO: 'Chamado reaberto',
  CANCELADO: 'Chamado cancelado',
  AVALIADO: 'Avaliação registrada',
};

export function ChatBubbleList({
  eventos,
  currentUserId,
  bubbleTypes = ['COMENTARIO'],
  highlightTypes = ['SOLICITACAO_INFO', 'RETOMADA_USUARIO'],
  systemLabels,
  getPapel,
  onEditComentario,
  canEdit,
  renderTexto,
  validAnexoIds,
}: ChatBubbleListProps) {
  // Merge: labels customizadas sobrescrevem default. Default cobre o
  // chamado; pendência pode injetar STATUS_ALTERADO, RESPONSAVEL_ALTERADO,
  // ANEXO, etc.
  const labels: Record<string, string> = { ...SYSTEM_LABELS, ...(systemLabels ?? {}) };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTexto, setEditingTexto] = useState('');
  // Marcadores [anexo:uuid] preservados — re-anexados ao texto editado no save.
  const [editingMarkers, setEditingMarkers] = useState<string[]>([]);

  if (eventos.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-6">Nenhum evento</p>;
  }

  const fmtDataHora = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return (
    <div className="space-y-3">
      {eventos.map((ev) => {
        if (highlightTypes.includes(ev.tipo)) {
          return <HighlightBubble key={ev.id} ev={ev} fmtDataHora={fmtDataHora} />;
        }
        if (!bubbleTypes.includes(ev.tipo)) {
          return <SystemDivider key={ev.id} ev={ev} fmtDataHora={fmtDataHora} labels={labels} />;
        }
        const isMine = ev.usuarioId === currentUserId;
        const papel = getPapel?.(ev.usuarioId) ?? null;
        const editable = canEdit?.(ev) ?? false;
        const isEditing = editingId === ev.id;
        return (
          <Bubble
            key={ev.id}
            ev={ev}
            isMine={isMine}
            papel={papel}
            editable={editable}
            isEditing={isEditing}
            editingTexto={editingTexto}
            setEditingTexto={setEditingTexto}
            editingMarkersCount={editingMarkers.length}
            onStartEdit={() => {
              setEditingId(ev.id);
              const { textOnly, markers } = extractAnexoMarkers(ev.descricao, validAnexoIds);
              setEditingTexto(textOnly);
              setEditingMarkers(markers);
            }}
            onCancelEdit={() => { setEditingId(null); setEditingMarkers([]); }}
            onSaveEdit={async () => {
              if (!editingTexto.trim() && editingMarkers.length === 0) return;
              if (!onEditComentario) return;
              // Re-anexa marcadores intactos ao final do texto (posição inline
              // original é perdida, mas o link nunca quebra).
              const finalText = editingMarkers.length > 0
                ? `${editingTexto.trim()}${editingTexto.trim() ? ' ' : ''}${editingMarkers.join(' ')}`
                : editingTexto;
              await onEditComentario(ev.id, finalText);
              setEditingId(null);
              setEditingMarkers([]);
            }}
            fmtDataHora={fmtDataHora}
            renderTexto={renderTexto}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// Bubble: comentário regular (esquerda/direita por autor)
// ============================================================

interface BubbleProps {
  ev: ChatEvent;
  isMine: boolean;
  papel: { label: string; cls: string } | null;
  editable: boolean;
  isEditing: boolean;
  editingTexto: string;
  setEditingTexto: (s: string) => void;
  editingMarkersCount: number;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  fmtDataHora: (s: string) => string;
  renderTexto?: (descricao: string, eventId: string) => React.ReactNode;
}

function Bubble({
  ev,
  isMine,
  papel,
  editable,
  isEditing,
  editingTexto,
  setEditingTexto,
  editingMarkersCount,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  fmtDataHora,
  renderTexto,
}: BubbleProps) {
  const align = isMine ? 'justify-end' : 'justify-start';
  const bubbleColor = isMine
    ? 'bg-emerald-50 border-emerald-200 text-slate-800'
    : 'bg-slate-50 border-slate-200 text-slate-800';
  // Em edição a bolha expande pra usar a área disponível — antes ficava
  // travada em 80% e o textarea saía espremido (pedido suporte 14/05/2026).
  // Em exibição normal a bolha vai até 92% (era 80%) — aproveita o espaço
  // do lado oposto sem perder a pista visual de direção (8% de respiro).
  const widthCls = isEditing ? 'w-full max-w-[95%] sm:min-w-[480px]' : 'max-w-[92%]';
  return (
    <div className={`flex ${align} group/comment`}>
      <div className={`${widthCls} border rounded-2xl px-3.5 py-2 ${bubbleColor} ${isMine ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <span className="text-xs font-medium text-slate-700">{ev.usuario.nome}</span>
          {papel && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${papel.cls}`}>
              {papel.label}
            </span>
          )}
          {ev.publico === false && (
            <span className="text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
              INTERNO
            </span>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-2">
            {editingMarkersCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white/60 border border-slate-200 rounded-md px-2 py-1">
                <Paperclip className="w-3 h-3 flex-shrink-0" />
                <span>
                  {editingMarkersCount} anexo{editingMarkersCount > 1 ? 's' : ''} preservado{editingMarkersCount > 1 ? 's' : ''} — gerencie pela barra lateral
                </span>
              </div>
            )}
            <textarea
              value={editingTexto}
              onChange={(e) => setEditingTexto(e.target.value)}
              rows={5}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-capul-500 focus:border-capul-500 resize-y"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onSaveEdit}
                disabled={!editingTexto.trim() && editingMarkersCount === 0}
                className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg disabled:opacity-50"
              >
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button onClick={onCancelEdit} className="text-xs text-slate-500 hover:text-slate-700">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="text-sm flex-1">
              {renderTexto ? renderTexto(ev.descricao, ev.id) : <span className="whitespace-pre-wrap">{ev.descricao}</span>}
            </div>
            {editable && (
              <button
                onClick={onStartEdit}
                className="opacity-0 group-hover/comment:opacity-100 text-slate-300 hover:text-capul-600 transition-all p-0.5 flex-shrink-0"
                title="Editar"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <div className="text-[10px] text-slate-400 mt-1 text-right">
          {fmtDataHora(ev.createdAt)}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HighlightBubble: SOLICITACAO_INFO / RETOMADA_USUARIO em destaque
// ============================================================

function HighlightBubble({ ev, fmtDataHora }: { ev: ChatEvent; fmtDataHora: (s: string) => string }) {
  const isSolicitacao = ev.tipo === 'SOLICITACAO_INFO';
  const Icon = isSolicitacao ? Bell : RotateCcw;
  const cls = isSolicitacao
    ? 'bg-amber-50 border-amber-300 text-amber-900'
    : 'bg-blue-50 border-blue-300 text-blue-900';
  const titulo = isSolicitacao ? 'Solicitação de informações' : 'Solicitante respondeu';
  return (
    <div className="flex justify-center">
      <div className={`max-w-full w-full border rounded-xl px-4 py-2.5 ${cls} flex items-start gap-3`}>
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-semibold">{titulo}</span>
            <span className="text-[10px]">por {ev.usuario.nome}</span>
            <span className="text-[10px] opacity-70 ml-auto">{fmtDataHora(ev.createdAt)}</span>
          </div>
          <p className="text-sm mt-0.5">{ev.descricao}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SystemDivider: ABERTURA, ASSUMIDO, transferências, RESOLVIDO etc.
// ============================================================

// Tipos onde o usuário escreve um texto relevante (motivo do cancelamento,
// observação ao finalizar, comentário da avaliação, etc) — para esses, o
// divisor exibe a descrição abaixo. Antes era só ABERTURA/ASSUMIDO genéricos
// e a descrição ficava invisível (descoberto 29/04 com pessoal reportando
// que texto do "Finalizar Chamado" sumia da timeline).
const TIPOS_COM_DESCRICAO_RELEVANTE = new Set([
  'RESOLVIDO',
  'FECHADO',
  'CANCELADO',
  'REABERTO',
  'AVALIADO',
]);

// Descrições "default" geradas pelo backend quando o usuário não digita nada.
// Quando descrição == um destes valores, é texto autogerado e não vale exibir
// (já está no label do divisor). Apenas user-provided text aparece como nota.
const DESCRICOES_AUTOGERADAS = new Set([
  'Chamado finalizado',
  'Chamado fechado',
  'Chamado cancelado',
  'Chamado reaberto',
  'Chamado assumido',
  'Chamado criado',
  'Avaliação registrada',
]);

function SystemDivider({ ev, fmtDataHora, labels }: { ev: ChatEvent; fmtDataHora: (s: string) => string; labels: Record<string, string> }) {
  const label = labels[ev.tipo] ?? ev.tipo;
  let extra: ReactNode = null;
  if (ev.tipo === 'TRANSFERENCIA_EQUIPE' && ev.equipeOrigem && ev.equipeDestino) {
    extra = ` (${ev.equipeOrigem.sigla} → ${ev.equipeDestino.sigla})`;
  } else if (ev.tipo === 'TRANSFERENCIA_TECNICO' && ev.tecnicoOrigem && ev.tecnicoDestino) {
    extra = ` (${ev.tecnicoOrigem.nome} → ${ev.tecnicoDestino.nome})`;
  }

  // Descrição relevante = tipo está na lista E descricao é texto user-provided
  const mostraDescricao =
    TIPOS_COM_DESCRICAO_RELEVANTE.has(ev.tipo) &&
    ev.descricao &&
    ev.descricao.trim().length > 0 &&
    !DESCRICOES_AUTOGERADAS.has(ev.descricao.trim());

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="bg-slate-100 border border-slate-200 rounded-full px-3 py-1 text-[11px] text-slate-500 flex items-center gap-2">
        <span className="font-medium">{label}</span>
        {extra}
        <span className="opacity-70">·</span>
        <span>{ev.usuario.nome}</span>
        <span className="opacity-70">·</span>
        <span>{fmtDataHora(ev.createdAt)}</span>
      </div>
      {mostraDescricao && (
        <div className="max-w-[80%] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 whitespace-pre-wrap">
          {ev.descricao}
        </div>
      )}
    </div>
  );
}
