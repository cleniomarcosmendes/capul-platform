import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { isAxiosError } from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation';
import { obterViagem, iniciarEntrega, encerrarEntrega } from '../api/viagens';
import { impedimentosEncerramento } from '../lib/impedimentosEncerramento';
import {
  baixasNaFilaPorEntrega,
  contarPendentes as contarPendentesBaixas,
  onFilaChange as onFilaBaixasChange,
  processarFila as processarFilaBaixas,
} from '../offline/filaBaixas';
import { ehErroDeRede } from '../offline/filaFrota';
import { contarPendentesDespesaEntrega, onFilaDespesaEntregaChange, processarFilaDespesaEntrega } from '../offline/filaDespesaEntrega';
import { contarPendentesKmEntrega, onFilaKmEntregaChange, processarFilaKmEntrega, enfileirarKmEntrega } from '../offline/filaKmEntrega';
import { abrirGoogleMaps, abrirWaze, abrirRotaGoogleMaps, enderecoTexto, ligar, MAX_PARADAS_MAPS } from '../lib/navegar';
import { useRastreamento } from '../lib/useRastreamento';
import { garantirPermissaoLocalizacao } from '../lib/permissaoLocalizacao';
import { avisarEVoltar } from '../lib/avisarEVoltar';
import { onAviso, publicarAviso, type Aviso } from '../lib/avisoTela';
import type { Parada, Viagem } from '../types/api';

const CAPUL = '#1e7d3a';
type Props = NativeStackScreenProps<RootStackParamList, 'ViagemDetalhe'>;

type Filtro = 'PENDENTES' | 'ENTREGUES' | 'TODAS';

export function ViagemDetalheScreen({ route, navigation }: Props) {
  const { viagemId } = route.params;
  const [viagem, setViagem] = useState<Viagem | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('PENDENTES');
  // "Iniciar/Encerrar entrega" — captura do KM (hodômetro) no painel do veículo.
  const [acaoKm, setAcaoKm] = useState<null | 'iniciar' | 'encerrar'>(null);
  const [kmInput, setKmInput] = useState('');
  const [salvandoKm, setSalvandoKm] = useState(false);
  // Filas offline da rota (banner + reenvio): baixa + despesa + KM de saída/retorno.
  // A baixa entra aqui porque é onde o entregador está quando trabalha sem sinal —
  // ficar de fora do banner era ele não ter como saber que a prova não subiu.
  const [pendBaixa, setPendBaixa] = useState(0);
  // Entregas já baixadas NO APARELHO, esperando sinal (id → resultado). O status
  // que vem do servidor não sabe delas: offline ele não recebeu nada.
  const [baixasNaFila, setBaixasNaFila] = useState<Record<string, 'ENTREGUE' | 'NAO_ENTREGUE'>>({});
  const [pendDespesa, setPendDespesa] = useState(0);
  const [pendKm, setPendKm] = useState(0);
  const [reenviandoDespesa, setReenviandoDespesa] = useState(false);
  // Confirmação da baixa/despesa que ACABOU de acontecer — no lugar do Alert,
  // que disputava foco com a transição de tela (ver `lib/avisoTela.ts`).
  const [aviso, setAviso] = useState<Aviso | null>(null);
  // Já conseguimos carregar a rota alguma vez? Decide se uma falha de rede vira
  // tela de erro ou é apenas ignorada (seguimos com o que está na tela).
  const temViagemRef = useRef(false);
  // Quando foi a última tentativa AUTOMÁTICA de reenvio. O foco da tela dispara
  // reenvio, e a subida da baixa carrega a foto (timeout de 60s): sem esta folga,
  // ir e voltar da Baixa empilhava tentativas longas com o botão do banner
  // desabilitado — parecia travado. O toque no banner ignora a folga.
  const ultimoReenvioRef = useRef(0);
  /** Soma das 3 filas, espelhada do estado — evita ler disco no caminho quente. */
  const totalPendRef = useRef(0);
  /** O 1º foco é a abertura da tela; os seguintes são volta de outra tela. */
  const primeiroFocoRef = useRef(true);

  const carregar = useCallback(async () => {
    try {
      const v = await obterViagem(viagemId);
      setViagem(v);
      setErro(''); // some com o erro de uma tentativa anterior; sem isto ele grudava
      temViagemRef.current = true;
      // Rota ainda sem KM de saída: o formulário nasce ABERTO (é o primeiro ato da
      // rota, não um botão a descobrir), então a sugestão do odômetro é semeada
      // aqui. Só preenche campo vazio — nunca por cima do que ele digitou.
      const odometro = v.veiculo?.kmAtual;
      if (v.situacao === 'EM_CURSO' && v.kmInicial == null && odometro != null) {
        setKmInput((atual) => (atual === '' ? String(odometro) : atual));
      }
    } catch {
      // 🔴 Sem sinal, `carregar` falha — e ele roda a CADA foco, inclusive ao
      // voltar da Baixa. Antes isso virava tela de erro definitiva: o `erro`
      // nunca era limpo e o render é `erro || !viagem`, então a rota sumia da
      // tela e não voltava nem com o sinal de volta. Era o "app travou depois da
      // primeira baixa".
      // Já tendo a rota carregada, falha de rede não pode apagá-la: offline é o
      // modo normal de trabalho do entregador, e a fila cuida do que ficou. Só
      // vira tela de erro quando nunca conseguimos carregar.
      if (!temViagemRef.current) setErro('Não foi possível carregar a viagem.');
    } finally {
      setCarregando(false);
    }
  }, [viagemId]);

  // Esvazia as filas offline NA ORDEM QUE O SERVIDOR EXIGE:
  //   KM de saída → baixas → despesas → KM de retorno (encerrar).
  //
  // ⚠️ O KM de saída ABRE a rota e por isso vai PRIMEIRO. Antes as baixas subiam
  // na frente dele: o servidor recusava cada uma ("Registre o KM de saída…"), e a
  // fila de baixas trata 4xx como rejeição definitiva — **descartava a baixa e
  // apagava a foto**. Quem trabalhou sem sinal perdia a prova de entrega, que é
  // lastro de cobrança. O 'encerrar' segue por último: é terminal, e subindo antes
  // seria recusado pelas baixas que ainda estão na fila.
  const reenviarPendencias = useCallback(async ({ automatico = false } = {}) => {
    // ⭐ Sem tocar no DISCO no caso comum. Aqui havia TRÊS leituras sequenciais do
    // AsyncStorage (SQLite, atravessando a ponte nativa) a cada FOCO da tela —
    // inclusive com tudo zerado, que é o normal. Caíam bem na janela em que a
    // tela está voltando da baixa e o entregador já está tocando, e ponte
    // ocupada atrasa a entrega dos toques. Mesmo defeito que o `irParaBaixa`
    // tinha, em outro lugar. Os três contadores já vivem no estado, mantidos
    // pelos listeners das filas; o ref só evita recriar este callback a cada
    // mudança deles (o efeito de foco depende dele).
    if (totalPendRef.current === 0) return;
    // Sem sinal, cada tentativa custa até 60s (a baixa sobe a foto). Ir e voltar
    // da Baixa não pode enfileirar uma tentativa longa por foco.
    const agora = Date.now();
    if (automatico && agora - ultimoReenvioRef.current < 30_000) return;
    ultimoReenvioRef.current = agora;
    setReenviandoDespesa(true);
    try {
      const rkIni = await processarFilaKmEntrega({ apenas: 'iniciar' });
      // KM de saída recusado (ex.: menor que o odômetro do veículo) = no servidor a
      // rota continua sem KM. Subir as baixas agora seria perdê-las com a foto —
      // então segura tudo e devolve o motivo para ele corrigir o número.
      if (rkIni.descartadas.length) {
        Alert.alert(
          'KM de saída recusado',
          `${rkIni.descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n')}\n\n` +
            'As baixas continuam guardadas no aparelho. Registre o KM de saída de novo para liberar o envio.',
        );
        await carregar();
        return;
      }
      const rb = await processarFilaBaixas();
      if (rb.descartadas.length) {
        Alert.alert('Baixas rejeitadas pelo servidor', rb.descartadas.map((d) => `#${d.entregaNumero}: ${d.motivo}`).join('\n'));
      }
      const rd = await processarFilaDespesaEntrega();
      const rk = await processarFilaKmEntrega({ apenas: 'encerrar' });
      const descartadas = [...rd.descartadas, ...rk.descartadas];
      if (descartadas.length) Alert.alert('Rejeitado pelo servidor', descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'));
      // Recarrega se algo mudou o estado da rota no servidor: o KM de saída, as
      // baixas ou o encerrar (que pode ter concluído a rota).
      if (rkIni.enviadas > 0 || rb.enviadas > 0 || rk.enviadas > 0) await carregar();
    } finally { setReenviandoDespesa(false); }
  }, [carregar]);

  // Aviso publicado pela tela de Baixa/Despesa ao voltar. Some sozinho em 5s —
  // é confirmação, não decisão: não pede toque e não bloqueia nada.
  useEffect(() => {
    return onAviso((a) => setAviso(a));
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(id);
  }, [aviso]);

  // Espelho dos contadores para leitura SÍNCRONA (ver `reenviarPendencias`).
  useEffect(() => {
    totalPendRef.current = pendBaixa + pendDespesa + pendKm;
  }, [pendBaixa, pendDespesa, pendKm]);

  // Contadores das filas ao vivo (banner).
  useEffect(() => {
    // O contador e o mapa andam juntos: a fila mudou, a tela muda com ela — sem
    // depender de um novo carregamento do servidor (que offline não vem).
    const sincronizar = (qtd: number) => {
      setPendBaixa(qtd);
      void baixasNaFilaPorEntrega().then(setBaixasNaFila);
    };
    void contarPendentesBaixas().then(sincronizar);
    return onFilaBaixasChange(sincronizar);
  }, []);
  useEffect(() => {
    void contarPendentesDespesaEntrega().then(setPendDespesa);
    return onFilaDespesaEntregaChange(setPendDespesa);
  }, []);
  useEffect(() => {
    void contarPendentesKmEntrega().then(setPendKm);
    return onFilaKmEntregaChange(setPendKm);
  }, []);

  // Ao focar (inclusive voltando da Baixa/Despesa) recarrega e tenta reenviar as filas.
  //
  // ⚠️ VOLTANDO de outra tela, espera a transição terminar. O foco dispara no
  // COMEÇO da animação: recarregar ali põe resposta de rede + re-render da lista
  // inteira em cima da transição, e é justamente quando ele já está tocando o
  // próximo botão. Na ABERTURA da tela não há espera — seria atraso puro.
  useFocusEffect(
    useCallback(() => {
      const atraso = primeiroFocoRef.current ? 0 : 400;
      primeiroFocoRef.current = false;
      const id = setTimeout(() => {
        void carregar();
        void reenviarPendencias({ automatico: true });
      }, atraso);
      return () => clearTimeout(id);
    }, [carregar, reenviarPendencias]),
  );

  // Rastreamento foreground enquanto a rota está RODANDO (Fase A). Antes bastava
  // estar EM_CURSO — mas o despacho põe a viagem nesse estado ainda no balcão, e
  // com isso o app pedia a localização assim que a rota era aberta, antes de o
  // entregador sequer ter saído. A rota começa no KM de saída; o rastreio também.
  const { rastreando } = useRastreamento(
    viagemId,
    viagem?.situacao === 'EM_CURSO' && viagem?.kmInicial != null,
  );

  // A rota começou: é AQUI que se pede a localização — uma vez, com o entregador
  // parado no veículo lendo o hodômetro. Antes cada baixa pedia por conta própria
  // e o diálogo do sistema aparecia em toda entrega, com o cliente na porta
  // (relatado em campo, 10/08). Da baixa em diante só se CONSULTA a permissão.
  async function pedirLocalizacaoDaRota() {
    if (await garantirPermissaoLocalizacao()) return;
    Alert.alert(
      'Localização desligada',
      'As entregas desta rota serão registradas sem a localização. Para ligar, autorize o acesso à localização nas configurações do aparelho.',
    );
  }

  // Só o encerramento se abre por clique: o KM de SAÍDA não tem botão, o
  // formulário dele já nasce aberto (é o primeiro ato da rota) e a sugestão do
  // odômetro é semeada em `carregar`.
  function abrirEncerramento() {
    // Parte do KM de saída desta rota; sem ele, do odômetro do veículo.
    const base = viagem?.kmInicial ?? viagem?.veiculo?.kmAtual;
    setKmInput(base != null ? String(base) : '');
    setAcaoKm('encerrar');
  }

  async function confirmarKm() {
    if (!viagem) return;
    // ⚠️ NENHUM caminho daqui sai calado. Tocar em "Encerrar" e não ver nada
    // acontecer — nem sucesso, nem erro — foi relatado em campo (10/08): sem
    // mensagem, o entregador não tem como saber se o toque pegou, se o app
    // travou ou o que falta preencher.
    if (kmInput.trim() === '') {
      Alert.alert('KM', 'Informe o número do hodômetro do veículo.');
      return;
    }
    // Sem KM de saída o formulário nasce aberto em 'iniciar' sem ninguém ter
    // clicado — então a ação vem daí quando `acaoKm` ainda está vazio.
    const acao = acaoKm ?? (viagem.kmInicial == null ? 'iniciar' : null);
    if (!acao) {
      Alert.alert('KM', 'Escolha "Encerrar entrega (KM)" para informar o KM de retorno.');
      return;
    }
    const km = Number(kmInput);
    if (!Number.isFinite(km) || km < 0) { Alert.alert('KM', 'Informe um KM válido.'); return; }
    if (acao === 'encerrar' && viagem.kmInicial != null && km < viagem.kmInicial) {
      Alert.alert('KM de retorno', `O KM de retorno (${km}) é menor que o KM de saída (${viagem.kmInicial}).`);
      return;
    }
    // Igual ao de saída = rota com ZERO km rodado. É possível (rota cancelada na
    // porta), mas quase sempre é o campo que veio preenchido e ninguém trocou —
    // e KM rodado zerado contamina custo por km e manutenção preventiva. Pergunta
    // antes, com o número na cara, em vez de gravar calado.
    if (acao === 'encerrar' && viagem.kmInicial != null && km === viagem.kmInicial) {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'KM de retorno igual ao de saída',
          `O hodômetro seria gravado em ${km}, o mesmo da saída — a rota fica com 0 km rodado.\n\n` +
            'Se você rodou, corrija o número. Se a rota não saiu mesmo, pode confirmar.',
          [
            { text: 'Corrigir', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirmar 0 km', style: 'destructive', onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!ok) return;
    }

    // Encerrar é TERMINAL. O servidor recusa rota sem KM de saída ou com entrega
    // sem baixa (`viagem.service.ts`, `concluir`) — o botão já fica travado por
    // isso, e esta checagem é a rede: se algo mudou entre abrir o formulário e
    // confirmar, ele vê o motivo em vez de um erro cru do servidor.
    if (acao === 'encerrar') {
      const impedimentos = impedimentosEncerramento({
        pendentes: entregasPendentes.length,
        kmInicial: viagem.kmInicial ?? null,
      });
      if (impedimentos.length) {
        Alert.alert('Ainda não dá para encerrar', impedimentos.join('\n\n'));
        return;
      }
    }

    setSalvandoKm(true);
    try {
      if (acao === 'iniciar') {
        await iniciarEntrega(viagem.id, km);
        setAcaoKm(null);
        await carregar();
        await pedirLocalizacaoDaRota();
      } else {
        await encerrarEntrega(viagem.id, km);
        avisarEVoltar(() => navigation.goBack(), 'Entrega encerrada', 'Rota concluída e veículo liberado.');
      }
    } catch (e) {
      if (ehErroDeRede(e)) {
        if (acao === 'iniciar') {
          await enfileirarKmEntrega({ tipo: 'iniciar', viagemId: viagem.id, kmInicial: km });
          setViagem((v) => (v ? { ...v, kmInicial: km } : v)); // otimista: reflete o KM de saída na UI
          setAcaoKm(null);
          // Tenta subir NA HORA, em vez de esperar o próximo foco de tela. Se a
          // falha foi um piscar de rede, o KM entra já e a rota nasce válida no
          // servidor — o que evita a baixa seguinte ser recusada por falta dele.
          // Só então o aviso, que assim diz o que de fato aconteceu.
          const r = await processarFilaKmEntrega({ apenas: 'iniciar' });
          if (r.enviadas > 0) {
            await carregar();
          } else if (r.descartadas.length) {
            Alert.alert('KM de saída recusado', r.descartadas.map((d) => `• ${d.rotulo}: ${d.motivo}`).join('\n'));
            await carregar();
          } else {
            Alert.alert('Salvo offline', 'Sem sinal — o KM de saída vai sincronizar quando a conexão voltar.');
          }
          // A rota começou para ele mesmo sem sinal — a permissão é local e não
          // depende do servidor, então pede aqui também.
          await pedirLocalizacaoDaRota();
        } else {
          await enfileirarKmEntrega({ tipo: 'encerrar', viagemId: viagem.id, kmFinal: km });
          avisarEVoltar(() => navigation.goBack(), 'Salvo offline', 'Sem sinal — a entrega vai ENCERRAR quando a conexão voltar.');
        }
      } else {
        const msg = isAxiosError(e) ? (e.response?.data as { message?: string })?.message : undefined;
        Alert.alert('Não foi possível', String(msg || 'Tente novamente.'));
      }
    } finally {
      setSalvandoKm(false);
    }
  }

  // ⚠️ ESTES useCallback FICAM AQUI, ANTES dos `return` antecipados abaixo.
  // Hook depois de return condicional quebra a tela com "Rendered more hooks
  // than during the previous render": no render em que a rota ainda está
  // carregando roda menos hooks que no render completo. Como função comum
  // podiam morar lá embaixo; como hook, não.
  /**
   * ⭐ NAVEGA PRIMEIRO. Nada de `await` entre o dedo e a tela.
   *
   * Aqui havia um `await contarPendentesKmEntrega()` como PRIMEIRA linha — uma
   * leitura do AsyncStorage (SQLite, atravessando a ponte nativa) cobrada em
   * TODO toque, mesmo com a fila vazia. Logo depois de uma baixa a ponte está
   * ocupada (arquivo de foto, filas, re-render), a leitura demora, e o toque
   * parece morto; ele toca de novo, enfileira outra leitura e piora. Era o
   * "tenho que clicar várias vezes até abrir" (Clenio, viagens 36–38).
   *
   * E era leitura desnecessária: `pendKm` já vive no estado, alimentado pelo
   * listener da fila. Dá para decidir sem tocar no disco.
   *
   * O adiantamento do KM continua acontecendo — mas ATRÁS da navegação, sem
   * ninguém esperando. Se o servidor recusar, o aviso aparece na faixa da rota;
   * e se o KM não subir a tempo, a baixa vai para a fila, que já sabe mandar o
   * KM antes das baixas.
   */
  const irParaBaixa = useCallback((e: NonNullable<Parada['entrega']>) => {
    navigation.navigate('Baixa', {
      entregaId: e.id,
      entregaNumero: e.numero,
      destinatario: e.destinatarioNome,
    });

    if (pendKm > 0) {
      void processarFilaKmEntrega({ apenas: 'iniciar' })
        .then((r) => {
          if (r.descartadas.length) {
            publicarAviso(
              `KM de saída recusado — ${r.descartadas.map((d) => `${d.rotulo}: ${d.motivo}`).join('; ')}. Corrija o KM no topo da rota.`,
              'atencao',
            );
          }
          if (r.enviadas > 0 || r.descartadas.length) void carregar();
        })
        .catch(() => undefined);
    }
    // Estável de propósito: `ParadaCard` é memoizado, e prop nova a cada render
    // anularia a memoização — voltando a redesenhar todo cartão da lista.
  }, [navigation, pendKm, carregar]);


  const avisarSemKm = useCallback(() => {
    Alert.alert(
      'Registre a saída primeiro',
      'A rota começa pela leitura do hodômetro. Informe o KM de saída no topo da tela para liberar a navegação, a despesa e as baixas.',
    );
  }, []);

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={CAPUL} />
      </View>
    );
  }
  if (erro || !viagem) {
    return (
      <View style={styles.centro}>
        <Text style={styles.erro}>{erro || 'Viagem não encontrada.'}</Text>
      </View>
    );
  }

  const paradas = [...(viagem.paradas ?? [])].sort((a, b) => a.sequencia - b.sequencia);

  /**
   * Uma parada está RESOLVIDA quando o servidor já a deu por terminal **ou**
   * quando a baixa está no aparelho esperando sinal. Sem a segunda metade, em
   * modo avião a entrega baixada continuava em "Pendentes" com o botão "Dar
   * baixa" — como se nada tivesse acontecido (relato do Clenio, 11/08).
   *
   * Tratar a fila como resolvida é o que também deixa ele **encerrar a rota
   * offline**: a fila sobe as baixas antes do encerrar, então a ordem no
   * servidor sai correta.
   */
  const resolvida = (p: Parada) =>
    p.entrega != null &&
    (p.entrega.status === 'ENTREGUE' ||
      p.entrega.status === 'NAO_ENTREGUE' ||
      baixasNaFila[p.entrega.id] != null);

  const nPendentes = paradas.filter((p) => p.entrega?.status === 'EM_VIAGEM' && !resolvida(p)).length;
  // Conta a não-entrega junto: antes ela não caía em NENHUM filtro (só em
  // "Todas"), então uma recusa sumia da tela.
  const nConcluidas = paradas.filter((p) => resolvida(p)).length;
  const paradasFiltradas = paradas.filter((p) => {
    if (filtro === 'TODAS') return true;
    if (filtro === 'ENTREGUES') return resolvida(p);
    return p.entrega?.status === 'EM_VIAGEM' && !resolvida(p); // PENDENTES
  });

  const chips: { id: Filtro; rotulo: string }[] = [
    { id: 'PENDENTES', rotulo: `Pendentes (${nPendentes})` },
    { id: 'ENTREGUES', rotulo: `Concluídas (${nConcluidas})` },
    { id: 'TODAS', rotulo: `Todas (${paradas.length})` },
  ];

  // Rota completa no Google Maps, e o que impede encerrar: só o que ainda falta
  // DE VERDADE — o que está na fila já foi feito, só não subiu.
  const entregasPendentes = paradas
    .filter((p) => p.entrega?.status === 'EM_VIAGEM' && !resolvida(p))
    .map((p) => p.entrega!);

  // ⭐ A rota começa pela leitura do hodômetro (Clenio, 09/08: "KM é leitura do
  // PAINEL"). O relato do pessoal em teste era iniciar a entrega sem apontar o KM
  // — e era verdade: o despacho (no balcão) já deixava a viagem EM_CURSO, e no app
  // dava para abrir a rota no Maps, navegar e lançar despesa; só a baixa travava,
  // lá na frente, quando o hodômetro já não era mais o de saída.
  // Agora, sem KM de saída, nada que seja RODAR a rota fica disponível: navegar,
  // lançar despesa e dar baixa. Ligar para o cliente segue livre — é preparação,
  // não execução da rota.
  const semKmSaida = viagem.situacao === 'EM_CURSO' && viagem.kmInicial == null;
  // Formulário aberto: por clique (`acaoKm`) ou porque a rota ainda não começou.
  const formKm = acaoKm ?? (semKmSaida ? 'iniciar' : null);
  const impedimentos = impedimentosEncerramento({
    pendentes: entregasPendentes.length,
    kmInicial: viagem.kmInicial ?? null,
  });

  // A baixa exige o KM de saída NO SERVIDOR, e ele pode estar só na fila (o
  // entregador registrou sem sinal, a tela destravou otimista). Se o sinal voltou
  // nesse meio-tempo, subir o KM aqui evita que ele digite a baixa inteira para
  // receber "Registre o KM de saída da rota #N" logo depois de já tê-lo informado.
  // Best-effort: continuando sem sinal, a baixa segue e vai para a fila dela.
  function abrirRotaCompleta() {
    if (semKmSaida) { avisarSemKm(); return; }
    if (entregasPendentes.length === 0) { Alert.alert('Rota', 'Não há entregas pendentes.'); return; }
    const lista = entregasPendentes.slice(0, MAX_PARADAS_MAPS);
    if (entregasPendentes.length > MAX_PARADAS_MAPS) {
      Alert.alert(
        'Rota completa',
        `O Google Maps aceita até ${MAX_PARADAS_MAPS} paradas por vez. Vou abrir as primeiras ${MAX_PARADAS_MAPS}; depois abra de novo para o restante.`,
        [{ text: 'Abrir', onPress: () => void abrirRotaGoogleMaps(lista) }, { text: 'Cancelar', style: 'cancel' }],
      );
      return;
    }
    void abrirRotaGoogleMaps(lista);
  }

  return (
    <View style={{ flex: 1 }}>
    <FlatList
      contentContainerStyle={styles.lista}
      // ⭐ Sem isto, o padrão do RN é `'never'`: com o teclado aberto, o PRIMEIRO
      // toque fora do campo é gasto só para fechá-lo, e o botão só reage no
      // segundo. Esta tela tem o campo de KM (saída e retorno), então o
      // entregador digitava o hodômetro e, logo depois, precisava tocar duas
      // vezes em "Dar baixa" / "Encerrar entrega" — sem nada na tela explicando.
      // `handled`: o toque no botão vale de primeira e o toque no vazio ainda
      // fecha o teclado. (Clenio, viagens 36–39.)
      keyboardShouldPersistTaps="handled"
      data={paradasFiltradas}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View>
          {(pendBaixa > 0 || pendDespesa > 0 || pendKm > 0) && (
            <TouchableOpacity style={styles.filaBanner} onPress={() => void reenviarPendencias()} disabled={reenviandoDespesa}>
              <Text style={styles.filaBannerTxt}>
                {reenviandoDespesa
                  ? 'Reenviando pendências…'
                  : `📴 ${[
                      pendBaixa > 0 ? `${pendBaixa} baixa${pendBaixa === 1 ? '' : 's'}` : null,
                      pendDespesa > 0 ? `${pendDespesa} despesa${pendDespesa === 1 ? '' : 's'}` : null,
                      pendKm > 0 ? `${pendKm} KM` : null,
                    ].filter(Boolean).join(' + ')} aguardando sinal — toque para reenviar`}
              </Text>
            </TouchableOpacity>
          )}
          {rastreando && (
            <View style={styles.rastreioBanner}>
              <Text style={styles.rastreioTxt}>📍 Localização ativa durante a viagem</Text>
            </View>
          )}
          <Text style={styles.cabecalho}>
            {viagem.veiculo?.placa ?? 'sem veículo'} · {paradas.length} parada
            {paradas.length === 1 ? '' : 's'}
          </Text>

          {/* O KM vem ANTES de tudo que é rodar a rota — é o primeiro ato, não um
              botão a descobrir depois de já ter saído com o carro. */}
          {viagem.situacao === 'EM_CURSO' && (
            <View style={[styles.kmBox, semKmSaida && styles.kmBoxAbertura]}>
              {formKm ? (
                <>
                  <Text style={styles.kmTitulo}>{formKm === 'iniciar' ? '🚚 Comece pelo KM de saída' : '🏁 KM de retorno'}</Text>
                  <Text style={styles.kmDica}>
                    {formKm === 'iniciar'
                      ? 'Leia o hodômetro no painel do veículo. Sem esse número a rota não começa: navegação, despesa e baixas ficam travadas.'
                      : `Leia o hodômetro ao chegar. O campo vem com o KM de saída (${viagem.kmInicial ?? 0}) — troque pelo número de agora, que não pode ser menor que ele.`}
                  </Text>
                  <TextInput style={styles.kmInput} value={kmInput} onChangeText={setKmInput} keyboardType="numeric" placeholder="KM no painel" editable={!salvandoKm} />
                  <View style={styles.kmBtns}>
                    <TouchableOpacity style={[styles.kmConfirmar, salvandoKm && { opacity: 0.5 }]} onPress={() => void confirmarKm()} disabled={salvandoKm}>
                      {salvandoKm ? <ActivityIndicator color="#fff" /> : <Text style={styles.kmConfirmarTxt}>{formKm === 'iniciar' ? 'Iniciar entrega' : 'Encerrar entrega'}</Text>}
                    </TouchableOpacity>
                    {/* Sem KM de saída não há para onde cancelar — a rota não começou. */}
                    {acaoKm != null && !semKmSaida && (
                      <TouchableOpacity style={styles.kmCancelar} onPress={() => setAcaoKm(null)} disabled={salvandoKm}><Text style={styles.kmCancelarTxt}>Cancelar</Text></TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <View style={styles.kmAcoes}>
                  <Text style={styles.kmInfo}>🚚 KM de saída: {viagem.kmInicial}</Text>
                  {/* Encerrar exige KM de saída E todas as paradas resolvidas (ponto 1,
                      09/08). Antes o encerramento marcava as pendentes como ENTREGUE sem
                      comprovante — a tela avisava, mas deixava. O servidor recusa de
                      qualquer forma, e deixar tocar só para receber erro é pior do que
                      não deixar tocar: o botão fica travado com o motivo embaixo. */}
                  {/* Apagado quando não dá, mas AINDA tocável — o toque diz o
                      porquê. Botão morto não avisa nada: tocar e não acontecer
                      nada foi lido como app travado (relato de campo, 10/08). */}
                  <TouchableOpacity
                    style={[styles.kmBtnEncerrar, impedimentos.length > 0 && styles.kmBtnOff]}
                    onPress={() =>
                      impedimentos.length
                        ? Alert.alert('Ainda não dá para encerrar', impedimentos.join('\n\n'))
                        : abrirEncerramento()
                    }>
                    <Text style={styles.kmBtnEncerrarTxt}>🏁 Encerrar entrega (KM)</Text>
                  </TouchableOpacity>
                  {impedimentos.map((i) => (
                    <Text key={i} style={styles.kmAviso}>{i}</Text>
                  ))}
                </View>
              )}
            </View>
          )}

          {entregasPendentes.length > 1 && (
            <TouchableOpacity style={[styles.rotaCompleta, semKmSaida && styles.botaoOff]} onPress={abrirRotaCompleta}>
              <Text style={styles.rotaCompletaTxt}>🗺️ Rota completa no Google Maps ({entregasPendentes.length} paradas)</Text>
            </TouchableOpacity>
          )}

          {viagem.situacao === 'EM_CURSO' && (
            <TouchableOpacity
              style={[styles.despesaBtn, semKmSaida && styles.botaoOff]}
              onPress={() =>
                semKmSaida
                  ? avisarSemKm()
                  : navigation.navigate('DespesaEntrega', { viagemId: viagem.id, placa: viagem.veiculo?.placa })
              }
            >
              <Text style={styles.despesaBtnTxt}>💸 Lançar despesa (ex.: abastecer)</Text>
            </TouchableOpacity>
          )}
          <View style={styles.filtros}>
            {chips.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.filtroChip, filtro === c.id && styles.filtroChipOn]}
                onPress={() => setFiltro(c.id)}
              >
                <Text style={[styles.filtroTxt, filtro === c.id && styles.filtroTxtOn]}>{c.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.vazio}>
          {paradas.length === 0
            ? 'Esta viagem não tem paradas.'
            : filtro === 'PENDENTES'
              ? 'Nenhuma entrega pendente — tudo entregue por aqui! 🎉'
              : filtro === 'ENTREGUES'
                ? 'Nenhuma entrega concluída ainda.'
                : 'Nada para mostrar.'}
        </Text>
      }
      renderItem={({ item }) => (
        <ParadaCard
          parada={item}
          // Trava: sem KM de saída a rota não começou — nem navegar nem baixar. O
          // servidor recusa a baixa (`entrega.service.ts`), e navegar antes do
          // hodômetro é justamente como o KM de saída se perdia.
          bloqueadoSemKm={semKmSaida}
          onBloqueado={avisarSemKm}
          naFila={item.entrega ? baixasNaFila[item.entrega.id] : undefined}
          onBaixar={irParaBaixa}
        />
      )}
    />
      {/* ⚠️ FLUTUANTE, fora do cabeçalho da lista. Dentro dele, aparecer e sumir
          reposicionava tudo: o botão saía de baixo do dedo justamente enquanto
          ele tocava. E `pointerEvents="none"` para não roubar toque nenhum. */}
      {aviso && (
        <View
          style={[styles.avisoBanner, aviso.tipo === 'atencao' && styles.avisoBannerAtencao]}
          pointerEvents="none"
        >
          <Text style={styles.avisoTxt}>{aviso.texto}</Text>
        </View>
      )}
    </View>
  );
}

const ParadaCard = React.memo(function ParadaCard({
  parada,
  onBaixar,
  bloqueadoSemKm = false,
  onBloqueado,
  naFila,
}: {
  parada: Parada;
  onBaixar: (e: NonNullable<Parada['entrega']>) => void;
  bloqueadoSemKm?: boolean;
  onBloqueado?: () => void;
  /** Baixa feita no aparelho, esperando sinal (o servidor ainda não sabe). */
  naFila?: 'ENTREGUE' | 'NAO_ENTREGUE';
}) {
  const e = parada.entrega;
  if (!e) {
    return (
      <View style={styles.card}>
        <Text style={styles.seq}>Parada {parada.sequencia}</Text>
        <Text style={styles.obs}>{parada.local ?? 'Parada sem entrega vinculada.'}</Text>
      </View>
    );
  }
  const entregue = e.status === 'ENTREGUE';
  return (
    <View style={styles.card}>
      <View style={styles.topo}>
        <Text style={styles.seq}>
          {parada.sequencia}. {e.destinatarioNome}
        </Text>
        {/* A fila manda no rótulo: o status do servidor ainda diz EM_VIAGEM,
            porque offline ele não recebeu a baixa. Quem trabalhou é quem vale. */}
        <Text style={[styles.status, (entregue || naFila === 'ENTREGUE') && styles.statusOk, naFila && styles.statusFila]}>
          {naFila ? '📴 AGUARDANDO SINAL' : e.status}
        </Text>
      </View>
      <Text style={styles.endereco}>{enderecoTexto(e)}</Text>
      {e.endComplemento ? <Text style={styles.linha}>Compl.: {e.endComplemento}</Text> : null}
      {e.endReferencia ? <Text style={styles.linha}>Ref.: {e.endReferencia}</Text> : null}
      <Text style={styles.linha}>
        {e.quantidadeVolumes} volume{e.quantidadeVolumes === 1 ? '' : 's'}
        {e.horario ? ` · ${e.horario}` : ''}
      </Text>
      {e.observacoes ? <Text style={styles.obs}>Obs.: {e.observacoes}</Text> : null}

      <View style={styles.acoes}>
        {/* Navegar É rodar a rota — trava junto com a baixa enquanto faltar o KM
            de saída. "Ligar" fica livre: confirmar com o cliente antes de sair é
            preparação, não execução. */}
        <TouchableOpacity
          style={[styles.btn, styles.btnWaze, bloqueadoSemKm && styles.botaoOff]}
          onPress={() => (bloqueadoSemKm ? onBloqueado?.() : void abrirWaze(e))}>
          <Text style={styles.btnTxt}>Waze</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnMaps, bloqueadoSemKm && styles.botaoOff]}
          onPress={() => (bloqueadoSemKm ? onBloqueado?.() : void abrirGoogleMaps(e))}>
          <Text style={styles.btnTxt}>Maps</Text>
        </TouchableOpacity>
        {e.telefone ? (
          <TouchableOpacity style={[styles.btn, styles.btnTel]} onPress={() => void ligar(e.telefone!)}>
            <Text style={styles.btnTxt}>Ligar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {naFila ? (
        // Sem botão de baixa: já foi baixada aqui. Oferecer de novo convidaria a
        // duplicar a mesma entrega na fila.
        <Text style={styles.naFilaAviso}>
          {naFila === 'ENTREGUE' ? 'Entrega registrada' : 'Não-entrega registrada'} neste aparelho —
          sobe sozinha quando a conexão voltar.
        </Text>
      ) : e.status === 'EM_VIAGEM' ? (
        // ⚠️ SEM `disabled` e SEM estado de "preparando": o toque leva DIRETO
        // para a tela de baixa. Qualquer trabalho antes de navegar — nem que
        // fosse uma leitura de disco — é toque que não responde.
        <TouchableOpacity
          style={[styles.btnBaixa, bloqueadoSemKm && styles.btnBaixaOff]}
          onPress={() => (bloqueadoSemKm ? onBloqueado?.() : onBaixar(e))}
        >
          <Text style={[styles.btnBaixaTxt, bloqueadoSemKm && styles.btnBaixaTxtOff]}>
            {bloqueadoSemKm ? '🔒 Registre o KM de saída' : '✓ Dar baixa'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  erro: { color: '#dc2626', fontSize: 15, textAlign: 'center' },
  lista: { padding: 12, gap: 10 },
  cabecalho: { color: '#475569', fontSize: 14, marginBottom: 8 },
  rotaCompleta: { backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', marginBottom: 10 },
  rotaCompletaTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  kmBox: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10, gap: 8 },
  // Rota que ainda não começou: o box é o assunto da tela, não mais um cartão.
  kmBoxAbertura: { borderColor: CAPUL, borderWidth: 2, backgroundColor: '#f0fdf4' },
  // Travado por falta de KM de saída: apagado, mas AINDA tocável — o toque explica
  // o porquê. Botão morto deixaria o entregador sem saber o que fazer.
  botaoOff: { opacity: 0.45 },
  kmAcoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  kmInfo: { fontSize: 13, fontWeight: '600', color: '#475569' },
  kmBtnIniciar: { backgroundColor: CAPUL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  kmBtnIniciarTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  kmBtnOff: { opacity: 0.45 },
  kmBtnEncerrar: { borderWidth: 1, borderColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  kmBtnEncerrarTxt: { color: '#1d4ed8', fontWeight: '700', fontSize: 13 },
  kmTitulo: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  kmDica: { fontSize: 12, color: '#64748b' },
  kmInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, backgroundColor: '#fff' },
  kmBtns: { flexDirection: 'row', gap: 8 },
  kmConfirmar: { flex: 1, backgroundColor: CAPUL, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  kmConfirmarTxt: { color: '#fff', fontWeight: '700' },
  kmCancelar: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  kmCancelarTxt: { color: '#475569', fontWeight: '600' },
  filaBanner: { backgroundColor: '#f59e0b', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 },
  filaBannerTxt: { color: '#fff', fontWeight: '700', fontSize: 12, textAlign: 'center' },
  despesaBtn: { borderWidth: 1, borderColor: '#b45309', backgroundColor: '#fffbeb', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', marginBottom: 10 },
  despesaBtnTxt: { color: '#b45309', fontWeight: '700', fontSize: 13 },
  rastreioBanner: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
  rastreioTxt: { color: '#047857', fontSize: 12, fontWeight: '600' },
  filtros: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filtroChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#fff' },
  filtroChipOn: { backgroundColor: CAPUL, borderColor: CAPUL },
  filtroTxt: { color: '#334155', fontWeight: '700', fontSize: 13 },
  filtroTxtOn: { color: '#fff' },
  vazio: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seq: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1, paddingRight: 8 },
  status: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  statusOk: { color: CAPUL, backgroundColor: '#dcfce7' },
  // Feita no aparelho, ainda não no servidor — âmbar, como o banner da fila.
  statusFila: { color: '#92400e', backgroundColor: '#fef3c7' },
  naFilaAviso: { marginTop: 10, color: '#b45309', fontSize: 13, fontWeight: '600' },
  endereco: { color: '#1e293b', fontSize: 15, marginTop: 8 },
  linha: { color: '#475569', fontSize: 14, marginTop: 4 },
  obs: { color: '#64748b', fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  acoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnWaze: { backgroundColor: '#33ccff' },
  btnMaps: { backgroundColor: '#4285F4' },
  btnTel: { backgroundColor: CAPUL },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnBaixa: {
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  btnBaixaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Travado: cinza e "apagado", mas AINDA tocável — o toque explica o porquê e
  // oferece registrar o KM na hora. Botão morto deixaria o entregador sem saída.
  btnBaixaOff: { backgroundColor: '#e2e8f0' },
  btnBaixaTxtOff: { color: '#64748b' },
  kmAviso: { width: '100%', color: '#b45309', fontSize: 12, fontWeight: '600' },
  // Confirmação do que acabou de acontecer (substitui o Alert). Some em 5s.
  avisoBanner: { position: 'absolute', top: 8, left: 12, right: 12, backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, elevation: 4 },
  avisoBannerAtencao: { backgroundColor: '#fef3c7', borderColor: '#fcd34d' },
  avisoTxt: { color: '#14532d', fontSize: 13, fontWeight: '700' },
});
