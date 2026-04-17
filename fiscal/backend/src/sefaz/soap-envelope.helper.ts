/**
 * Envelopes SOAP 1.2 para os web services SEFAZ.
 *
 * Formato *headless* (sem `<?xml version?>`, sem indentação, sem CDATA) — o
 * schema validator dos endpoints Java da SEFAZ (MG, SP, BA, AN) é estrito
 * quanto a espaços em branco entre tags e recusa CDATA no `<nfeDadosMsg>`.
 * A referência para este formato foi extraída do código fonte da biblioteca
 * NFeWizard-io (GPL-3.0), que comunica com sucesso em todas as UFs.
 */

export function buildSoapEnvelope(innerXml: string): string {
  return `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${innerXml}</soap12:Body></soap12:Envelope>`;
}
