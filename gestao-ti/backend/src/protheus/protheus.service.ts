import { Injectable, Logger } from '@nestjs/common';

const PROTHEUS_BASE_URL = process.env.PROTHEUS_BASE_URL || 'https://apiportal.capul.com.br:8104';
const PROTHEUS_AUTH = process.env.PROTHEUS_AUTH || 'Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=';

@Injectable()
export class ProtheusService {
  private readonly logger = new Logger(ProtheusService.name);

  async buscarColaborador(matricula: string): Promise<{ matricula: string; nome: string } | null> {
    const url = `${PROTHEUS_BASE_URL}/rest/api/INFOCLIENTES/getLimite?CODCLIENTE=${encodeURIComponent(matricula)}`;
    this.logger.log(`Buscando colaborador ${matricula} em ${url}`);

    // Desabilitar verificacao SSL temporariamente (Protheus usa certificado auto-assinado)
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': PROTHEUS_AUTH,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`Protheus retornou status ${response.status} para matricula ${matricula}`);
        return null;
      }

      const data = await response.json();
      this.logger.log(`Protheus response para ${matricula}: ${JSON.stringify(data)}`);

      if (!data || !data.nome) {
        this.logger.warn(`Protheus nao retornou nome para matricula ${matricula}`);
        return null;
      }

      return {
        matricula: data.matricula || matricula,
        nome: (data.nome || '').trim(),
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const cause = error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
      this.logger.error(`Erro ao buscar colaborador ${matricula}: ${msg}`, cause ? JSON.stringify(cause) : '');
      return null;
    } finally {
      // Restaurar config SSL original
      if (originalTls === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls;
      }
    }
  }
}
