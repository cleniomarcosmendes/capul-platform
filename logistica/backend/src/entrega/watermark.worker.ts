import { parentPort, workerData } from 'node:worker_threads';
import { carimbarNaThreadAtual } from './watermark.impl.js';

/**
 * Thread dedicada ao carimbo da prova de entrega.
 *
 * Único motivo de existir: manter o Jimp FORA da thread principal. Ver o bloco
 * de contexto em `watermark.ts`.
 */
interface Entrada {
  buffer: Uint8Array;
  linhas: string[];
}

const { buffer, linhas } = workerData as Entrada;

void carimbarNaThreadAtual(Buffer.from(buffer), linhas)
  .then((saida) => {
    // `transferList` evita copiar a imagem de volta para a thread principal.
    const bytes = new Uint8Array(saida);
    parentPort?.postMessage(bytes, [bytes.buffer]);
  })
  .catch((err: unknown) => {
    // Reemite como erro do worker: o chamador grava a foto ORIGINAL (o carimbo
    // é best-effort e nunca pode impedir uma baixa).
    throw err instanceof Error ? err : new Error(String(err));
  });
