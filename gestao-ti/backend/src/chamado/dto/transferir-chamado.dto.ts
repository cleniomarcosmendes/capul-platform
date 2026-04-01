import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class TransferirEquipeDto {
  @IsString()
  @IsNotEmpty()
  equipeDestinoId: string;

  @IsOptional()
  @IsString()
  tecnicoDestinoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;
}

export class TransferirTecnicoDto {
  @IsString()
  @IsNotEmpty()
  tecnicoId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;
}
