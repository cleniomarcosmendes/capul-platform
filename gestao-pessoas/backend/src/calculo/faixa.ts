/**
 * Localiza a faixa de pontuação de um critério — substitui os `CASE WHEN` do
 * select antigo.
 *
 * As faixas vivem no CATÁLOGO (`rh.criterio_faixa` → `rh.criterio`) porque são
 * iguais para todos os centros de custo. O que varia por perfil é o peso, que
 * fica em `AplicacaoCriterio`.
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
