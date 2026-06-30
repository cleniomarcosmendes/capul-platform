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

// Google Maps aceita ~9 paradas intermediárias + o destino na URL `dir`.
export const MAX_PARADAS_MAPS = 10;

/**
 * Abre o Google Maps com a ROTA COMPLETA (várias paradas, na ordem da lista):
 * origem = localização atual (omitida), waypoints = intermediárias, destino = a
 * última. O Waze não suporta multi-parada — por isso só o Maps. A lista já deve
 * vir capada em MAX_PARADAS_MAPS pelo chamador.
 */
export function abrirRotaGoogleMaps(entregas: Entrega[]) {
  if (entregas.length === 0) return;
  if (entregas.length === 1) return abrirGoogleMaps(entregas[0]);
  const pts = entregas.map((e) => encodeURIComponent(enderecoTexto(e)));
  const destination = pts[pts.length - 1];
  const waypoints = pts.slice(0, -1).join('|');
  return Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${destination}&waypoints=${waypoints}&travelmode=driving`,
  );
}

/** Liga pro contato da entrega (o telefone é por endereço). */
export function ligar(telefone: string) {
  const num = telefone.replace(/[^\d+]/g, '');
  return Linking.openURL(`tel:${num}`);
}
