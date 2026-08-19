/**
 * Converte data + hora digitadas (horário LOCAL do aparelho) para ISO 8601, que
 * é o que o backend aceita em `dataHoraSaida`/`dataHoraChegada`.
 *
 * Campos de TEXTO de propósito: um date picker nativo
 * (@react-native-community/datetimepicker) seria dependência NATIVA nova e
 * exigiria APK novo — mataria o OTA. Ver `feedback_app_ota_runtime_fixo_bump`.
 *
 * Função PURA — é o que o runner de testes do app cobre.
 */

/** Aceita "26/07/2026" ou "26072026"; hora "07:30" ou "0730". */
export function isoDeDataHora(data: string, hora: string): string | null {
  const d = (data || '').replace(/\D/g, '');
  const h = (hora || '').replace(/\D/g, '');
  if (d.length !== 8 || h.length !== 4) return null;

  const dia = Number(d.slice(0, 2));
  const mes = Number(d.slice(2, 4));
  const ano = Number(d.slice(4, 8));
  const hh = Number(h.slice(0, 2));
  const mm = Number(h.slice(2, 4));

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  if (hh > 23 || mm > 59) return null;

  const dt = new Date(ano, mes - 1, dia, hh, mm, 0, 0);
  // Rejeita data que "virou" — 31/02 viraria 03/03 no construtor do Date.
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return null;
  return dt.toISOString();
}

/**
 * Máscara de digitação da DATA: "26072026" → "26/07/2026".
 * Aplicada a cada tecla; o usuário só digita números.
 */
export function mascaraData(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Máscara de digitação da HORA: "0730" → "07:30". */
export function mascaraHora(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "26/07/2026" a partir de um Date — para pré-preencher o campo. */
export function dataBR(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * "2026-08-19" do dia de HOJE, no fuso do APARELHO.
 *
 * ⚠️ Não use `toISOString().slice(0,10)`: ele converte para UTC, e no Brasil
 * (UTC-3) toda despesa lançada depois das 21h viraria a data do dia seguinte.
 *
 * Serve para FIXAR a data do gasto ao enfileirar sem sinal — deixar vazio faz o
 * servidor usar "hoje", que numa viagem de vários dias é o dia da sincronização.
 */
export function dataISOHoje(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "15:20" a partir de um Date — para pré-preencher o campo. */
export function horaBR(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
