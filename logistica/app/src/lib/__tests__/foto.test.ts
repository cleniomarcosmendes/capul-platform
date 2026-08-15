import { reduzirFoto, reduzirFotos, LARGURA_MAX_FOTO } from '../foto';

/**
 * As duas regras que não são óbvias ao ler `reduzirFoto` — e que quebram calado
 * se alguém "simplificar" o utilitário:
 *
 * 1. **Foto menor que o teto passa intacta.** `resize: { width }` FORÇA a
 *    largura, inclusive para cima: sem o atalho, uma foto de 600px seria
 *    AMPLIADA para 1080 — mais bytes e nenhuma informação nova, o contrário do
 *    motivo de o utilitário existir.
 * 2. **Falhar não pode perder a foto.** Foto grande é problema de desempenho;
 *    foto perdida é problema de PROVA (o comprovante é lastro de cobrança por 5
 *    anos). Dando erro, devolve a original e a baixa segue.
 */
const mockManipulateAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  manipulateAsync: (...args: unknown[]) => mockManipulateAsync(...args),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

beforeEach(() => {
  mockManipulateAsync.mockReset();
  mockManipulateAsync.mockResolvedValue({ uri: 'file://reduzida.jpg', width: LARGURA_MAX_FOTO, height: 1440 });
});

describe('reduzirFoto', () => {
  it('reduz a foto da câmera e devolve a nova URI', async () => {
    const uri = await reduzirFoto({ uri: 'file://original.jpg', width: 3000, height: 4000 });

    expect(uri).toBe('file://reduzida.jpg');
    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file://original.jpg',
      [{ resize: { width: LARGURA_MAX_FOTO } }],
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('NÃO mexe em foto que já é menor que o teto — redimensionar a ampliaria', async () => {
    const uri = await reduzirFoto({ uri: 'file://pequena.jpg', width: 600, height: 800 });

    expect(uri).toBe('file://pequena.jpg');
    expect(mockManipulateAsync).not.toHaveBeenCalled();
  });

  it('reduz quando a largura é desconhecida (não dá para concluir que é pequena)', async () => {
    const uri = await reduzirFoto({ uri: 'file://sem-medida.jpg' });

    expect(uri).toBe('file://reduzida.jpg');
    expect(mockManipulateAsync).toHaveBeenCalled();
  });

  it('falhando, devolve a ORIGINAL — perder a prova é pior que subir pesado', async () => {
    mockManipulateAsync.mockRejectedValue(new Error('sem memória'));

    await expect(reduzirFoto({ uri: 'file://original.jpg', width: 3000 })).resolves.toBe(
      'file://original.jpg',
    );
  });
});

describe('reduzirFotos', () => {
  it('trata o lote da galeria preservando a ordem, cada uma pela sua regra', async () => {
    mockManipulateAsync.mockImplementation((uri: string) =>
      Promise.resolve({ uri: `${uri}.reduzida`, width: LARGURA_MAX_FOTO, height: 100 }),
    );

    const uris = await reduzirFotos([
      { uri: 'file://a.jpg', width: 4000 },
      { uri: 'file://b.jpg', width: 300 }, // pequena: passa intacta
      { uri: 'file://c.jpg', width: 2000 },
    ]);

    expect(uris).toEqual(['file://a.jpg.reduzida', 'file://b.jpg', 'file://c.jpg.reduzida']);
  });
});
