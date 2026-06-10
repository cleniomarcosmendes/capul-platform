import { Linking } from 'react-native';
import type { Entrega } from '../types/api';

/** Monta o endereço em texto pra busca nos apps de mapa (sem geocodificação). */
export function enderecoTexto(e: Entrega): string {
  return [
    e.endLogradouro,
    e.endNumero,
    e.endBairro,
    e.endCidade,
    e.endUf,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Abre o Waze já navegando pro endereço (deep-link universal Android). */
export function abrirWaze(e: Entrega) {
  const q = encodeURIComponent(enderecoTexto(e));
  return Linking.openURL(`https://waze.com/ul?q=${q}&navigate=yes`);
}

/** Abre o Google Maps em modo rota pro endereço. */
export function abrirGoogleMaps(e: Entrega) {
  const q = encodeURIComponent(enderecoTexto(e));
  return Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
}

/** Liga pro contato da entrega (o telefone é por endereço). */
export function ligar(telefone: string) {
  const num = telefone.replace(/[^\d+]/g, '');
  return Linking.openURL(`tel:${num}`);
}
