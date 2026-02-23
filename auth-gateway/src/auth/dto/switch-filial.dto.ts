import { IsNotEmpty, IsUUID } from 'class-validator';

export class SwitchFilialDto {
  @IsNotEmpty()
  @IsUUID()
  filialId: string;
}
