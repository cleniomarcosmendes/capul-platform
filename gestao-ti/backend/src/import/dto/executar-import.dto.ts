import { IsString, IsArray, IsNotEmpty } from 'class-validator';

export class ExecutarImportDto {
  @IsString()
  @IsNotEmpty()
  entidade: string;

  @IsArray()
  dados: Record<string, unknown>[];
}
