import { Alert } from 'react-native';
import { consumirAvisos } from './avisosPendentes';

/**
 * Mostra o que o servidor RECUSOU durante uma sincronização automática.
 *
 * A sincronização de primeiro plano roda sem ninguém olhando e não abre
 * diálogo. Mas recusa é trabalho jogado fora — o entregador achou que a baixa
 * estava guardada e ela não está. Então fica na fila de avisos e a próxima tela
 * de LISTA (por onde ele sempre passa) exibe uma vez só.
 */
export async function mostrarAvisosPendentes(): Promise<void> {
  const avisos = await consumirAvisos();
  if (!avisos.length) return;
  Alert.alert(
    'Recusado pelo servidor',
    `${avisos.map((a) => `• ${a.rotulo}: ${a.motivo}`).join('\n')}\n\nPrecisa ser refeito.`,
  );
}
