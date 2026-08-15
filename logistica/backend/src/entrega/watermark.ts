import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Logger } from '@nestjs/common';
import { carimbarNaThreadAtual } from './watermark.impl.js';

const logger = new Logger('Watermark');

/** Teto de segurança: carimbo que passe disso é sintoma, não espera normal. */
const TIMEOUT_MS = 20_000;

/** Avisa UMA vez que caímos no modo em-processo (não polui o log por baixa). */
let avisouFallback = false;

/**
 * Carimba (queima) um rodapé com metadados na FOTO da prova de entrega — deixa a
 * imagem auto-contida e difícil de falsificar: data/hora, coordenadas e endereço
 * ficam na própria imagem (não só num campo do cofre). Reforça o lastro de
 * cobrança (cofre, 5 anos), inspirado no comprovante de transportadoras.
 *
 * ⭐ RODA NUMA THREAD À PARTE, e isso é o ponto.
 *
 * O Jimp é JavaScript puro: decodificar uma foto de 12 MP, redimensionar e
 * recodificar ocupa a thread por 1–3s. Rodando na principal, esse tempo é o
 * event loop do Node PARADO — ou seja, **uma baixa congelava a API de logística
 * inteira**: o `GET /viagens/:id` do próprio app ao voltar da tela, e a baixa de
 * qualquer outro entregador ao mesmo tempo. Medido em 14/08 durante a apuração
 * do "app fica parecendo travado ao confirmar a entrega".
 *
 * Fora da thread principal, o mesmo 1–3s vira espera de I/O como qualquer outra:
 * quem pediu a baixa espera, todo mundo mais segue rodando.
 *
 * Best-effort: o chamador trata exceção gravando a foto original — o carimbo
 * nunca deve impedir a baixa.
 */
export function carimbarProvaEntrega(buffer: Buffer, linhas: string[]): Promise<Buffer> {
  // Em dev/teste (rodando do TypeScript) o worker compilado não existe. Aí vale
  // carimbar em processo mesmo: bloquear o event loop de uma suíte de teste não
  // machuca ninguém, e ficar sem carimbo esconderia regressão.
  const arquivo = join(__dirname, 'watermark.worker.js');
  if (!existsSync(arquivo)) {
    if (!avisouFallback) {
      avisouFallback = true;
      logger.warn(
        `Worker do carimbo não encontrado (${arquivo}); carimbando na thread principal. ` +
          'Normal fora do build compilado — em produção indica build incompleto.',
      );
    }
    return carimbarNaThreadAtual(buffer, linhas);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const worker = new Worker(arquivo, { workerData: { buffer, linhas } });
    let encerrado = false;
    const terminar = () => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(prazo);
      void worker.terminate();
    };
    const prazo = setTimeout(() => {
      terminar();
      reject(new Error(`Carimbo passou de ${TIMEOUT_MS}ms.`));
    }, TIMEOUT_MS);

    worker.once('message', (saida: Uint8Array) => {
      terminar();
      resolve(Buffer.from(saida));
    });
    worker.once('error', (err) => {
      terminar();
      reject(err);
    });
    worker.once('exit', (code) => {
      if (encerrado) return;
      terminar();
      reject(new Error(`Worker do carimbo saiu com código ${code}.`));
    });
  });
}

/** Coordenada → texto curto (6 casas), ou null se ausente. */
export function fmtGeo(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
