import Jimp from 'jimp';

/**
 * O trabalho de imagem em si — Jimp puro, SÍNCRONO do ponto de vista do event
 * loop (é JavaScript, não biblioteca nativa: enquanto roda, nada mais roda
 * naquela thread).
 *
 * Por isso ele mora sozinho neste arquivo: quem chama de verdade é o worker
 * (`watermark.worker.ts`), numa thread à parte. Ver `watermark.ts` para o porquê.
 */
export async function carimbarNaThreadAtual(buffer: Buffer, linhas: string[]): Promise<Buffer> {
  const img = await Jimp.read(buffer);

  // Normaliza a largura: carimbo consistente em qualquer câmera + arquivo menor.
  const MAX_W = 1080;
  if (img.getWidth() > MAX_W) img.resize(MAX_W, Jimp.AUTO);

  const W = img.getWidth();
  const H = img.getHeight();
  const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  const pad = 10;
  const lineH = 22;
  const linhasOk = linhas.filter((l) => l && l.trim()).map((l) => l.slice(0, 110));
  const barH = pad * 2 + linhasOk.length * lineH;

  // Faixa semi-transparente preta no rodapé, atrás do texto branco.
  const bar = new Jimp(W, barH, 0x00000099);
  img.composite(bar, 0, Math.max(0, H - barH));

  linhasOk.forEach((t, i) => {
    img.print(font, pad, H - barH + pad + i * lineH, t);
  });

  return img.getBufferAsync(Jimp.MIME_JPEG);
}
