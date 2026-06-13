import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'http';
import * as https from 'https';

/**
 * Cliente OSRM (Open Source Routing Machine) — distância REAL de rua, opcional.
 * OPT-IN: só age se `OSRM_URL` estiver no ambiente (ex.: http://osrm:5000). Sem
 * ela, `matrizDistancia` devolve null e o RotaService cai no haversine (linha
 * reta) — comportamento padrão, sem infra. Tolerante: qualquer erro/timeout →
 * null (fallback), nunca derruba a sugestão de rota.
 */
@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);

  constructor(private readonly config: ConfigService) {}

  get habilitado(): boolean {
    return !!this.config.get<string>('OSRM_URL');
  }

  /**
   * Matriz N×N de distâncias de rua (METROS) via OSRM /table. `pontos` na ordem
   * desejada (índice i ↔ linha/coluna i). null se OSRM off/indisponível. Pares
   * sem rota viram Infinity (nunca escolhidos).
   */
  async matrizDistancia(pontos: { lat: number; lng: number }[]): Promise<number[][] | null> {
    const base = this.config.get<string>('OSRM_URL');
    if (!base || pontos.length < 2) return null;
    // OSRM usa a ordem lng,lat.
    const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `${base.replace(/\/$/, '')}/table/v1/driving/${coords}?annotations=distance`;
    const timeout = Number(this.config.get('OSRM_TIMEOUT_MS', '8000')) || 8000;
    try {
      const data = await this.get(url, timeout);
      const dist = (data as { distances?: (number | null)[][] })?.distances;
      if (!Array.isArray(dist)) {
        this.logger.warn('OSRM /table sem "distances" — fallback haversine');
        return null;
      }
      return dist.map((row) => row.map((v) => (v == null ? Infinity : v)));
    } catch (e) {
      this.logger.warn(`OSRM indisponível (${(e as Error).message}) — fallback haversine`);
      return null;
    }
  }

  private get(url: string, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const transport = u.protocol === 'https:' ? https : http;
      const req = transport.request(
        {
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: u.pathname + u.search,
          method: 'GET',
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        (res) => {
          let body = '';
          res.on('data', (c) => { body += c; });
          res.on('end', () => {
            if (!res.statusCode || res.statusCode >= 400) return reject(new Error(`status ${res.statusCode}`));
            try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON inválido')); }
          });
        },
      );
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      req.end();
    });
  }
}
