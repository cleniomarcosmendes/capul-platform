import Jimp from 'jimp';

/**
 * Carimba (queima) um rodapé com metadados na FOTO da prova de entrega — deixa a
 * imagem auto-contida e difícil de falsificar: data/hora, coordenadas e endereço
 * ficam na própria imagem (não só num campo do cofre). Reforça o lastro de
 * cobrança (cofre, 5 anos), inspirado no comprovante de transportadoras.
 *
 * Best-effort: o chamador trata exceção gravando a foto original — o carimbo
 * nunca deve impedir a baixa.
 */
export async function carimbarProvaEntrega(buffer: Buffer, linhas: string[]): Promise<Buffer> {
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

/** Coordenada → texto curto (6 casas), ou null se ausente. */
export function fmtGeo(lat?: number | null, lng?: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
