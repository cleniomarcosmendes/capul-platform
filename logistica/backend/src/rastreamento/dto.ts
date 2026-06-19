import { IsISO8601, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

/** Ping de GPS enviado pelo app durante a viagem em curso (foreground). */
export class RegistrarPosicaoDto {
  @IsString()
  viagemId!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /** Precisão do GPS em metros (accuracy). */
  @IsOptional()
  @IsNumber()
  precisao?: number;

  /** Velocidade em m/s, quando o device informa. */
  @IsOptional()
  @IsNumber()
  velocidade?: number;

  /** Nível de bateria do aparelho (0-100). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  bateria?: number;

  /** Hora da captura no device (ISO). Default: agora no servidor. */
  @IsOptional()
  @IsISO8601()
  capturadoEm?: string;
}
