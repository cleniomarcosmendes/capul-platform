// ============================================================================
// SEED — Módulo RH · Avaliação de Desempenho
//
// GERADO a partir do modelo real do Protheus:
//   RD8010 modelo '000004' / comitê '000001'  +  SQP010  +  RDB010 tipo '000007'
//
// 15 questões · 4 alternativas cada · valores 0,3 / 0,6 / 0,9 / 1,2
// Soma dos máximos = 18,0 (confere com o /18 do select antigo)
//
// ESTRUTURA (reestruturação de 05/09/2026):
//   • O MODELO é só o questionário. Grupo é organização visual e NÃO tem peso —
//     todo o peso está na Pergunta. Peso em dois níveis tornava impossível
//     prever o efeito de mudar um número.
//   • Os CRITÉRIOS CADASTRAIS (escolaridade, tempo de casa, cursos) saíram do
//     modelo: ficam no catálogo, e o peso de cada um é por perfil, em
//     AplicacaoCriterio. O avaliador não pode ver "Tempo de Empresa: 75 pontos"
//     ao lado das perguntas que vai responder — ancora o julgamento.
//   • Por isso o seed cria o CATÁLOGO e os MODELOS, e nenhuma Aplicação: ela
//     só existe dentro de um ciclo, montada pelo RH.
//
// ATENÇÃO — o que aqui é DECISÃO DA GESTORA DE RH e está apenas pré-preenchido:
//   1. Títulos das questões: derivados do texto das alternativas (o Protheus
//      não exporta o enunciado). Conferir.
//   2. Agrupamento das questões.
//   3. PESOS: os números vieram dos pesos que eram por grupo e foram
//      redistribuídos entre as perguntas preservando o total. Ponto de partida
//      para ajustar, não recomendação fechada.
//
// JÁ CONFERIDO CONTRA O PROTHEUS (05/09/2026, capulmig — 1.036 colaboradores):
//   • Faixas de escolaridade: rótulos agora são a descrição REAL do SX5 tabela
//     26, código a código (antes estavam deslocados uma casa). A PONTUAÇÃO é a
//     do select original e não se mexe sem decisão do RH —
//     ver docs/DECISAO_RH_ESCOLARIDADE.md.
//   • O critério de treinamento nasce INATIVO no catálogo: o registro no
//     Protheus parou em 14/11/2025 e zero curso hoje significa "não
//     registrado", não "não fez".
//   • Faixas de conceito contíguas (0–25–50–75–90–100), inferior inclusivo e
//     superior exclusivo — elimina o buraco em 24,5.
//
// Este arquivo é a ÚNICA versão viva do seed. `docs/seed-rh.ts` foi o insumo e
// está superado — não editar lá.
//
// Texto das alternativas: PRESERVADO do original, apenas normalizado de
// CAIXA ALTA para sentença.
// ============================================================================

import { PrismaClient } from '@prisma/client';
import { distribuirPeso } from '../src/modelo/distribuir-peso';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Banco de questões (dados reais)
// ---------------------------------------------------------------------------

type Alternativa = { codigo: string; descricao: string; valor: number };
type Questao = { codigo: string; titulo: string; alternativas: Alternativa[] };

const QUESTOES: Record<string, Questao> = {
  '004': {
    codigo: '004',
    titulo: 'Assiduidade',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Falta muito ao trabalho, com ou sem justificativa.' },
      { codigo: '02', valor: 0.6, descricao: 'Falta ao trabalho com motivos justificados.' },
      { codigo: '03', valor: 0.9, descricao: 'Raramente falta no trabalho.' },
      { codigo: '04', valor: 1.2, descricao: 'Não há faltas ao trabalho.' },
    ],
  },
  '005': {
    codigo: '005',
    titulo: 'Pontualidade',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Atrasa com frequência com e sem justificativa.' },
      { codigo: '02', valor: 0.6, descricao: 'Atrasa as vezes com motivo justificado.' },
      { codigo: '03', valor: 0.9, descricao: 'Raramente atrasa ao trabalho.' },
      { codigo: '04', valor: 1.2, descricao: 'Não há atrasos.' },
    ],
  },
  '006': {
    codigo: '006',
    titulo: 'Trabalho em Equipe',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Prefere trabalhar sozinho, foca apenas o próprio resultado.' },
      { codigo: '02', valor: 0.6, descricao: 'Prefere trabalhar sozinho, mas se solicita auxilia o colega.' },
      { codigo: '03', valor: 0.9, descricao: 'Entrosa-se bem com os demais, mas não tem muito interesse em ajudar o colega.' },
      { codigo: '04', valor: 1.2, descricao: 'Auxilia os colegas e tem facilidade para trabalhar em equipe.' },
    ],
  },
  '007': {
    codigo: '007',
    titulo: 'Respeito e Cordialidade',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Não tem humildade, não respeita o outro.' },
      { codigo: '02', valor: 0.6, descricao: 'Denota certa dificuldade em ouvir o outro e ser educado na solução de conflitos.' },
      { codigo: '03', valor: 0.9, descricao: 'Entrosou-se bem com os demais, mas precisa ter mais cautela ao se comunicar.' },
      { codigo: '04', valor: 1.2, descricao: 'E educado e conseguiu boa aceitação da equipe e dos clientes.' },
    ],
  },
  '008': {
    codigo: '008',
    titulo: 'Iniciativa e Proatividade',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Não realiza atividades extras e quando solicitado demonstra insatisfação em ter que realizar algo fora de seu cargo.' },
      { codigo: '02', valor: 0.6, descricao: 'Realiza apenas os trabalhos destinados ao seu cargo, não tem interesse em aprender e trocar experiências.' },
      { codigo: '03', valor: 0.9, descricao: 'Busca conhecer e executar algumas atividades específicas, buscando aprender algumas outras atividades.' },
      { codigo: '04', valor: 1.2, descricao: 'Sempre executando novas atividades, busca aprender e tem atitude para agir.' },
    ],
  },
  '009': {
    codigo: '009',
    titulo: 'Flexibilidade e Colaboração',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Se recusa a auxiliar em outras tarefas ou funções, deixando claro que não faz parte de suas responsabilidades.' },
      { codigo: '02', valor: 0.6, descricao: 'Não havendo outra opção atua de forma momentânea em outras tarefas, mas e perceptível que não gosta.' },
      { codigo: '03', valor: 0.9, descricao: 'Caso seja solicitado se dispõe a auxiliar por um tempo em outras tarefas ou funções.' },
      { codigo: '04', valor: 1.2, descricao: 'Disposto a exercer diferentes tarefas e auxiliar em outras funções sempre que necessario.' },
    ],
  },
  '010': {
    codigo: '010',
    titulo: 'Organização e Conclusão de Tarefas',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Deixa atividades sem finalizar, não se organiza para conseguir realizar as entregas devidas.' },
      { codigo: '02', valor: 0.6, descricao: 'Dificuldade em executar com qualidade e finalizar algumas atividades que inicia.' },
      { codigo: '03', valor: 0.9, descricao: 'Inicia as atividades mas nem sempre consegue finalizar com qualidade todas as responsabilidades.' },
      { codigo: '04', valor: 1.2, descricao: 'Facilidade em manter a sequência das atividades, executa com qualidade e finaliza as tarefas.' },
    ],
  },
  '011': {
    codigo: '011',
    titulo: 'Conduta e Normas Internas',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Não segue as normas e regras internas, tem conduta inadequada ao ambiente de trabalho.' },
      { codigo: '02', valor: 0.6, descricao: 'Conhece pouco do manual de conduta e por vezes precisa ser alertado quanto a condutas não permitidas.' },
      { codigo: '03', valor: 0.9, descricao: 'Conhece as regras e normas internas e raramente deixa de seguir alguma destas.' },
      { codigo: '04', valor: 1.2, descricao: 'Conhece e respeita as regras e normas da empresa, segue o manual de conduta com exatidão.' },
    ],
  },
  '012': {
    codigo: '012',
    titulo: 'Atendimento ao Cliente',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Não demonstra simpatia com o cliente e atende de forma muito operacional.' },
      { codigo: '02', valor: 0.6, descricao: 'Precisa melhorar a tranquilidade ao mostrar os produtos ao cliente, ter mais paciência com alguns perfis de clientes.' },
      { codigo: '03', valor: 0.9, descricao: 'Atende com qualidade, e educado com o cliente.' },
      { codigo: '04', valor: 1.2, descricao: 'Total disponibilidade e atenção ao cliente, atende com presteza e simpatia todos os clientes que entram na loja.' },
    ],
  },
  '013': {
    codigo: '013',
    titulo: 'Energia e Motivação',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Denota pouco interesse em agir, fica muito sentado e não tem boa energia para agir, desmotivado.' },
      { codigo: '02', valor: 0.6, descricao: 'Revela interesse em realizar o que lhe e solicitado, pouca energia para ação, precisa ser solicitado.' },
      { codigo: '03', valor: 0.9, descricao: 'Apresenta interesse e disponibilidade para o trabalho, apresenta-se com disposição.' },
      { codigo: '04', valor: 1.2, descricao: 'Apresenta boa energia para o trabalho, motivado e interessado em gerar resultados com qualidade.' },
    ],
  },
  '014': {
    codigo: '014',
    titulo: 'Adaptabilidade a Mudanças',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Denota dificuldade para se adaptar a mudanças ou solicitações fora de sua realidade.' },
      { codigo: '02', valor: 0.6, descricao: 'Revela certa dificuldade em realizar tarefas novas, mas aos poucos acaba se adaptando.' },
      { codigo: '03', valor: 0.9, descricao: 'Apresenta interesse e disponibilidade para novos trabalhos e aprendizados, se adapta bem ao ambiente e tarefas.' },
      { codigo: '04', valor: 1.2, descricao: 'Apresenta muita facilidade com o novo, gosta de fazer parte das inovações e busca aprender sempre.' },
    ],
  },
  '015': {
    codigo: '015',
    titulo: 'Zelo pelos Equipamentos',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Denota pouco cuidado e preocupação com os equipamentos que utiliza.' },
      { codigo: '02', valor: 0.6, descricao: 'Busca manter os equipamentos em bom estado, mas não tem a preocupação de conservação e prevenção.' },
      { codigo: '03', valor: 0.9, descricao: 'Apresenta cuidado e preocupação com os equipamentos que utiliza para o trabalho.' },
      { codigo: '04', valor: 1.2, descricao: 'Sempre zela dos equipamentos, mantém limpos e organizados e evita qualquer incidente.' },
    ],
  },
  '016': {
    codigo: '016',
    titulo: 'Conhecimento Técnico do Maquinário',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Denota pouca noção do trabalho a ser realizado, tem pouco conhecimento do maquinário.' },
      { codigo: '02', valor: 0.6, descricao: 'Revela interesse em aprender e tem estudado, já demonstrando boa noção do maquinário.' },
      { codigo: '03', valor: 0.9, descricao: 'Revela bom conhecimento técnico sobre o maquinário e busca se atualizar.' },
      { codigo: '04', valor: 1.2, descricao: 'Entende muito do maquinário, estuda e busca se aprimorar sobre toda inovação.' },
    ],
  },
  '017': {
    codigo: '017',
    titulo: 'Metas e Trabalho sob Pressão',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'Não tem conseguido alcançar as metas sugeridas.' },
      { codigo: '02', valor: 0.6, descricao: 'Dificuldade para lidar com pressão, fica nervoso e prejudica rendimento.' },
      { codigo: '03', valor: 0.9, descricao: 'Lida bem com pressão, certa dificuldade em alcançar as metas.' },
      { codigo: '04', valor: 1.2, descricao: 'Lida bem com pressão e consegue alcançar as metas.' },
    ],
  },
  '018': {
    codigo: '018',
    titulo: 'Apresentação Pessoal',
    alternativas: [
      { codigo: '01', valor: 0.3, descricao: 'O funcionário não cuida da aparência para o trabalho.' },
      { codigo: '02', valor: 0.6, descricao: 'Nem sempre vem trabalhar com uniforme bem cuidado, aparência geral precisa ser melhorada.' },
      { codigo: '03', valor: 0.9, descricao: 'As vezes se apresenta no trabalho com aparência desleixada, mas no geral se preocupa em estar bem cuidado.' },
      { codigo: '04', valor: 1.2, descricao: 'O funcionário cuida da sua apresentação pessoal e esta sempre adequado ao ambiente de trabalho.' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Agrupamento — núcleo comum + blocos específicos por perfil.
// Grupo é ORGANIZAÇÃO VISUAL: não tem peso. O peso mora na Pergunta.
// ---------------------------------------------------------------------------

const GRUPOS = {
  ASSIDUIDADE:   { titulo: 'Assiduidade e Pontualidade',   questoes: ['004', '005'] },
  RELACIONAMENTO:{ titulo: 'Relacionamento e Conduta',     questoes: ['006', '007', '011'] },
  INICIATIVA:    { titulo: 'Iniciativa e Adaptabilidade',  questoes: ['008', '009', '014'] },
  QUALIDADE:     { titulo: 'Qualidade e Organização',      questoes: ['010', '013', '015'] },
  ATENDIMENTO:   { titulo: 'Atendimento ao Cliente',       questoes: ['012'] },
  TECNICO:       { titulo: 'Conhecimento Técnico',         questoes: ['016'] },
  RESULTADOS:    { titulo: 'Metas e Trabalho sob Pressão', questoes: ['017'] },
  APRESENTACAO:  { titulo: 'Apresentação Pessoal',         questoes: ['018'] },
} as const;

// ---------------------------------------------------------------------------
// FAIXAS DOS CRITÉRIOS — extraídas dos CASE WHEN do select antigo.
// Vivem no CATÁLOGO (rh.criterio_faixa -> rh.criterio), porque são IGUAIS para
// todos os centros de custo (C8). O que varia por perfil é o PESO, que fica em
// AplicacaoCriterio. C9: sem faixa "else 0" — ausência de dado vira semDado e
// o critério sai do numerador E do denominador.
// ---------------------------------------------------------------------------

// RÓTULO = descrição REAL do SX5 tabela 26, código a código, verbatim do ERP
// (conferido em capulmig/capulhlg em 05/09/2026). Os rótulos anteriores eram
// derivados e estavam DESLOCADOS uma casa: chamavam o código 45 (segundo grau
// COMPLETO) de "Fundamental / Médio incompleto" e o 55 (superior COMPLETO) de
// "Superior incompleto". Rótulo errado é pior que rótulo ausente — ele explica
// a nota para o avaliado com a palavra trocada.
//
// PONTUAÇÃO = a do select original, INALTERADA (10–45=25, 50=50, 55=75,
// 65/75/85/95=100). A gestora de RH confirmou por escrito que as faixas atuais
// continuam valendo, e isto decide mérito para 661 das 1.036 pessoas — não é
// decisão de quem implementa. Revisão em curso: docs/DECISAO_RH_ESCOLARIDADE.md.
// Se ela mudar, é UPDATE em rh.criterio_faixa — não mexe em código.
//
// Uma faixa por código: cobre os 13 valores do domínio, sem buraco nem
// sobreposição. Entre parênteses, a população em 05/09/2026.
const FAIXAS_ESCOLARIDADE = [
  { dominio: '10', pontuacao: 25,  rotulo: 'ANALFABETO' },                                          // 3
  { dominio: '20', pontuacao: 25,  rotulo: 'ATE 4ª SERIE INCOMPLETA (PRIMARIO INCOMPLETO)' },       // 9
  { dominio: '25', pontuacao: 25,  rotulo: 'COM 4ª SERIE COMPLETA DO 1º GRAU (PRIMARIO COMPLETO)' },// 27
  { dominio: '30', pontuacao: 25,  rotulo: 'PRIMEIRO GRAU (GINASIO) INCOMPLETO' },                  // 95
  { dominio: '35', pontuacao: 25,  rotulo: 'PRIMEIRO GRAU (GINASIO) COMPLETO' },                    // 68
  { dominio: '40', pontuacao: 25,  rotulo: 'SEGUNDO GRAU (COLEGIAL) INCOMPLETO' },                  // 138
  { dominio: '45', pontuacao: 25,  rotulo: 'SEGUNDO GRAU (COLEGIAL) COMPLETO' },                    // 480
  { dominio: '50', pontuacao: 50,  rotulo: 'SUPERIOR INCOMPLETO' },                                 // 74
  { dominio: '55', pontuacao: 75,  rotulo: 'SUPERIOR COMPLETO' },                                   // 107
  { dominio: '65', pontuacao: 100, rotulo: 'MESTRADO COMPLETO' },                                   // 1
  { dominio: '75', pontuacao: 100, rotulo: 'DOUTORADO COMPLETO' },                                  // 0
  { dominio: '85', pontuacao: 100, rotulo: 'POS-GRADUACAO/ESPECIALIZACAO' },                        // 33
  { dominio: '95', pontuacao: 100, rotulo: 'POS-DOUTORADO' },                                       // 1
];

const FAIXAS_TEMPO_EMPRESA = [
  { inf: 0, sup: 0,    incInf: true,  incSup: true, pontuacao: 0,   rotulo: 'Menos de 1 ano' },
  { inf: 0, sup: 3,    incInf: false, incSup: true, pontuacao: 25,  rotulo: 'Até 3 anos' },
  { inf: 3, sup: 5,    incInf: false, incSup: true, pontuacao: 50,  rotulo: 'De 3 a 5 anos' },
  { inf: 5, sup: 7,    incInf: false, incSup: true, pontuacao: 75,  rotulo: 'De 5 a 7 anos' },
  { inf: 7, sup: null, incInf: false, incSup: true, pontuacao: 100, rotulo: 'Mais de 7 anos' },
];

const FAIXAS_TEMPO_FUNCAO = [
  { inf: 0, sup: 0,    incInf: true,  incSup: true, pontuacao: 0,   rotulo: 'Menos de 1 ano' },
  { inf: 0, sup: 2,    incInf: false, incSup: true, pontuacao: 25,  rotulo: 'Até 2 anos' },
  { inf: 2, sup: 4,    incInf: false, incSup: true, pontuacao: 50,  rotulo: 'De 2 a 4 anos' },
  { inf: 4, sup: 6,    incInf: false, incSup: true, pontuacao: 75,  rotulo: 'De 4 a 6 anos' },
  { inf: 6, sup: null, incInf: false, incSup: true, pontuacao: 100, rotulo: 'Mais de 6 anos' },
];

const FAIXAS_TREINAMENTO = [
  { inf: 0, sup: 0,    incInf: true,  incSup: true, pontuacao: 0,   rotulo: 'Nenhum curso' },
  { inf: 0, sup: 2,    incInf: false, incSup: true, pontuacao: 25,  rotulo: '1 a 2 cursos' },
  { inf: 2, sup: 5,    incInf: false, incSup: true, pontuacao: 50,  rotulo: '3 a 5 cursos' },
  { inf: 5, sup: 8,    incInf: false, incSup: true, pontuacao: 75,  rotulo: '6 a 8 cursos' },
  { inf: 8, sup: null, incInf: false, incSup: true, pontuacao: 100, rotulo: 'Mais de 8 cursos' },
];

// ---------------------------------------------------------------------------
// CATÁLOGO DE CRITÉRIOS (rh.criterio + rh.criterio_faixa).
//
// Os quatro são CALCULADOS: o valor sai de um resolver do backend, ligado pelo
// `codigoCalculo`. O RH administra nome, unidade e faixas; criar um critério
// calculado NOVO exige código, e por isso não é tela.
//
// ⚠️ `codigoCalculo` tem de casar com uma chave de
// src/calculo/resolvers/registry.ts. Isso é validado em TRÊS momentos — ao
// salvar o critério, ao montar a Aplicação e na abertura do ciclo — porque um
// código errado não quebra: o critério devolve vazio em silêncio para o ciclo
// inteiro.
//
// ⚠️ CRITÉRIO NÃO TEM PESO AQUI. O peso é por perfil e vive em
// AplicacaoCriterio, montada pelo RH quando houver ciclo. Critério que não for
// listado na Aplicação simplesmente não entra na apuração daquele perfil.
// ---------------------------------------------------------------------------

const CRITERIOS = [
  {
    codigo: 'ESCOLARIDADE',
    nome: 'Escolaridade',
    descricao: 'Grau de instrução do cadastro do Protheus (RA_GRINRAI / SX5 tabela 26).',
    tipoValor: 'DOMINIO' as const,
    codigoCalculo: 'ESCOLARIDADE',
    unidade: null,
    ativo: true,
    faixas: FAIXAS_ESCOLARIDADE,
  },
  {
    codigo: 'TEMPO_EMPRESA',
    nome: 'Tempo de Empresa',
    descricao: 'Anos entre a admissão e a data-base do ciclo. Preservado na transferência de filial.',
    tipoValor: 'NUMERICO' as const,
    codigoCalculo: 'TEMPO_EMPRESA',
    unidade: 'anos',
    ativo: true,
    faixas: FAIXAS_TEMPO_EMPRESA,
  },
  {
    codigo: 'TEMPO_FUNCAO',
    nome: 'Tempo na Função',
    descricao:
      'Anos desde a última TROCA de função (SR7010). Dissídio anual não conta como troca — ver src/sincronizacao/data-ultima-funcao.ts.',
    tipoValor: 'NUMERICO' as const,
    codigoCalculo: 'TEMPO_FUNCAO',
    unidade: 'anos',
    ativo: true,
    faixas: FAIXAS_TEMPO_FUNCAO,
  },
  {
    // ⚠️ NASCE INATIVO. O registro de treinamento no Protheus PAROU: 896 pessoas
    // com curso em 2023, 817 em 2024, 34 em 2025 e nada depois de 14/11/2025 —
    // queda GERAL, em todas as filiais. Zero curso hoje significa "deixou-se de
    // registrar", não "não fez", e o critério trata zero como valor legítimo:
    // com a janela de 12 meses, 6 pessoas de 1.036 pontuariam e o resto ficaria
    // na faixa mínima.
    //
    // Inativo (e não peso zero) porque agora o peso é por Aplicação: peso zero
    // teria de ser lembrado em toda aplicação nova, e a primeira que esquecesse
    // ligaria o critério sem querer. Inativo, ele nem é oferecido na montagem —
    // e as três validações recusam critério inativo em uso.
    //
    // Reativar é um clique quando o RH explicar por que o registro parou.
    // Ver docs/DECISAO_RH_ESCOLARIDADE.md §4.
    codigo: 'QTDE_TREINAMENTO',
    nome: 'Treinamentos no Período',
    /**
     * ⚠️ MESMO TEXTO da migration `20260912020000_motivo_do_criterio_inativo`.
     * Base nova (seed) e base existente (migration) precisam dizer a mesma
     * coisa — duas redações do mesmo motivo envelhecem separadas, e quem lê uma
     * não sabe que existe a outra.
     */
    descricao:
      'DESATIVADO (decisão de 05/09/2026, revista em 11/09): o registro de treinamento no ' +
      'Protheus parou em 14/11/2025 — 1.188 registros em 2023, 1.011 em 2024, 64 em 2025 e ' +
      'nada depois. Na janela de 12 meses do Piloto, 6 pessoas de 1.036 pontuariam. Ligar ' +
      'assim puniria as outras por falta de REGISTRO, não por falta de curso: o critério não ' +
      'distingue as duas coisas. Só religar depois que o RH esclarecer por que o registro ' +
      'parou. O resolver, as faixas e a tela já existem — falta o dado.',
    tipoValor: 'NUMERICO' as const,
    codigoCalculo: 'QTDE_TREINAMENTO',
    unidade: 'cursos',
    ativo: false,
    faixas: FAIXAS_TREINAMENTO,
  },
];

// ---------------------------------------------------------------------------
// MODELOS — agora SÓ o questionário.
//
// Os números abaixo são os pesos que antes ficavam no GRUPO; o seed os
// redistribui entre as perguntas de cada grupo, preservando o total (ver
// src/modelo/distribuir-peso.ts). São ponto de partida para a gestora de RH
// ajustar, não recomendação fechada — e a tela de montagem mostra o somatório
// por grupo para ela enxergar o balanço.
//
// O quanto o questionário vale FRENTE aos critérios cadastrais não está mais
// aqui: é `Aplicacao.pesoAvaliacao`, definido quando o ciclo é montado.
// ---------------------------------------------------------------------------

type PesoDeGrupo = { chave: keyof typeof GRUPOS; peso: number };

const MODELOS: {
  nome: string;
  descricao: string;
  finalidade: 'PRODUCAO' | 'DEMONSTRACAO';
  grupos: PesoDeGrupo[];
}[] = [
  {
    nome: 'Operação de Loja',
    descricao: 'Supermercados, postos e agroveterinária — foco em atendimento.',
    finalidade: 'PRODUCAO',
    grupos: [
      { chave: 'ASSIDUIDADE',    peso:  9 },
      { chave: 'RELACIONAMENTO', peso: 10 },
      { chave: 'INICIATIVA',     peso:  9 },
      { chave: 'QUALIDADE',      peso:  9 },
      { chave: 'ATENDIMENTO',    peso: 13 },
      { chave: 'RESULTADOS',     peso:  5 },
      { chave: 'APRESENTACAO',   peso:  5 },
    ],
  },
  {
    nome: 'Produção e Indústria',
    descricao: 'Laticínio e fábrica de ração — foco em técnica e qualidade.',
    finalidade: 'PRODUCAO',
    grupos: [
      { chave: 'ASSIDUIDADE',    peso: 10 },
      { chave: 'RELACIONAMENTO', peso:  9 },
      { chave: 'INICIATIVA',     peso:  9 },
      { chave: 'QUALIDADE',      peso: 12 },
      { chave: 'TECNICO',        peso: 12 },
      { chave: 'RESULTADOS',     peso:  5 },
      { chave: 'APRESENTACAO',   peso:  3 },
    ],
  },
  {
    nome: 'Administrativo',
    descricao: 'Escritórios e apoio — apenas o núcleo comum.',
    finalidade: 'PRODUCAO',
    grupos: [
      { chave: 'ASSIDUIDADE',    peso: 12 },
      { chave: 'RELACIONAMENTO', peso: 16 },
      { chave: 'INICIATIVA',     peso: 16 },
      { chave: 'QUALIDADE',      peso: 16 },
    ],
  },
  {
    nome: '[DEMO] Modelo de Treinamento',
    descricao: 'Para a gestora de RH explorar o sistema sem risco. Não abre ciclo válido.',
    finalidade: 'DEMONSTRACAO',
    grupos: [
      { chave: 'ASSIDUIDADE',    peso: 25 },
      { chave: 'RELACIONAMENTO', peso: 25 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Conceitos padrão — aplicados ao CICLO na abertura, não ao modelo.
//
// ⭐ CONTÍGUAS POR CONSTRUÇÃO (decisão de 05/09/2026): limite inferior
// inclusivo, superior exclusivo, exceto a última, que inclui o 100. As faixas
// anteriores (0–24, 25–49, …) deixavam nota 24,5 sem conceito nenhum, e
// `notaFinal` é Decimal(6,2). A validação de abertura confere CONTINUIDADE — o
// fim de uma é o início da próxima — em vez de cobertura ponto a ponto.
// Exportado para a tela de criação de ciclo usar como default.
// ---------------------------------------------------------------------------

export const CONCEITOS_PADRAO = [
  { descricao: 'Insuficiente',       limiteInferior:  0, limiteSuperior:  25, cor: '#C0392B', ordem: 1 },
  { descricao: 'Abaixo do esperado', limiteInferior: 25, limiteSuperior:  50, cor: '#E67E22', ordem: 2 },
  { descricao: 'Atende',             limiteInferior: 50, limiteSuperior:  75, cor: '#F1C40F', ordem: 3 },
  { descricao: 'Supera',             limiteInferior: 75, limiteSuperior:  90, cor: '#72BF44', ordem: 4 },
  { descricao: 'Excelente',          limiteInferior: 90, limiteSuperior: 100, cor: '#006838', ordem: 5 },
];

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function semearCatalogo() {
  for (const c of CRITERIOS) {
    const criterio = await prisma.criterio.upsert({
      where: { codigo: c.codigo },
      // O `update` NÃO toca em `ativo`: o RH pode ter ligado ou desligado o
      // critério, e reexecutar o seed não pode desfazer decisão dele.
      update: {
        nome: c.nome,
        descricao: c.descricao,
        origem: 'CALCULADO',
        tipoValor: c.tipoValor,
        codigoCalculo: c.codigoCalculo,
        unidade: c.unidade,
      },
      create: {
        codigo: c.codigo,
        nome: c.nome,
        descricao: c.descricao,
        origem: 'CALCULADO',
        tipoValor: c.tipoValor,
        codigoCalculo: c.codigoCalculo,
        unidade: c.unidade,
        ativo: c.ativo,
      },
    });

    // Faixas: só na primeira vez. Reescrever apagaria ajuste de pontuação feito
    // pelo RH — que é exatamente o que a revisão da escolaridade pode trazer.
    const jaTem = await prisma.criterioFaixa.count({ where: { criterioId: criterio.id } });
    if (jaTem > 0) {
      console.log(`  critério ${c.codigo}: ${jaTem} faixas já existem, mantidas`);
      continue;
    }

    let ordem = 0;
    for (const f of c.faixas as Record<string, unknown>[]) {
      await prisma.criterioFaixa.create({
        data:
          c.tipoValor === 'DOMINIO'
            ? {
                criterioId: criterio.id,
                tipo: 'DOMINIO',
                valorDominio: f.dominio as string,
                pontuacao: f.pontuacao as number,
                rotulo: f.rotulo as string,
                ordem: ordem++,
              }
            : {
                criterioId: criterio.id,
                tipo: 'NUMERICA',
                limiteInferior: f.inf as number,
                limiteSuperior: f.sup as number | null,
                inclusivoInf: f.incInf as boolean,
                inclusivoSup: f.incSup as boolean,
                pontuacao: f.pontuacao as number,
                rotulo: f.rotulo as string,
                ordem: ordem++,
              },
      });
    }
    console.log(
      `  critério ${c.codigo} (${c.ativo ? 'ativo' : 'INATIVO'}) -> resolver ${c.codigoCalculo}, ${ordem} faixas`,
    );
  }
}

async function semearModelos() {
  for (const def of MODELOS) {
    const existente = await prisma.modelo.findFirst({ where: { nome: def.nome } });
    if (existente) {
      console.log(`  já existe, ignorando: ${def.nome}`);
      continue;
    }

    const modelo = await prisma.modelo.create({
      data: {
        nome: def.nome,
        descricao: def.descricao,
        finalidade: def.finalidade,
        versoes: { create: { versao: 1 } },
      },
      include: { versoes: true },
    });
    const versaoId = modelo.versoes[0].id;

    let pontuacaoMaxima = 0;
    let ordemGrupo = 0;
    let ordemNoArranjo = 0;

    for (const g of def.grupos) {
      const meta = GRUPOS[g.chave];

      // ⭐ A CLASSIFICAÇÃO é global — várias versões apontam para a mesma linha.
      // Por isso `upsert` e não `create`: o segundo modelo que usa
      // "Relacionamento e Conduta" reaproveita, não duplica. Era exatamente a
      // duplicação que a migration do acervo desfez (18 linhas para 8 nomes).
      const classificacao = await prisma.classificacao.upsert({
        where: { nome: meta.titulo },
        update: {},
        create: { nome: meta.titulo, ordem: ordemGrupo },
      });

      // ⭐ O PESO FICA NO GRUPO. É o que este seed sempre quis dizer — os
      // números de `def.grupos` são pesos de grupo, e antes do acervo ele os
      // repartia na gravação porque o schema não tinha onde guardá-los.
      await prisma.arranjoGrupo.create({
        data: {
          modeloVersaoId: versaoId,
          classificacaoId: classificacao.id,
          peso: g.peso,
          ordem: ordemGrupo++,
        },
      });

      // A repartição continua existindo — só que agora para CONFERIR a
      // pontuação máxima, não para gravar. É a mesma `distribuirPeso` que o
      // `calculo/peso-derivado.ts` usa na leitura.
      const pesos = distribuirPeso(g.peso, meta.questoes.length);

      for (const [i, codigo] of meta.questoes.entries()) {
        const q = QUESTOES[codigo];

        // A QUESTÃO é do acervo: existe uma vez só, por código do SQP010.
        // `upsert` pelo mesmo motivo da classificação — 11 das 15 são usadas
        // pelos três perfis.
        const pergunta = await prisma.pergunta.upsert({
          where: { codigo: q.codigo },
          update: {},
          create: {
            codigo: q.codigo,
            enunciado: q.titulo,
            classificacaoId: classificacao.id,
            alternativas: {
              create: q.alternativas.map((a, j) => ({
                descricao: a.descricao,
                valor: a.valor,
                ordem: j,
                codigoOrigem: a.codigo,
              })),
            },
          },
        });

        await prisma.arranjoPergunta.create({
          data: { modeloVersaoId: versaoId, perguntaId: pergunta.id, ordem: ordemNoArranjo++ },
        });

        // Denominador da nota do questionário: Σ (maior valor × peso derivado).
        // Calculado, nunca constante — o modelo antigo dividia por 18 fixo e
        // acrescentar uma pergunta fazia a nota passar de 100 sem acusar erro.
        pontuacaoMaxima += Math.max(...q.alternativas.map((a) => a.valor)) * pesos[i];
      }
    }

    await prisma.modeloVersao.update({
      where: { id: versaoId },
      data: { pontuacaoMaxima, publicadoEm: new Date() },
    });

    const somaPesos = def.grupos.reduce((s, g) => s + g.peso, 0);
    console.log(
      `  criado: ${def.nome} — soma dos pesos ${somaPesos}, pontuação máxima ${pontuacaoMaxima.toFixed(4)}`,
    );
  }
}

/**
 * CHECKSUM contra o Protheus. Com TODAS as perguntas pesando 1, a pontuação
 * máxima do questionário completo é a soma dos maiores valores das 15 questões
 * reais = 18,0 — o mesmo /18 do select antigo. É o que prova que as questões e
 * as alternativas continuam sendo as do RD8010, e não pode se perder na conta
 * ponderada nova.
 */
function conferirChecksum(): void {
  const todas = Object.values(GRUPOS).flatMap((g) => g.questoes);
  const total = todas.reduce(
    (soma, codigo) => soma + Math.max(...QUESTOES[codigo].alternativas.map((a) => a.valor)) * 1,
    0,
  );
  const arredondado = Number(total.toFixed(4));
  if (arredondado !== 18) {
    throw new Error(
      `Checksum do instrumento falhou: com pesos 1 a pontuação máxima deveria ser 18,0 e deu ${arredondado}. ` +
        'As questões ou as alternativas divergem do RD8010 — conferir antes de semear.',
    );
  }
  console.log(`  checksum ok: ${todas.length} questões, pontuação máxima 18,0 com pesos iguais`);
}

async function main() {
  conferirChecksum();
  console.log('catálogo de critérios:');
  await semearCatalogo();
  console.log('modelos:');
  await semearModelos();
}

main()
  .then(() => console.log('seed concluído'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
