// Validação client-side da chave de acesso de documentos fiscais (NF-e/CT-e).
//
// Por quê: a tela de consulta dispara o consChNFe/consulta CT-e no SEFAZ a
// partir de qualquer string de 44 dígitos. Uma chave digitada errada queima
// uma chamada SEFAZ (cStat=236) à toa — e a plataforma tem limite diário
// (2000/dia) + risco de bloqueio do CNPJ da CAPUL. Validar localmente (DV,
// UF, modelo, documento do emitente) rejeita o erro de digitação ANTES de
// tocar o SEFAZ, instantâneo e sem depender do SEFAZ estar no ar.
//
// Princípio: NUNCA bloquear uma chave legítima. Na dúvida, deixa passar —
// o SEFAZ é a autoridade final. Por isso o check de documento aceita tanto
// CNPJ quanto CPF (emitente pessoa física vem com CPF zero-preenchido na
// chave), e só reprova quando NENHUMA interpretação válida bate.

export type MotivoChaveInvalida = 'TAMANHO' | 'UF' | 'MODELO' | 'DV_DOCUMENTO' | 'DV_CHAVE';

export interface ResultadoChave {
  ok: boolean;
  motivo?: MotivoChaveInvalida;
  mensagem?: string;
}

// Códigos de UF do IBGE válidos numa chave (cUF). 34/36-39/44-49/54+ não
// são atribuídos — uma chave com esses nos 2 primeiros dígitos é inválida.
const UFS_IBGE = new Set([
  '11', '12', '13', '14', '15', '16', '17',
  '21', '22', '23', '24', '25', '26', '27', '28', '29',
  '31', '32', '33', '35',
  '41', '42', '43',
  '50', '51', '52', '53',
]);

const MODELO_NOME: Record<string, string> = {
  '55': 'NF-e',
  '57': 'CT-e',
  '65': 'NFC-e',
  '67': 'CT-e OS',
};

// DV (último dígito) da chave: módulo 11 sobre os 43 primeiros, pesos
// ciclando 2→9 da direita pra esquerda.
function dvChave(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += Number(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

function cnpjValido(c: string): boolean {
  if (!/^\d{14}$/.test(c)) return false;
  if (/^(\d)\1{13}$/.test(c)) return false; // todos iguais
  const nums = c.split('').map(Number);
  const calc = (pesos: number[]) =>
    pesos.reduce((acc, p, i) => acc + nums[i] * p, 0) % 11;
  const d1 = calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return (d1 < 2 ? 0 : 11 - d1) === nums[12] && (d2 < 2 ? 0 : 11 - d2) === nums[13];
}

function cpfValido(c: string): boolean {
  if (!/^\d{11}$/.test(c)) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const calc = (qtd: number) => {
    let soma = 0;
    for (let i = 0; i < qtd; i++) soma += Number(c[i]) * (qtd + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

// Documento do emitente embutido na chave (posições 6-19, 14 dígitos).
// Aceita CNPJ OU CPF zero-preenchido (000 + 11 dígitos) — emitente pessoa
// física é legítimo (produtor rural). Só reprova se nenhum bater.
function documentoEmitenteValido(doc: string): boolean {
  if (!/^\d{14}$/.test(doc)) return false;
  if (cnpjValido(doc)) return true;
  if (doc.startsWith('000') && cpfValido(doc.slice(3))) return true;
  return false;
}

/**
 * Valida a chave de acesso localmente. Retorna { ok: true } ou
 * { ok: false, motivo, mensagem }. `modeloEsperado` (55=NF-e, 57=CT-e) é
 * opcional — quando passado, detecta chave do tipo errado na tela errada.
 */
export function validarChaveAcesso(
  entrada: string,
  opts?: { modeloEsperado?: '55' | '57' },
): ResultadoChave {
  const chave = (entrada ?? '').replace(/\D/g, '');

  if (chave.length !== 44) {
    return {
      ok: false,
      motivo: 'TAMANHO',
      mensagem: `A chave deve ter exatamente 44 dígitos — você informou ${chave.length}. Confira se não falta ou sobra dígito.`,
    };
  }

  if (!UFS_IBGE.has(chave.slice(0, 2))) {
    return {
      ok: false,
      motivo: 'UF',
      mensagem: `Os 2 primeiros dígitos (${chave.slice(0, 2)}) não correspondem a um código de UF válido do IBGE. A chave provavelmente está errada.`,
    };
  }

  const modelo = chave.slice(20, 22);
  if (opts?.modeloEsperado && modelo !== opts.modeloEsperado) {
    const nomeInformado = MODELO_NOME[modelo] ?? `modelo ${modelo}`;
    const nomeEsperado = MODELO_NOME[opts.modeloEsperado] ?? `modelo ${opts.modeloEsperado}`;
    return {
      ok: false,
      motivo: 'MODELO',
      mensagem: `Esta chave é de ${nomeInformado} (modelo ${modelo}), mas esta tela consulta ${nomeEsperado} (modelo ${opts.modeloEsperado}). Use a tela correta.`,
    };
  }

  if (!documentoEmitenteValido(chave.slice(6, 20))) {
    return {
      ok: false,
      motivo: 'DV_DOCUMENTO',
      mensagem:
        'O CNPJ/CPF do emitente embutido na chave (dígitos 7 a 20) é inválido. A chave provavelmente foi digitada errada.',
    };
  }

  if (dvChave(chave.slice(0, 43)) !== Number(chave[43])) {
    return {
      ok: false,
      motivo: 'DV_CHAVE',
      mensagem:
        'O dígito verificador (último dos 44) não confere com os 43 anteriores. Provavelmente um dígito foi digitado errado, a mais ou a menos.',
    };
  }

  return { ok: true };
}
