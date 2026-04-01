import { IsString, IsArray, IsNotEmpty, MaxLength } from 'class-validator';

export class ExecutarImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  entidade: string;

  @IsArray()
  dados: Record<string, unknown>[];
}
