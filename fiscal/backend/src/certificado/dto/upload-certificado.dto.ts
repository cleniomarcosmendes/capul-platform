import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UploadCertificadoDto {
  /**
   * Senha do arquivo .pfx. Chega no body do multipart junto do arquivo.
   * O controller a recebe como campo de form, não como header.
   *
   * Mínimo de 8 caracteres: se o .pfx for vazado, uma senha curta é
   * trivialmente bruteforçável offline. Certificados A1 corporativos
   * normalmente têm senha ≥ 10 — esta é uma barreira mínima.
   */
  @IsString()
  @MinLength(8, {
    message:
      'Senha do certificado muito curta — mínimo de 8 caracteres. Certificados A1 ' +
      'com senha fraca são vulneráveis a bruteforce offline se o arquivo vazar.',
  })
  @MaxLength(255)
  senha!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;
}
