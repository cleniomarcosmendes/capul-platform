import { IsString, Matches } from 'class-validator';

/**
 * Validacao basica de cron (5 campos separados por espaco). A validacao
 * funcional definitiva acontece no service, que tenta instanciar um
 * `CronJob` — se a expressao for invalida ao nivel sintatico do pacote
 * `cron`, a excecao explode ali com mensagem clara.
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

  @IsString()
  @Matches(CRON_PATTERN, {
    message: 'cronMovimentoManhaSeguinte deve ter 5 campos separados por espaco (ex: "0 6 * * *")',
  })
  cronMovimentoManhaSeguinte!: string;
}
