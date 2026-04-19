import { Injectable } from '@nestjs/common';
import type { SituacaoCadastral, TipoSincronizacao } from '@prisma/client';

export interface DigestInput {
  execucao: {
    id: string;
    tipo: TipoSincronizacao;
    iniciadoEm: Date;
    finalizadoEm: Date;
    totalContribuintes: number;
    sucessos: number;
    erros: number;
    errosPorUf: Record<string, number>;
    ambiente: string;
  };
  mudancasSituacao: Array<{
    cnpj: string;
    razaoSocial: string | null;
    uf: string;
    situacaoAnterior: SituacaoCadastral | null;
    situacaoNova: SituacaoCadastral;
    origemProtheus: string | null;
    codigoProtheus: string | null;
    lojaProtheus: string | null;
  }>;
  resumoStatus: Record<SituacaoCadastral, number>;
  fallback: boolean;
}

const TIPO_LABEL: Record<TipoSincronizacao, string> = {
  MOVIMENTO_MEIO_DIA: 'Movimento — meio-dia',
  MOVIMENTO_MANHA_SEGUINTE: 'Movimento — manhã seguinte',
  MANUAL: 'Sincronização manual',
  PONTUAL: 'Consulta pontual',
};

const SITUACAO_LABEL: Record<SituacaoCadastral, string> = {
  HABILITADO: 'Habilitado',
  NAO_HABILITADO: 'Não habilitado',
  SUSPENSO: 'Suspenso',
  INAPTO: 'Inapto',
  BAIXADO: 'Baixado',
  DESCONHECIDO: 'Desconhecido',
};

const SITUACAO_COLOR: Record<SituacaoCadastral, string> = {
  HABILITADO: '#16a34a',
  NAO_HABILITADO: '#dc2626',
  SUSPENSO: '#d97706',
  INAPTO: '#dc2626',
  BAIXADO: '#64748b',
  DESCONHECIDO: '#64748b',
};

@Injectable()
export class DigestTemplate {
  /**
   * Gera HTML inline-styled do e-mail digest consolidado.
   * Inline CSS porque clientes de e-mail corporativo (Outlook, etc.) não
   * respeitam <style> externo.
   */
  renderHtml(input: DigestInput): string {
    const duracaoMin = Math.round(
      (input.execucao.finalizadoEm.getTime() - input.execucao.iniciadoEm.getTime()) / 60000,
    );

    const errosPorUfHtml = Object.entries(input.execucao.errosPorUf)
      .filter(([, n]) => n > 0)
      .map(([uf, n]) => `<li><strong>${uf}</strong>: ${n} erro(s)</li>`)
      .join('');

    const mudancasHtml =
      input.mudancasSituacao.length > 0
        ? input.mudancasSituacao
            .map(
              (m) => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${this.formatCnpj(m.cnpj)}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${m.razaoSocial ?? '-'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${m.uf}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#64748b">${m.situacaoAnterior ? SITUACAO_LABEL[m.situacaoAnterior] : '-'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:${SITUACAO_COLOR[m.situacaoNova]};font-weight:600">${SITUACAO_LABEL[m.situacaoNova]}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:11px">${m.origemProtheus ?? '-'} ${m.codigoProtheus ? `${m.codigoProtheus}/${m.lojaProtheus}` : ''}</td>
            </tr>`,
            )
            .join('')
        : `<tr><td colspan="6" style="padding:20px;text-align:center;color:#64748b">Nenhuma mudança de situação detectada nesta execução.</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;margin:0;padding:20px">
  <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <div style="background:#0f172a;color:#fff;padding:20px 28px">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8">Plataforma Capul — Módulo Fiscal</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">Digest de Cruzamento</div>
      <div style="font-size:13px;color:#cbd5e1;margin-top:6px">${TIPO_LABEL[input.execucao.tipo]} • ${input.execucao.ambiente}</div>
    </div>

    ${input.fallback ? `<div style="background:#fef3c7;color:#92400e;padding:12px 28px;font-size:13px;border-bottom:1px solid #fde68a">⚠ Nenhum usuário com a role GESTOR_FISCAL ativo no momento do envio. Este e-mail foi direcionado ao endereço de fallback. Configure destinatários no Configurador.</div>` : ''}

    <div style="padding:24px 28px">
      <h3 style="margin:0 0 12px 0;font-size:14px;color:#334155;text-transform:uppercase;letter-spacing:0.5px">Resumo da execução</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <tr>
          <td style="padding:6px 0;color:#64748b">Início</td>
          <td style="padding:6px 0;text-align:right">${input.execucao.iniciadoEm.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b">Fim</td>
          <td style="padding:6px 0;text-align:right">${input.execucao.finalizadoEm.toLocaleString('pt-BR')} (${duracaoMin} min)</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b">Contribuintes processados</td>
          <td style="padding:6px 0;text-align:right;font-weight:600">${input.execucao.totalContribuintes.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b">Sucessos</td>
          <td style="padding:6px 0;text-align:right;color:#16a34a">${input.execucao.sucessos.toLocaleString('pt-BR')}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b">Erros</td>
          <td style="padding:6px 0;text-align:right;color:${input.execucao.erros > 0 ? '#dc2626' : '#64748b'}">${input.execucao.erros.toLocaleString('pt-BR')}</td>
        </tr>
      </table>

      <h3 style="margin:0 0 12px 0;font-size:14px;color:#334155;text-transform:uppercase;letter-spacing:0.5px">Status consolidado</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        ${Object.entries(input.resumoStatus)
          .map(
            ([situacao, count]) => `<tr>
              <td style="padding:6px 0;color:${SITUACAO_COLOR[situacao as SituacaoCadastral]};font-weight:500">${SITUACAO_LABEL[situacao as SituacaoCadastral]}</td>
              <td style="padding:6px 0;text-align:right;font-weight:600">${count.toLocaleString('pt-BR')}</td>
            </tr>`,
          )
          .join('')}
      </table>

      ${
        errosPorUfHtml
          ? `<h3 style="margin:0 0 12px 0;font-size:14px;color:#334155;text-transform:uppercase;letter-spacing:0.5px">Erros por UF</h3>
        <ul style="font-size:13px;color:#475569;margin:0 0 24px 0;padding-left:20px">${errosPorUfHtml}</ul>`
          : ''
      }

      <h3 style="margin:0 0 12px 0;font-size:14px;color:#334155;text-transform:uppercase;letter-spacing:0.5px">Mudanças de situação (${input.mudancasSituacao.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f1f5f9;text-align:left">
            <th style="padding:8px 10px;font-weight:600;color:#475569">CNPJ</th>
            <th style="padding:8px 10px;font-weight:600;color:#475569">Razão social</th>
            <th style="padding:8px 10px;font-weight:600;color:#475569;text-align:center">UF</th>
            <th style="padding:8px 10px;font-weight:600;color:#475569">Anterior</th>
            <th style="padding:8px 10px;font-weight:600;color:#475569">Atual</th>
            <th style="padding:8px 10px;font-weight:600;color:#475569">Protheus</th>
          </tr>
        </thead>
        <tbody>${mudancasHtml}</tbody>
      </table>
    </div>

    <div style="background:#f8fafc;padding:16px 28px;font-size:11px;color:#64748b;border-top:1px solid #e5e7eb">
      Execução #${input.execucao.id.slice(0, 8)} • Enviado automaticamente pela Plataforma Capul.
      Para alterar destinatários, atribua/remova a role GESTOR_FISCAL no Configurador.
    </div>
  </div>
</body>
</html>`;
  }

  renderText(input: DigestInput): string {
    const lines = [
      `DIGEST DE CRUZAMENTO — ${TIPO_LABEL[input.execucao.tipo]}`,
      `Ambiente: ${input.execucao.ambiente}`,
      ``,
      `Iniciado em: ${input.execucao.iniciadoEm.toLocaleString('pt-BR')}`,
      `Finalizado em: ${input.execucao.finalizadoEm.toLocaleString('pt-BR')}`,
      `Total: ${input.execucao.totalContribuintes}  Sucessos: ${input.execucao.sucessos}  Erros: ${input.execucao.erros}`,
      ``,
      `Mudanças de situação: ${input.mudancasSituacao.length}`,
    ];
    for (const m of input.mudancasSituacao.slice(0, 50)) {
      lines.push(
        `  ${this.formatCnpj(m.cnpj)} (${m.uf}) ${m.razaoSocial ?? ''} — ${m.situacaoAnterior ? SITUACAO_LABEL[m.situacaoAnterior] : '-'} → ${SITUACAO_LABEL[m.situacaoNova]}`,
      );
    }
    if (input.mudancasSituacao.length > 50) {
      lines.push(`  ... e mais ${input.mudancasSituacao.length - 50} mudança(s). Ver e-mail HTML.`);
    }
    return lines.join('\n');
  }

  private formatCnpj(cnpj: string): string {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}
