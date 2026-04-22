import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

/**
 * Validacao basica de cron (5 campos separados por espaco). A validacao
 * funcional definitiva acontece no service, que tenta instanciar um
 * `CronJob` — se a expressao for invalida ao nivel sintatico do pacote
 * `cron`, a excecao explode ali com mensagem clara.
 *
 * `cronMovimentoManhaSeguinte` aceita null/vazio = cron desabilitado.
 * Desde 22/04/2026 o padrão é desabilitado (janela semanal tornou a 2ª
 * corrida diária redundante).
 */
const CRON_FIELD = /\S+/;
const CRON_PATTERN = new RegExp(
  `^${CRON_FIELD.source}\\s+${CRON_FIELD.source}\\s+${CRON_FIELD.source}\\s+${CRON_FIELD.source}\\s+${CRON_FIELD.source}$`,
);

export class AtualizarCronsDto {
  @IsString()
  @Matches(CRON_PATTERN, {
    message: 'cronMovimentoMeioDia deve ter 5 campos separados por espaco (ex: "0 12 * * *")',
  })
  cronMovimentoMeioDia!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @Matches(CRON_PATTERN, {
    message: 'cronMovimentoManhaSeguinte deve ter 5 campos ou ser null/vazio para desabilitar',
  })
  cronMovimentoManhaSeguinte?: string | null;
}
