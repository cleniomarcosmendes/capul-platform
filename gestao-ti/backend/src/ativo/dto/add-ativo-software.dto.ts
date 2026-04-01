import { IsUUID, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class AddAtivoSoftwareDto {
  @IsUUID()
  softwareId: string;

  @IsOptional() @IsString() @MaxLength(50)
  versaoInstalada?: string;

  @IsOptional() @IsDateString()
  dataInstalacao?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  observacoes?: string;
}
