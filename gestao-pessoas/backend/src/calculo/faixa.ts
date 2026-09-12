/**
 * Localiza a faixa de pontuação de um critério — substitui os `CASE WHEN` do
 * select antigo.
 *
 * As faixas vivem no CATÁLOGO (`rh.criterio_faixa` → `rh.criterio`) porque são
 * iguais para todos os centros de custo. O que varia por perfil é o peso, que
 * fica em `AplicacaoCriterio`.
 */
/**
 * ── ⚠️ QUANDO MEXER AQUI: RODE AS MUTAÇÕES ──────────────────────────────────
 *
 * Este arquivo decide NOTA. Os testes de cálculo do módulo pegam as reversões
 * conhecidas — **medido em 12/09**, não suposto —, mas isso só continua verdade
 * enquanto alguém confere.
 *
 * **~15 minutos, e é a aferição que substitui escrever a contraparte explícita
 * de cada teste** (§3.1.126). Rode ao mexer em qualquer cálculo:
 *
 *   1. `arredondar` com 1 casa em vez de 2        → esperado: ~8 testes caem
 *   2. fronteira inferior da faixa EXCLUSIVA      → esperado: ~1 teste cai
 *   3. critério sem dado ENTRANDO no denominador  → esperado: ~7 testes caem
 *   4. `pesoExato` trocado por `peso` no
 *      `itensRespondidos`                          → esperado: as permutações
 *                                                    de `ordem-nao-muda-a-nota`
 *                                                    passam a divergir
 *
 * ⚠️⚠️ **Toda mutação tem de PROVAR QUE ENTROU.** Na primeira medição, duas
 * delas não pegaram no fonte (o padrão não batia) e o resultado leu como *"o
 * teste não pega"* — falso verde um nível acima do canário. Use `assert` no
 * script de mutação, ou confira o diff antes de rodar.
 *
 * ⚠️ Verde sem mutação responde "nada mudou desde a última vez", não "está
 * certo" — é a mesma distinção da §3.1.127 sobre baseline.
 */
import type { ValorCriterio } from './resolvers/resolver.types.js';

export interface Faixa {
  id: string;
  tipo: 'NUMERICA' | 'DOMINIO';
  limiteInferior: number | null;
  limiteSuperior: number | null;
  inclusivoInf: boolean;
  inclusivoSup: boolean;
  valorDominio: string | null;
  pontuacao: number;
  rotulo: string | null;
  ordem: number;
}

/**
 * A faixa que contém o valor, ou `null` quando nenhuma contém.
 *
 * ⚠️ `null` NÃO significa zero. Não existe faixa "else 0" (decisão C9): valor
 * sem faixa é lacuna de CADASTRO, e pontuar zero puniria a pessoa por um
 * critério mal configurado. Quem chama decide o que fazer — a apuração trata
 * como `semDado` e devolve alerta, para o RH cadastrar a faixa e reapurar.
 *
 * Os limites nulos são abertos: `{inf: 7, sup: null}` é "mais de 7 anos".
 */
export function localizarFaixa(faixas: readonly Faixa[], valor: ValorCriterio): Faixa | null {
  if (valor.semDado) return null;
  const ordenadas = [...faixas].sort((a, b) => a.ordem - b.ordem);

  for (const faixa of ordenadas) {
    if (faixa.tipo === 'DOMINIO') {
      if (valor.valorTexto !== null && faixa.valorDominio === valor.valorTexto) return faixa;
      continue;
    }
    if (valor.valorNumerico === null) continue;
    if (dentroDaFaixa(faixa, valor.valorNumerico)) return faixa;
  }
  return null;
}

function dentroDaFaixa(faixa: Faixa, valor: number): boolean {
  const { limiteInferior: inf, limiteSuperior: sup } = faixa;
  const acimaDoPiso = inf === null || (faixa.inclusivoInf ? valor >= inf : valor > inf);
  const abaixoDoTeto = sup === null || (faixa.inclusivoSup ? valor <= sup : valor < sup);
  return acimaDoPiso && abaixoDoTeto;
}
