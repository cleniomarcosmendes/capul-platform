// Máscara de telefone BR (progressiva): (38) 9999-9999 ou (38) 99999-9999.
// Compartilhada entre o form de abertura de chamado (cliente SAC) e a edição
// dos dados do cliente no detalhe — fonte única pra não divergir.
export function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.replace(/^(\d*)/, '($1');
  if (d.length <= 6) return d.replace(/^(\d{2})(\d*)/, '($1) $2');
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d*)/, '($1) $2-$3');
  return d.replace(/^(\d{2})(\d{5})(\d*)/, '($1) $2-$3');
}
