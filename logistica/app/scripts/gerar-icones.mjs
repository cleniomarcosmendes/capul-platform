/**
 * Gera os ícones do app a partir da marca oficial da CAPUL.
 *
 * Fonte: "CAPUL - LOGO VERTICAL - SemFundoBranco.png" (2500x2825, vetor rasterizado)
 * do manual da marca. Só o SÍMBOLO é usado (folhas + chama + linha do chão); o
 * wordmark "Capul" é ilegível em 48dp e fica de fora.
 *
 * A marca é remontada no estilo do avatar oficial da empresa (perfilFundoVerde):
 * o traço verde-escuro vira BRANCO, as folhas (verde claro) ficam VAZADAS — quem
 * as preenche é o fundo do ícone. A chama continua amarela, que é o acento da marca.
 *
 * Saídas:
 *   assets/icon.png                  1024  fundo verde, marca (PROD; ícone legado + round)
 *   assets/adaptive-icon.png         1024  transparente, marca na safe zone (PROD)
 *   assets/adaptive-icon-mono.png    1024  silhueta branca (tema Android 13+)
 *   assets/android-res-homolog/**          recursos do flavor `homologacao` (âmbar + selo HLG),
 *                                          copiados pelo plugin withEntregasFlavors no prebuild.
 *
 * Como rodar (sharp é ferramenta de build, não entra nas deps do app):
 *   cd logistica/app && npm i sharp --no-save && node scripts/gerar-icones.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = '/mnt/c/Arquivos-de-projeto/Logos Capul/CAPUL - LOGO VERTICAL - SemFundoBranco.png';

// Paleta oficial, amostrada do próprio arquivo da marca.
const VERDE = '#047942';   // institucional — fundo do ícone de produção
const AMARELO = '#fff112'; // chama
const AMBAR = '#b45309';   // NÃO é cor da marca: é justamente o ponto — o ícone de
                           // homologação tem que gritar "não é produção" na gaveta.

const SIMBOLO_ATE_Y = 1647; // abaixo disso começa o wordmark "Capul"
const REF = { escuro: [0x04, 0x79, 0x42], claro: [0x78, 0xc1, 0x4e], amarelo: [0xff, 0xf1, 0x12] };

// Densidades do Android. Ícone legado = 48dp; camadas do adaptive icon = 108dp.
const DPI = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const LEGADO_DP = 48;
const ADAPTIVE_DP = 108;

const dist = (r, g, b, c) => (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;

/**
 * Recorta o símbolo e reclassifica cada pixel: traço → branco, chama → amarelo
 * (ou branco, no monocromático), folha → vazado.
 *
 * A classificação é DURA, na resolução nativa (2500px): o antialiasing é recriado
 * pelo downscale (lanczos) até o tamanho final — sai mais limpo do que tentar
 * preservar as bordas suaves do original, que misturam traço e folha.
 */
async function extrairSimbolo({ chamaAmarela }) {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, channels: C } = info;
  const H = SIMBOLO_ATE_Y;
  const out = Buffer.alloc(W * H * 4, 0);
  let x0 = W, x1 = 0, y0 = H, y1 = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      if (data[i + 3] < 128) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const d = { escuro: dist(r, g, b, REF.escuro), claro: dist(r, g, b, REF.claro), amarelo: dist(r, g, b, REF.amarelo) };
      const cls = Object.keys(d).reduce((m, k) => (d[k] < d[m] ? k : m), 'escuro');
      if (cls === 'claro') continue; // folha: vazada, o fundo do ícone preenche

      const o = (y * W + x) * 4;
      const cor = cls === 'amarelo' && chamaAmarela ? [0xff, 0xf1, 0x12] : [255, 255, 255];
      [out[o], out[o + 1], out[o + 2], out[o + 3]] = [...cor, 255];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const png = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .png()
    .toBuffer();
  return { png, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Monta uma camada quadrada: marca centrada ocupando `ocupa` da largura e, se
 * `selo` vier, o texto (HLG) logo abaixo. Tudo é deslocado para cima por `sobeY`
 * para o conjunto marca+selo continuar centrado.
 */
async function camada({ tamanho, fundo, marca, ocupa, selo, sobeY = 0 }) {
  const larg = Math.round(tamanho * ocupa);
  const alt = Math.round((marca.h / marca.w) * larg);
  const topo = Math.round((tamanho - alt) / 2 - sobeY * tamanho);
  const m = await sharp(marca.png).resize(larg, alt, { kernel: 'lanczos3' }).png().toBuffer();

  const partes = [{ input: m, left: Math.round((tamanho - larg) / 2), top: topo }];
  if (selo) {
    const fonte = Math.round(tamanho * 0.115);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">
      <text x="${tamanho / 2}" y="${topo + alt + Math.round(tamanho * 0.115)}"
        font-family="DejaVu Sans" font-size="${fonte}" font-weight="bold"
        letter-spacing="${Math.round(tamanho * 0.012)}"
        fill="${selo.cor}" text-anchor="middle">${selo.texto}</text></svg>`;
    partes.push({ input: Buffer.from(svg), left: 0, top: 0 });
  }

  const base = fundo
    ? sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: fundo } })
    : sharp({ create: { width: tamanho, height: tamanho, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  return base.composite(partes).png().toBuffer();
}

/** Recorte circular — o Android 7 e anteriores usam ic_launcher_round como está. */
async function circular(pngBuf, tamanho) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}">
       <circle cx="${tamanho / 2}" cy="${tamanho / 2}" r="${tamanho / 2}" fill="#fff"/></svg>`,
  );
  return sharp(pngBuf).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const escrever = (rel, buf) => {
  const p = path.join(APP, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, buf);
  console.log('  ' + rel, `(${(buf.length / 1024).toFixed(1)} KB)`);
};

// ---------------------------------------------------------------------------

const marcaCor = await extrairSimbolo({ chamaAmarela: true });
const marcaMono = await extrairSimbolo({ chamaAmarela: false });
console.log(`símbolo extraído: ${marcaCor.w}x${marcaCor.h}px\n`);

// ---- PRODUÇÃO: o prebuild do Expo gera os recursos a partir destes PNGs -----
console.log('produção (app.json):');
escrever('assets/icon.png', await camada({ tamanho: 1024, fundo: VERDE, marca: marcaCor, ocupa: 0.62 }));
// Adaptive icon: a máscara do launcher só garante o círculo central de 66/108dp
// (61%) — por isso a marca ocupa menos que no ícone quadrado, para não encostar na borda.
escrever('assets/adaptive-icon.png', await camada({ tamanho: 1024, fundo: null, marca: marcaCor, ocupa: 0.50 }));
escrever('assets/adaptive-icon-mono.png', await camada({ tamanho: 1024, fundo: null, marca: marcaMono, ocupa: 0.50 }));

// ---- HOMOLOGAÇÃO: recursos prontos, sobrepostos via source set do flavor ----
// (nomes iguais aos que o Expo gera em src/main/res — o merger do Gradle faz o
// flavor vencer. Ver @expo/prebuild-config/plugins/icons/withAndroidIcons.)
console.log('\nhomologação (assets/android-res-homolog → src/homologacao/res):');
const RES = 'assets/android-res-homolog';
escrever(
  `${RES}/values/colors.xml`,
  Buffer.from(`<resources>\n  <color name="iconBackground">${AMBAR}</color>\n</resources>\n`, 'utf8'),
);

const seloBranco = { texto: 'HLG', cor: '#ffffff' };
for (const [dpi, escala] of Object.entries(DPI)) {
  const legado = Math.round(LEGADO_DP * escala);
  const adapt = Math.round(ADAPTIVE_DP * escala);
  const webp = (buf) => sharp(buf).webp({ lossless: true }).toBuffer();

  // Ícone legado (quadrado + round): fundo âmbar já embutido.
  const quadrado = await camada({ tamanho: legado * 4, fundo: AMBAR, marca: marcaCor, ocupa: 0.54, selo: seloBranco, sobeY: 0.07 });
  const q = await sharp(quadrado).resize(legado, legado, { kernel: 'lanczos3' }).png().toBuffer();
  escrever(`${RES}/mipmap-${dpi}/ic_launcher.webp`, await webp(q));
  escrever(`${RES}/mipmap-${dpi}/ic_launcher_round.webp`, await webp(await circular(q, legado)));

  // Camadas do adaptive icon (o fundo vem do @color/iconBackground acima).
  const fg = await camada({ tamanho: adapt * 4, fundo: null, marca: marcaCor, ocupa: 0.45, selo: seloBranco, sobeY: 0.06 });
  const mono = await camada({ tamanho: adapt * 4, fundo: null, marca: marcaMono, ocupa: 0.45, selo: seloBranco, sobeY: 0.06 });
  escrever(
    `${RES}/mipmap-${dpi}/ic_launcher_foreground.webp`,
    await webp(await sharp(fg).resize(adapt, adapt, { kernel: 'lanczos3' }).png().toBuffer()),
  );
  escrever(
    `${RES}/mipmap-${dpi}/ic_launcher_monochrome.webp`,
    await webp(await sharp(mono).resize(adapt, adapt, { kernel: 'lanczos3' }).png().toBuffer()),
  );
}
console.log('\nok');
