import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class TransferirEquipeDto {
  @IsString()
  @IsNotEmpty()
  equipeDestinoId: string;

  @IsOptional()
  @IsString()
  tecnicoDestinoId?: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}

export class TransferirTecnicoDto {
  @IsString()
  @IsNotEmpty()
  tecnicoId: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
