import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';


/**
 * Reduz a foto NO APARELHO, antes de subir.
 *
 * ⭐ Por que existe (14/08/2026): a câmera entregava a foto em resolução cheia
 * (~3000×4000, 3–4 MB) e o servidor, ao carimbar a prova, **reduz para 1080px e
 * guarda ~70 KB** (`watermark.impl.ts`). Ou seja: subiam megabytes para gravar
 * dezenas de kilobytes. No Wi-Fi da loja isso passava despercebido; no 4G do
 * campo era o upload estourando o prazo da tela e a baixa caindo na fila.
 *
 * Reduzir aqui corta o upload, a memória que o aparelho segura e o tempo que o
 * servidor gasta decodificando — de uma vez só.
 *
 * **1080px é de propósito o mesmo teto do servidor**: reduzir mais degradaria a
 * prova (o carimbo precisa ficar legível, é lastro de cobrança por 5 anos);
 * reduzir menos seria jogar bytes fora de novo. Mexer aqui pede mexer lá.
 */
export const LARGURA_MAX_FOTO = 1080;

/**
 * Recompressão. A foto já vem com `quality: 0.6` do picker; 0.8 aqui evita
 * empilhar perda sobre perda, e o ganho grande vem da resolução, não deste número.
 */
const QUALIDADE = 0.8;

/** O que o `expo-image-picker` devolve e nos interessa. */
export interface FotoOriginal {
  uri: string;
  width?: number;
  height?: number;
}

/**
 * Reduz uma foto. **Nunca lança**: falhando, devolve a original — foto grande é
 * problema de desempenho, foto perdida é problema de prova.
 */
export async function reduzirFoto(foto: FotoOriginal): Promise<string> {
  // Já é menor que o teto: mexer só recomprimiria (perda) ou, pior, AMPLIARIA —
  // `resize: { width }` força a largura, inclusive para cima.
  if (foto.width != null && foto.width <= LARGURA_MAX_FOTO) return foto.uri;
  try {
    const r = await ImageManipulator.manipulateAsync(
      foto.uri,
      [{ resize: { width: LARGURA_MAX_FOTO } }],
      { compress: QUALIDADE, format: SaveFormat.JPEG },
    );
    // A original de 12MP não serve mais para nada: o que sobe e o que a tela
    // mostra é a reduzida. Deixá-la no cache fazia CADA baixa somar dois
    // arquivos, e o entregador faz uma atrás da outra — cache inchado vira
    // pressão de memória, que no Android aparece como pausa de coleta de lixo
    // (a interface "trava" por instantes). Best-effort: falhar aqui não afeta a
    // baixa, que já tem a foto de que precisa.
    if (r.uri !== foto.uri) {
      await FileSystem.deleteAsync(foto.uri, { idempotent: true }).catch(() => undefined);
    }
    return r.uri;
  } catch {
    return foto.uri;
  }
}

/** Reduz várias (seleção da galeria manda um lote de uma vez). */
export async function reduzirFotos(fotos: FotoOriginal[]): Promise<string[]> {
  return Promise.all(fotos.map((f) => reduzirFoto(f)));
}
