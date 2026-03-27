import { Injectable } from '@nestjs/common';

const PROTHEUS_BASE_URL = process.env.PROTHEUS_API_URL || 'https://192.168.7.63:8115';
const PROTHEUS_AUTH = process.env.PROTHEUS_AUTH || 'Basic QVBJQ0FQVUw6QXAxQzRwdTFQUkQ=';

@Injectable()
export class ProtheusService {
  async buscarColaborador(matricula: string): Promise<{ matricula: string; nome: string } | null> {
    try {
      const url = `${PROTHEUS_BASE_URL}/rest/api/INFOCLIENTES/getLimite?CODCLIENTE=${encodeURIComponent(matricula)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': PROTHEUS_AUTH,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      if (!data || !data.nome) return null;

      return {
        matricula: data.matricula || matricula,
        nome: (data.nome || '').trim(),
      };
    } catch {
      return null;
    }
  }
}
