import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RfbDeteccaoService } from './rfb-deteccao.service.js';

// F1.4a — Detecção automática SEMANAL da base pública CNPJ.
//
// Só DETECTA (PROPFIND no share + marca DISPONIVEL) — NUNCA importa.
// O import é sempre manual/ADMIN_TI (decisão de produto + carga pesada).
// Não é o caso da regra SEFAZ-em-loop: aqui não há certificado nem
// webservice SEFAZ — é um PROPFIND num share estático público, benigno.
//
// Schedule FIXO (segunda 07:00 BRT) — exposto na UI /operacao (F1.4b)
// junto com histórico + gatilho manual, atendendo a regra de "nada de
// caixa-preta no Configurador/Operação". Mudar cadência = constante aqui.
const RFB_CRON = '0 7 * * 1'; // seg 07:00

@Injectable()
export class RfbCronService {
  private readonly logger = new Logger(RfbCronService.name);

  constructor(private readonly deteccao: RfbDeteccaoService) {}

  @Cron(RFB_CRON, { name: 'rfb-deteccao', timeZone: 'America/Sao_Paulo' })
  async detectarSemanal() {
    try {
      const r = await this.deteccao.detectar();
      this.logger.log(
        `RFB detecção semanal: maisRecente=${r.maisRecente} novaDisponivel=${r.novaDisponivel}`,
      );
    } catch (e: any) {
      // Não derruba o cron — só loga (rede/share pode oscilar).
      this.logger.error(`RFB detecção semanal falhou: ${e?.message || e}`);
    }
  }
}
