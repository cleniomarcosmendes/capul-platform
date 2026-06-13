import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/**
 * Consulta de CEP via ViaCEP (https://viacep.com.br — API pública, sem chave),
 * PROXIADA pelo backend: o CSP da plataforma é `connect-src 'self'` (de
 * propósito — auditoria), então o navegador não pode chamar domínios externos.
 * Aqui também ganhamos timeout controlado e um ponto único pra trocar de
 * provedor se o ViaCEP sair do ar. Reusável pelo app mobile.
 */
@Injectable()
export class CepService {
  private readonly logger = new Logger(CepService.name);

  async buscar(cep: string): Promise<{
    encontrado: boolean;
    cep?: string;
    logradouro?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
  }> {
    const dig = (cep ?? '').replace(/\D/g, '');
    if (dig.length !== 8) {
      throw new BadRequestException('CEP deve ter 8 dígitos.');
    }
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${dig}/json/`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        this.logger.warn(`ViaCEP retornou ${resp.status} para ${dig}`);
        return { encontrado: false };
      }
      const data = (await resp.json()) as {
        erro?: boolean | string;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      // CEP inexistente vem como { erro: true } (já veio string "true" também).
      if (data.erro) return { encontrado: false };
      return {
        encontrado: true,
        cep: data.cep,
        logradouro: data.logradouro || undefined,
        bairro: data.bairro || undefined,
        cidade: data.localidade || undefined,
        uf: data.uf || undefined,
      };
    } catch (err) {
      // Timeout/rede: o form segue digitação manual — não é erro do usuário.
      this.logger.warn(`ViaCEP indisponível para ${dig}: ${(err as Error).message}`);
      return { encontrado: false };
    }
  }
}
