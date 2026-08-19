import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { horaDoCache } from '../offline/cacheLeitura';

/**
 * "Você está vendo o que estava no aparelho, das 08:15."
 *
 * Trabalhar offline não pode ser MUDO: sem esta faixa, dado velho e dado ao
 * vivo têm exatamente a mesma cara, e aí o entregador toma decisão (pular
 * parada, ligar para o cliente) sobre uma foto do passado sem saber disso.
 * É a mesma razão da faixa laranja das filas — espera de rede tem que falar.
 *
 * Cinza, e não vermelha: sem sinal é o **modo normal de trabalho** de quem roda
 * a zona rural, não um erro. Vermelho ali treinaria o usuário a ignorar alerta.
 */
export function FaixaOffline({ atualizadoEm }: { atualizadoEm: number | null }) {
  const hora = horaDoCache(atualizadoEm);
  return (
    <View style={styles.faixa}>
      <Text style={styles.txt}>
        📴 Sem sinal — dados do aparelho{hora ? ` de ${hora}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  faixa: { backgroundColor: '#475569', paddingVertical: 8, paddingHorizontal: 14 },
  txt: { color: '#fff', fontWeight: '600', fontSize: 12.5, textAlign: 'center' },
});
