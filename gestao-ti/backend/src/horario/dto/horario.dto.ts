import { IsString, IsOptional, Matches } from 'class-validator';

const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertHorarioDto {
  @IsOptional()
  @IsString()
  usuarioId?: string;

  @IsString()
  @Matches(HORA_REGEX, { message: 'horaInicioExpediente deve estar no formato HH:mm' })
  horaInicioExpediente: string;

  @IsString()
  @Matches(HORA_REGEX, { message: 'horaFimExpediente deve estar no formato HH:mm' })
  horaFimExpediente: string;

  @IsString()
  @Matches(HORA_REGEX, { message: 'horaInicioAlmoco deve estar no formato HH:mm' })
  horaInicioAlmoco: string;

  @IsString()
  @Matches(HORA_REGEX, { message: 'horaFimAlmoco deve estar no formato HH:mm' })
  horaFimAlmoco: string;
}
