import { BadRequestException, Injectable } from '@nestjs/common';
import forge from 'node-forge';

/**
 * Extrai metadados de um arquivo PKCS#12 (.pfx/.p12) usado como certificado A1 ICP-Brasil.
 *
 * Usa node-forge — evita ffi nativo e roda em qualquer node:22-alpine.
 */
export interface CertMetadata {
  cnpj: string;           // 14 dígitos
  razaoSocial: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  issuer: string;
  subject: string;
}

@Injectable()
export class CertParserService {
  /**
   * Valida que a senha abre o .pfx, extrai o certificado ICP-Brasil e retorna os metadados.
   *
   * @throws BadRequestException se a senha for inválida, se o arquivo não for um PKCS#12
   *                             ou se nenhum certificado for encontrado.
   */
  parse(buffer: Buffer, senha: string): CertMetadata {
    let p12Asn1: forge.asn1.Asn1;
    try {
      // node-forge espera binary string (latin1), não UTF-8
      const p12Der = forge.util.createBuffer(buffer.toString('binary'));
      p12Asn1 = forge.asn1.fromDer(p12Der);
    } catch (err) {
      throw new BadRequestException(`Arquivo inválido: não é um PKCS#12 válido (${(err as Error).message}).`);
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha);
    } catch (err) {
      throw new BadRequestException(
        `Não foi possível abrir o .pfx com a senha informada. Detalhe: ${(err as Error).message}`,
      );
    }

    const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBags = bags[forge.pki.oids.certBag!];
    if (!certBags || certBags.length === 0) {
      throw new BadRequestException('Nenhum certificado encontrado dentro do .pfx.');
    }

    // Escolhe o certificado do titular (o que tem o CNPJ no subject). Costuma ser o primeiro.
    const cert = certBags.find((b) => !!b.cert)?.cert;
    if (!cert) {
      throw new BadRequestException('O .pfx não contém um certificado X.509 válido.');
    }

    const { cnpj, razaoSocial } = this.extractIcpBrasilIdentity(cert);

    return {
      cnpj,
      razaoSocial,
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
      issuer: this.formatDn(cert.issuer.attributes),
      subject: this.formatDn(cert.subject.attributes),
    };
  }

  /**
   * ICP-Brasil: o CNPJ do titular fica na extensão SubjectAlternativeName,
   * OID 2.16.76.1.3.3 (pessoa jurídica). O formato é:
   *   <data nascimento responsável><CPF responsável><PIS responsável><RG> + <CNPJ>
   *
   * Na prática, alguns certificados simplificam e colocam o CNPJ no CN do subject.
   * Esta implementação cobre os dois casos — se não encontrar na extensão,
   * cai no CN (e avisa no erro).
   */
  private extractIcpBrasilIdentity(cert: forge.pki.Certificate): { cnpj: string; razaoSocial: string } {
    const cn = cert.subject.getField('CN')?.value ?? '';
    const razaoSocial = this.stripCnpjFromCn(cn);

    // 1ª tentativa: extensão SAN com OID 2.16.76.1.3.3
    const sanExt = cert.extensions.find((e: any) => e.name === 'subjectAltName');
    if (sanExt && Array.isArray(sanExt.altNames)) {
      for (const alt of sanExt.altNames as any[]) {
        // otherName com OID da PJ contém CNPJ no final do value
        if (alt.type === 0 && typeof alt.value === 'string') {
          const match = alt.value.match(/(\d{14})\s*$/);
          if (match) {
            return { cnpj: match[1], razaoSocial };
          }
        }
      }
    }

    // 2ª tentativa: CN costuma vir como "RAZAO SOCIAL LTDA:12345678000190"
    const cnCnpj = cn.match(/(\d{14})/);
    if (cnCnpj) {
      return { cnpj: cnCnpj[1], razaoSocial };
    }

    throw new BadRequestException(
      'Não foi possível extrair o CNPJ do certificado. O .pfx deve ser um certificado ICP-Brasil A1 de pessoa jurídica.',
    );
  }

  private stripCnpjFromCn(cn: string): string {
    return cn.replace(/:?\d{14}\s*$/, '').trim();
  }

  private formatDn(attrs: forge.pki.CertificateField[]): string {
    return attrs
      .map((a) => `${a.shortName ?? a.name ?? a.type}=${a.value}`)
      .join(', ');
  }
}
