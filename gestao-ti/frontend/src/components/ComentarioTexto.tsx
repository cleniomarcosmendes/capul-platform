import { Paperclip } from 'lucide-react';
import type { AnexoChamado } from '../types';

/**
 * Renderiza o texto de um comentário, substituindo marcadores
 * `[anexo:<uuid>]` por chips clicáveis que abrem o download.
 *
 * Padrão "chat-style" decidido em 13/05/2026 — anexos do comentário
 * são gravados em AnexoChamado (vinculados ao chamado, não ao comentário)
 * e a referência fica via marcador no texto. Ver memory
 * `project_chamado_layout_chat_13mai`.
 */
export function ComentarioTexto({
  texto,
  anexos,
  onDownload,
}: {
  texto: string;
  anexos: AnexoChamado[];
  onDownload: (anexo: AnexoChamado) => void;
}) {
  // Cada parte pode ser: texto puro, anexo existente, ou marcador órfão
  // (anexo foi removido da sidebar e o link ficou "perdido" no comentário).
  type Parte = string | { tipo: 'anexo'; anexo: AnexoChamado } | { tipo: 'orfao' };
  const partes: Parte[] = [];
  const regex = /\[anexo:([a-f0-9-]{36})\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(texto)) !== null) {
    if (match.index > lastIndex) {
      partes.push(texto.slice(lastIndex, match.index));
    }
    const anexo = anexos.find((a) => a.id === match![1]);
    if (anexo) {
      partes.push({ tipo: 'anexo', anexo });
    } else {
      // Anexo removido (sidebar) — exibe chip muted "anexo removido" em vez
      // de mostrar o marcador cru `[anexo:uuid]` como texto (decisão 14/05/2026).
      partes.push({ tipo: 'orfao' });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < texto.length) {
    partes.push(texto.slice(lastIndex));
  }

  return (
    <span className="whitespace-pre-wrap">
      {partes.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        if (p.tipo === 'orfao') {
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 border border-slate-200 text-xs italic line-through decoration-slate-300"
              title="O anexo referenciado foi removido"
            >
              <Paperclip className="w-3 h-3" />
              anexo removido
            </span>
          );
        }
        const a = p.anexo;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onDownload(a)}
            className="inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md bg-capul-50 text-capul-700 border border-capul-200 text-xs hover:bg-capul-100 transition-colors"
            title={`Baixar ${a.nomeOriginal}`}
          >
            <Paperclip className="w-3 h-3" />
            {a.nomeOriginal}
          </button>
        );
      })}
    </span>
  );
}
