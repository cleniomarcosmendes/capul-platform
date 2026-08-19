import { processarFila as processarBaixas } from './filaBaixas';
import { processarFilaDespesaEntrega } from './filaDespesaEntrega';
import { processarFilaKmEntrega } from './filaKmEntrega';
import { processarFilaFrota } from './filaFrota';
import { processarFilaSupervisor } from './filaSupervisor';
import { guardarAvisos } from './avisosPendentes';

/**
 * Esvazia TODAS as filas, na ordem que o servidor exige.
 *
 * ⚠️ Existe porque a sincronização estava amarrada ao FOCO de tela, e isso não
 * cobre o caso real de quem trabalha dias fora: o supervisor de RDV fica na
 * mesma tela a manhã inteira, atravessa uma cidade com sinal e sai dela de novo
 * sem que nada tenha subido — o foco nunca mudou. Agora o retorno do app ao
 * primeiro plano também dispara (`App.tsx`), que é o gesto que ele faz ao tirar
 * o aparelho do bolso.
 *
 * A ORDEM dentro da entrega não é estética: o KM de saída ABRE a rota, e as
 * baixas subindo antes dele eram recusadas com 4xx — que esta fila trata como
 * rejeição definitiva, **descartando a baixa e apagando a foto**. O 'encerrar'
 * é terminal e vai por último. Frota e RDV são FIFO e independentes.
 *
 * Não abre diálogo: roda sem ninguém olhando, e diálogo nativo em cima de uma
 * transição de tela já custou caro (14/08). O que o servidor RECUSOU fica
 * guardado em `avisosPendentes` e a próxima tela de lista mostra — recusa é
 * trabalho jogado fora, não pode sumir calada.
 */
export async function sincronizarTudo(): Promise<{ enviadas: number }> {
  let enviadas = 0;
  const recusas: { rotulo: string; motivo: string }[] = [];

  try {
    const kmIni = await processarFilaKmEntrega({ apenas: 'iniciar' });
    enviadas += kmIni.enviadas;
    recusas.push(...kmIni.descartadas);
    // KM de saída recusado = no servidor a rota segue sem KM, e cada baixa que
    // subisse agora voltaria 4xx e seria descartada com a foto. Para a entrega
    // aqui; o resto das filas não depende dela.
    if (kmIni.descartadas.length === 0) {
      const b = await processarBaixas();
      enviadas += b.enviadas;
      recusas.push(...b.descartadas.map((d) => ({ rotulo: `Baixa #${d.entregaNumero}`, motivo: d.motivo })));

      const de = await processarFilaDespesaEntrega();
      enviadas += de.enviadas;
      recusas.push(...de.descartadas);

      const kmFim = await processarFilaKmEntrega({ apenas: 'encerrar' });
      enviadas += kmFim.enviadas;
      recusas.push(...kmFim.descartadas);
    }
  } catch { /* rede: fica para a próxima */ }

  try {
    const f = await processarFilaFrota();
    enviadas += f.enviadas;
    recusas.push(...f.descartadas);
  } catch { /* idem */ }

  try {
    const s = await processarFilaSupervisor();
    enviadas += s.enviadas;
    recusas.push(...s.descartadas);
  } catch { /* idem */ }

  await guardarAvisos(recusas);
  return { enviadas };
}
