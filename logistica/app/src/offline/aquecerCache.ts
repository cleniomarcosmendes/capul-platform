import { comCache } from './cacheLeitura';
import { tiposDespesa, fornecedoresDespesa, listarLocaisParada } from '../api/frota';
import { listarAtividadesSup, listarTiposDespesaSup } from '../api/supervisor';

/**
 * Baixa os CADASTROS DE APOIO enquanto ainda há sinal.
 *
 * O cache de leitura só se enche quando a tela é aberta COM rede — e é
 * exatamente aí que ele falharia no caso real: o condutor abre a tela de
 * despesa pela primeira vez **no posto**, sem sinal, e encontra o seletor de
 * tipo vazio. Ele nunca teve motivo para abrir aquela tela na base.
 *
 * Então o app puxa esses cadastros no lançador (Home), que é por onde todo mundo
 * passa logo depois do login — normalmente ainda no pátio, no WiFi da empresa.
 * São listas pequenas e que mudam raramente.
 *
 * Best-effort de propósito: falhar aqui não pode atrapalhar nada. Sem sinal a
 * função simplesmente não faz efeito, e a tela segue com o que já houver.
 *
 * ⚠️ Só cadastro de APOIO. Rota, viagem e paradas continuam sendo guardadas pela
 * tela que as lê — são dados do dia, e baixá-los aqui esconderia de quem os usa
 * a decisão de quando atualizar.
 */
export async function aquecerCadastrosDeApoio(opts: { frota: boolean; supervisor: boolean }): Promise<void> {
  const tarefas: Promise<unknown>[] = [];
  if (opts.frota) {
    tarefas.push(comCache('despesas:tipos', tiposDespesa));
    tarefas.push(comCache('despesas:fornecedores', fornecedoresDespesa));
    tarefas.push(comCache('frota:locais', () => listarLocaisParada()));
  }
  if (opts.supervisor) {
    tarefas.push(comCache('sup:atividades', listarAtividadesSup));
    tarefas.push(comCache('sup:tipos-despesa', listarTiposDespesaSup));
  }
  await Promise.allSettled(tarefas);
}
