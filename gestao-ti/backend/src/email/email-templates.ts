/**
 * Templates HTML simples para os e-mails transacionais de chamado/projeto.
 * Mantidos como string literal — nada de Handlebars/MJML por enquanto.
 */

const BASE_URL = process.env.PLATFORM_BASE_URL || 'https://localhost';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type ItemTipo = 'chamado' | 'pendência' | 'atividade';

const ITEM_ARTIGO: Record<ItemTipo, string> = {
  chamado: 'do chamado',
  pendência: 'da pendência',
  atividade: 'da atividade',
};

function layout(
  titulo: string,
  conteudo: string,
  linkUrl: string,
  linkLabel: string,
  itemTipo: ItemTipo,
): string {
  const aviso = `Este e-mail mostra apenas esta interação. Para acompanhar o histórico completo ${ITEM_ARTIGO[itemTipo]}, abra o item.`;
  return `<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
    <div style="background: #0e7490; color: #fff; padding: 16px 24px;">
      <h1 style="margin: 0; font-size: 16px; font-weight: 600;">Capul Platform · Gestão de TI</h1>
    </div>
    <div style="padding: 24px;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">${escapeHtml(titulo)}</h2>
      ${conteudo}
      <p style="margin: 20px 0 0; color: #64748b; font-size: 12px; font-style: italic;">${escapeHtml(aviso)}</p>
      <div style="margin-top: 12px;">
        <a href="${linkUrl}" style="display: inline-block; background: #0e7490; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500;">${escapeHtml(linkLabel)}</a>
      </div>
    </div>
    <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
      Você está recebendo este e-mail porque é um dos envolvidos.
      <br/>Para gerenciar suas preferências, acesse <a href="${BASE_URL}/perfil" style="color: #0e7490;">Meu Perfil</a>.
    </div>
  </div>
</body></html>`;
}

export function chamadoComentario(args: {
  numero: number;
  titulo: string;
  autor: string;
  comentario: string;
  chamadoId: string;
}): string {
  const snippet = args.comentario.length > 400 ? args.comentario.slice(0, 400) + '…' : args.comentario;
  return layout(
    `Novo comentário no chamado #${args.numero}`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">por ${escapeHtml(args.autor)}</p>
     <div style="background: #f1f5f9; border-left: 3px solid #0e7490; padding: 12px 16px; border-radius: 4px; color: #1e293b; white-space: pre-wrap;">${escapeHtml(snippet)}</div>`,
    `${BASE_URL}/gestao-ti/chamados/${args.chamadoId}`,
    'Abrir chamado',
    'chamado',
  );
}

export function chamadoStatus(args: {
  numero: number;
  titulo: string;
  autor: string;
  statusAnterior: string;
  statusNovo: string;
  chamadoId: string;
}): string {
  return layout(
    `Status do chamado #${args.numero} alterado`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">alterado por ${escapeHtml(args.autor)}</p>
     <p style="margin: 0; color: #1e293b;">
       <span style="background: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 13px;">${escapeHtml(args.statusAnterior)}</span>
       <span style="color: #64748b; margin: 0 8px;">→</span>
       <span style="background: #cffafe; color: #0e7490; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600;">${escapeHtml(args.statusNovo)}</span>
     </p>`,
    `${BASE_URL}/gestao-ti/chamados/${args.chamadoId}`,
    'Abrir chamado',
    'chamado',
  );
}

export function chamadoAtribuicao(args: {
  numero: number;
  titulo: string;
  autor: string;
  tecnico: string;
  chamadoId: string;
}): string {
  return layout(
    `Chamado #${args.numero} atribuído`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">atribuído por ${escapeHtml(args.autor)}</p>
     <p style="margin: 0; color: #1e293b;">Técnico responsável: <strong>${escapeHtml(args.tecnico)}</strong></p>`,
    `${BASE_URL}/gestao-ti/chamados/${args.chamadoId}`,
    'Abrir chamado',
    'chamado',
  );
}

export function pendenciaCriada(args: {
  numero: number;
  titulo: string;
  projetoNome: string;
  projetoId: string;
  pendenciaId: string;
  criador: string;
  responsavel: string;
  descricao?: string;
}): string {
  const desc = args.descricao && args.descricao.trim()
    ? `<div style="background: #f1f5f9; border-left: 3px solid #0e7490; padding: 12px 16px; border-radius: 4px; color: #1e293b; margin-top: 12px; white-space: pre-wrap;">${escapeHtml(args.descricao.slice(0, 400))}${args.descricao.length > 400 ? '…' : ''}</div>`
    : '';
  return layout(
    `Nova pendência #${args.numero}: ${args.titulo}`,
    `<p style="margin: 0 0 8px; color: #475569;">Projeto: <strong>${escapeHtml(args.projetoNome)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">criada por ${escapeHtml(args.criador)}</p>
     <p style="margin: 0; color: #64748b; font-size: 13px;">responsável: <strong style="color: #0e7490;">${escapeHtml(args.responsavel)}</strong></p>
     ${desc}`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=pendencias&pendenciaId=${args.pendenciaId}`,
    'Abrir pendência',
    'pendência',
  );
}

export function pendenciaComentario(args: {
  numero: number;
  titulo: string;
  projetoNome: string;
  projetoId: string;
  pendenciaId: string;
  autor: string;
  comentario: string;
}): string {
  const snippet = args.comentario.length > 400 ? args.comentario.slice(0, 400) + '…' : args.comentario;
  return layout(
    `Novo comentário na pendência #${args.numero}`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Projeto: ${escapeHtml(args.projetoNome)}</p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">por ${escapeHtml(args.autor)}</p>
     <div style="background: #f1f5f9; border-left: 3px solid #0e7490; padding: 12px 16px; border-radius: 4px; color: #1e293b; white-space: pre-wrap;">${escapeHtml(snippet)}</div>`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=pendencias&pendenciaId=${args.pendenciaId}`,
    'Abrir pendência',
    'pendência',
  );
}

export function atividadeCriada(args: {
  titulo: string;
  projetoNome: string;
  projetoId: string;
  atividadeId: string;
  criador: string;
  responsaveis: string[];
  descricao?: string;
}): string {
  const desc = args.descricao && args.descricao.trim()
    ? `<div style="background: #f1f5f9; border-left: 3px solid #0e7490; padding: 12px 16px; border-radius: 4px; color: #1e293b; margin-top: 12px; white-space: pre-wrap;">${escapeHtml(args.descricao.slice(0, 400))}${args.descricao.length > 400 ? '…' : ''}</div>`
    : '';
  return layout(
    `Nova atividade: ${args.titulo}`,
    `<p style="margin: 0 0 8px; color: #475569;">Projeto: <strong>${escapeHtml(args.projetoNome)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">criada por ${escapeHtml(args.criador)}</p>
     <p style="margin: 0; color: #64748b; font-size: 13px;">responsáveis: <strong style="color: #0e7490;">${escapeHtml(args.responsaveis.join(', '))}</strong></p>
     ${desc}`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=atividades&atividadeId=${args.atividadeId}`,
    'Abrir atividade',
    'atividade',
  );
}

export function atividadeComentario(args: {
  titulo: string;
  projetoNome: string;
  projetoId: string;
  atividadeId: string;
  autor: string;
  comentario: string;
}): string {
  const snippet = args.comentario.length > 400 ? args.comentario.slice(0, 400) + '…' : args.comentario;
  return layout(
    `Nova nota: ${args.titulo}`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Projeto: ${escapeHtml(args.projetoNome)}</p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">por ${escapeHtml(args.autor)}</p>
     <div style="background: #f1f5f9; border-left: 3px solid #0e7490; padding: 12px 16px; border-radius: 4px; color: #1e293b; white-space: pre-wrap;">${escapeHtml(snippet)}</div>`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=atividades&atividadeId=${args.atividadeId}`,
    'Abrir atividade',
    'atividade',
  );
}

export function atividadeStatus(args: {
  titulo: string;
  projetoNome: string;
  projetoId: string;
  atividadeId: string;
  autor: string;
  statusAnterior: string;
  statusNovo: string;
}): string {
  return layout(
    `Atividade — ${args.statusNovo}`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Projeto: ${escapeHtml(args.projetoNome)}</p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">alterado por ${escapeHtml(args.autor)}</p>
     <p style="margin: 0; color: #1e293b;">
       <span style="background: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 13px;">${escapeHtml(args.statusAnterior)}</span>
       <span style="color: #64748b; margin: 0 8px;">→</span>
       <span style="background: #cffafe; color: #0e7490; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600;">${escapeHtml(args.statusNovo)}</span>
     </p>`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=atividades&atividadeId=${args.atividadeId}`,
    'Abrir atividade',
    'atividade',
  );
}

export function pendenciaStatus(args: {
  numero: number;
  titulo: string;
  projetoNome: string;
  projetoId: string;
  pendenciaId: string;
  autor: string;
  statusAnterior: string;
  statusNovo: string;
}): string {
  return layout(
    `Pendência #${args.numero} — ${args.statusNovo}`,
    `<p style="margin: 0 0 8px; color: #475569;"><strong>${escapeHtml(args.titulo)}</strong></p>
     <p style="margin: 0 0 4px; color: #64748b; font-size: 13px;">Projeto: ${escapeHtml(args.projetoNome)}</p>
     <p style="margin: 0 0 16px; color: #64748b; font-size: 13px;">alterado por ${escapeHtml(args.autor)}</p>
     <p style="margin: 0; color: #1e293b;">
       <span style="background: #e2e8f0; padding: 4px 10px; border-radius: 6px; font-size: 13px;">${escapeHtml(args.statusAnterior)}</span>
       <span style="color: #64748b; margin: 0 8px;">→</span>
       <span style="background: #cffafe; color: #0e7490; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600;">${escapeHtml(args.statusNovo)}</span>
     </p>`,
    `${BASE_URL}/gestao-ti/projetos/${args.projetoId}?tab=pendencias&pendenciaId=${args.pendenciaId}`,
    'Abrir pendência',
    'pendência',
  );
}
