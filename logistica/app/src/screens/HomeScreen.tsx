import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { useAuth } from '../auth/AuthContext';
import { VERSAO_LABEL } from '../lib/versao';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// Entitlement por role (espelha a RBAC do backend — roles.guard.ts: ADMIN sempre).
// Espelha os @Roles de frota.controller.ts e supervisor.controller.ts: se um papel
// entrar lá, tem que entrar aqui, senão o app barra na porta quem a API autoriza.
const ROLES_FROTA = ['REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR', 'SUPERVISOR_FROTA', 'ADMIN'];
const ROLES_ENTREGA = ['ENTREGADOR', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'ADMIN'];
const ROLES_SUPERVISOR = ['REGISTRADOR_FROTA', 'OPERADOR_ENTREGA', 'GESTOR_ENTREGA', 'GESTOR_FROTA', 'SUPERVISOR', 'COORDENADOR', 'ADMIN'];

/**
 * Tela-lançador: o usuário escolhe entre Entregas e Frota. Cada card só fica
 * ativo se a role na Logística permite (mesma regra do backend), então quem
 * tem só uma permissão vê só o seu app; ADMIN vê os dois e alterna sem logout.
 */
export function HomeScreen({ navigation }: Props) {
  const { logout, role } = useAuth();
  const insets = useSafeAreaInsets();
  const podeEntrega = !!role && ROLES_ENTREGA.includes(role);
  const podeFrota = !!role && ROLES_FROTA.includes(role);
  const podeSupervisor = !!role && ROLES_SUPERVISOR.includes(role);

  return (
    // O bloco de baixo (Sair + versão) é empurrado pro fim da tela; sem o inset
    // a versão cai atrás da barra de navegação do Android e some.
    <View style={[styles.container, { paddingBottom: 16 + insets.bottom }]}>
      <Text style={styles.titulo}>O que você vai operar?</Text>

      <Card
        emoji="📦"
        nome="Entregas"
        descricao="Minhas viagens, baixa de entrega e prova"
        habilitado={podeEntrega}
        onPress={() => navigation.navigate('MinhasViagens')}
      />
      <Card
        emoji="🚚"
        nome="Frota"
        descricao="Saída/retorno de veículo, paradas e despesas"
        habilitado={podeFrota}
        onPress={() => navigation.navigate('FrotaHome')}
      />
      <Card
        emoji="🧭"
        nome="Supervisores"
        descricao="Visitas e despesas da viagem mensal (RDV)"
        habilitado={podeSupervisor}
        onPress={() => navigation.navigate('SupervisorHome')}
      />

      <Text style={styles.rodape}>Você pode voltar aqui a qualquer momento para trocar.</Text>

      {/* Sair no CORPO (não só no header): o botão do header da native-stack
          engole o toque no Android. Aqui o toque é garantido. */}
      <TouchableOpacity style={styles.sairBtn} onPress={() => void logout()}>
        <Text style={styles.sairBtnTxt}>Sair</Text>
      </TouchableOpacity>

      <Text style={styles.versao} selectable>{VERSAO_LABEL}</Text>
    </View>
  );
}

function Card({
  emoji, nome, descricao, habilitado, onPress,
}: { emoji: string; nome: string; descricao: string; habilitado: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.card, !habilitado && styles.cardOff]}
      onPress={onPress}
      disabled={!habilitado}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardNome}>{nome}</Text>
        <Text style={styles.cardDesc}>{habilitado ? descricao : 'Sem permissão para esta área'}</Text>
      </View>
      {habilitado ? <Text style={styles.seta}>›</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, gap: 14 },
  titulo: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 8, marginBottom: 2 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardOff: { opacity: 0.5, backgroundColor: '#f1f5f9' },
  emoji: { fontSize: 32 },
  cardNome: { fontSize: 18, fontWeight: '700', color: CAPUL },
  cardDesc: { fontSize: 13, color: '#64748b', marginTop: 2 },
  seta: { fontSize: 28, color: '#cbd5e1', fontWeight: '300' },
  rodape: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6 },
  sair: { color: '#fff', fontSize: 15, fontWeight: '600' },
  sairBtn: {
    marginTop: 'auto', alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: '#fff',
  },
  sairBtnTxt: { color: '#b91c1c', fontSize: 16, fontWeight: '700' },
  versao: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
});
