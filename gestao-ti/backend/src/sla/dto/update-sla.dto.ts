import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateSlaDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  horasResposta?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  horasResolucao?: number;
}
