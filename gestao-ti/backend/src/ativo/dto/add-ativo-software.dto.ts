import { IsUUID, IsOptional, IsString, IsDateString } from 'class-validator';

export class AddAtivoSoftwareDto {
  @IsUUID()
  softwareId: string;

  @IsOptional() @IsString()
  versaoInstalada?: string;

  @IsOptional() @IsDateString()
  dataInstalacao?: string;

  @IsOptional() @IsString()
  observacoes?: string;
}
