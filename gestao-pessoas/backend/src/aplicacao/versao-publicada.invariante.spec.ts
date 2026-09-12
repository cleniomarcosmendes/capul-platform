/**
 * ⭐⭐ INVARIANTE — quem monta `AplicacaoParaValidar` informa `versaoPublicada`.
 *
 * A guarda "aplicação só sobre versão publicada" mora em `validarAplicacao`, e
 * o campo é OPCIONAL de propósito: `undefined` é tratado como publicado, para
 * que chamador antigo não passe a inventar problema. Isso é conveniente e é
 * perigoso pela mesma razão — **esquecer o campo desliga a guarda em silêncio**,
 * sem erro de compilação e sem teste vermelho.
 *
 * Por isso a cobrança é sobre o FONTE, não sobre a lista de chamadores que eu
 * lembrei de olhar. Método novo que valide aplicação sem informar o campo
 * quebra a suíte — é o padrão do `assertRdvAberto` na Logística, e o mesmo
 * motivo: revisão caso a caso falha exatamente no caminho não testado.
 *
 * ⚠️ Vale só para PRODUÇÃO. Spec constrói o objeto para exercitar a regra, e
 * exigir o campo lá seria exigir que todo teste fale de publicação.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const RAIZ = path.join(__dirname, '..');

function arquivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return arquivosTs(p);
    return e.isFile() && p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
}

/**
 * O sinal é `modeloFinalidade`: ele é o outro campo que só existe para a mesma
 * validação, e quem monta um monta o outro. Bloco que cita um e não cita o
 * outro é literalmente o esquecimento que se quer pegar.
 */
const DONO = 'ciclo/abertura.validator.ts';

describe('⭐⭐ invariante — versaoPublicada acompanha modeloFinalidade em todo chamador', () => {
  it('nenhum fonte de produção monta a validação sem informar se a versão é publicada', () => {
    const infratores: string[] = [];

    for (const f of arquivosTs(RAIZ)) {
      const relativo = path.relative(RAIZ, f).replace(/\\/g, '/');
      if (relativo === DONO) continue;
      const linhas = fs.readFileSync(f, 'utf8').split('\n');

      linhas.forEach((linha, i) => {
        if (!/^\s*modeloFinalidade\s*:/.test(linha)) return;
        // A vizinhança: o objeto literal que está sendo montado.
        const vizinhanca = linhas.slice(Math.max(0, i - 12), i + 12).join('\n');
        if (!/versaoPublicada\s*:/.test(vizinhanca)) {
          infratores.push(`${relativo}:${i + 1}`);
        }
      });
    }

    expect(infratores).toEqual([]);
  });

  /**
   * ⚠️ Eram DOIS quando escrevi a guarda; são TRÊS. O terceiro (editar a
   * aplicação) foi achado pelo teste acima, não por mim — que é exatamente o
   * que ele existe para fazer.
   */
  it('os três momentos de produção estão cobertos', () => {
    const cobertos = arquivosTs(RAIZ).filter((f) =>
      /versaoPublicada\s*:/.test(fs.readFileSync(f, 'utf8')),
    );
    const nomes = cobertos.map((f) => path.relative(RAIZ, f).replace(/\\/g, '/')).sort();
    expect(nomes).toEqual(['aplicacao/aplicacao.service.ts', 'ciclo/ciclo.service.ts']);
  });
});
