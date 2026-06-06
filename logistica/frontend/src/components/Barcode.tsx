// Code 39 puro em SVG — sem dependência. Suficiente p/ o número da entrega
// (numérico). Cada caractere = 9 elementos (5 barras + 4 espaços), 3 largos.
// Scanner lê com start/stop '*'. Ratio largo:estreito = 3:1 (robusto).
const CODE39: Record<string, string> = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', '*': '010010100', '-': '010000101',
};

export function Barcode({ value, height = 46, narrow = 2 }: { value: string; height?: number; narrow?: number }) {
  const limpo = String(value).replace(/[^0-9-]/g, '');
  const wide = narrow * 3;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const ch of `*${limpo}*`) {
    const pat = CODE39[ch] ?? CODE39['*'];
    for (let i = 0; i < 9; i++) {
      const w = pat[i] === '1' ? wide : narrow;
      if (i % 2 === 0) bars.push({ x, w }); // índices pares = barras
      x += w;
    }
    x += narrow; // espaço inter-caractere (estreito)
  }
  return (
    <svg width={x} height={height} viewBox={`0 0 ${x} ${height}`} shapeRendering="crispEdges" role="img" aria-label={`código ${limpo}`}>
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill="#000" />)}
    </svg>
  );
}
