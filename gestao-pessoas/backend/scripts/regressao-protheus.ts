/**
 * REGRESSÃO CONTRA O PROTHEUS — compara o cálculo novo com o do select antigo,
 * sobre as MESMAS pessoas do último ciclo real (RD8010 modelo 000006, encerrado
 * em 31/10/2025).
 *
 * Não se espera que os números batam: corrigimos a divisão fixa por 18, o tempo
 * na função, a renormalização e o `current_date`. O que se espera é PODER
 * EXPLICAR cada divergência por uma correção conhecida. Diferença que não caia
 * em nenhuma das quatro é defeito nosso.
 *
 * ⚠️ O lado "antigo" é uma RECONSTRUÇÃO do comportamento documentado — o texto
 * do select original não está no repositório. As faixas usadas aqui são as
 * mesmas do seed, que vieram dele.
 *
 * ── Como gerar o CSV (somente leitura, capulmig ou capulhlg) ────────────────
 * As colunas são: matricula, qtd_questoes, soma_resobt, admissao, escolaridade,
 * func_correta (última TROCA de R7_FUNCAO), func_ingenua (última linha do SR7),
 * cursos (RA4010 concluídos na janela de 12 meses). A consulta completa está em
 * docs/REGRESSAO_PROTHEUS_GESTAO_PESSOAS.md.
 *
 * Uso: npx ts-node --project tsconfig.seed.json scripts/regressao-protheus.ts <csv>
 */
import * as fs from 'node:fs';
import { calcularNotaAvaliacao } from '../src/calculo/nota-avaliacao';
import { localizarFaixa, type Faixa } from '../src/calculo/faixa';
import { anosEntre } from '../src/calculo/resolvers/resolver.types';

const DATA_BASE = '20251031';   // fim do ciclo 000006
const HOJE = '20260905';        // o que o current_date do select antigo veria hoje

const linhas = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n')
  .filter((l) => l.trim() && !l.startsWith('"MATRICULA"'))
  .map((l) => l.split(',').map((c) => c.replace(/^"|"$/g, '')))
  .map(([matricula, qtd, soma, admissao, escolaridade, funcCorreta, funcIngenua, cursos]) => ({
    matricula, qtd: Number(qtd), soma: Number(soma), admissao,
    escolaridade: escolaridade.trim(), funcCorreta, funcIngenua, cursos: Number(cursos),
  }));

// --- faixas, exatamente como estão no seed (que as trouxe do select antigo)
const num = (inf: number|null, sup: number|null, p: number, o: number, incInf = false): Faixa => ({
  id: `f${o}`, tipo: 'NUMERICA', limiteInferior: inf, limiteSuperior: sup,
  inclusivoInf: incInf, inclusivoSup: true, valorDominio: null, pontuacao: p, rotulo: null, ordem: o,
});
const TEMPO_EMPRESA = [num(0,0,0,0,true), num(0,3,25,1), num(3,5,50,2), num(5,7,75,3), num(7,null,100,4)];
const TEMPO_FUNCAO  = [num(0,0,0,0,true), num(0,2,25,1), num(2,4,50,2), num(4,6,75,3), num(6,null,100,4)];
const TREINAMENTO   = [num(0,0,0,0,true), num(0,2,25,1), num(2,5,50,2), num(5,8,75,3), num(8,null,100,4)];
const ESC: Record<string, number> = {
  '10':25,'20':25,'25':25,'30':25,'35':25,'40':25,'45':25,'50':50,'55':75,'65':100,'75':100,'85':100,'95':100,
};
const pontos = (faixas: Faixa[], v: number) =>
  localizarFaixa(faixas, { valorNumerico: v, valorTexto: null, semDado: false })?.pontuacao ?? null;

let ident = 0;
const difNota: number[] = [];
const difFuncao: {mat:string; antigo:number|null; novo:number|null; anosAntigo:number; anosNovo:number}[] = [];
let semEscolaridade = 0, semFuncaoRegistro = 0;
const driftEmpresa: number[] = [];

for (const p of linhas) {
  // ── 1. NOTA DO QUESTIONÁRIO: /18 fixo × denominador calculado
  const notaAntiga = Number(((p.soma / 18) * 100).toFixed(2));
  const itens = Array.from({ length: p.qtd }, (_, i) => ({
    perguntaId: `q${i}`, peso: 1, maiorValor: 1.2, valorRespondido: 0,
  }));
  // distribui a soma real entre as questões (o total é o que importa na fórmula)
  itens[0].valorRespondido = p.soma;
  const notaNova = calcularNotaAvaliacao(itens).nota;
  if (Math.abs(notaAntiga - notaNova) < 0.005) ident++; else difNota.push(notaNova - notaAntiga);

  // ── 2. TEMPO DE FUNÇÃO: última linha do SR7 × última TROCA de função
  const anosIngenuo = anosEntre(p.funcIngenua, DATA_BASE);
  const anosCorreto = anosEntre(p.funcCorreta, DATA_BASE);
  const pAntigo = anosIngenuo < 0 ? null : pontos(TEMPO_FUNCAO, anosIngenuo);
  const pNovo = pontos(TEMPO_FUNCAO, anosCorreto);
  if (pAntigo !== pNovo) difFuncao.push({ mat: p.matricula, antigo: pAntigo, novo: pNovo, anosAntigo: anosIngenuo, anosNovo: anosCorreto });
  if (p.funcCorreta === p.admissao) semFuncaoRegistro++;

  // ── 3. RENORMALIZAÇÃO: quem ficaria sem dado
  if (!p.escolaridade) semEscolaridade++;

  // ── 4. current_date × dataBase (só o tempo de empresa, para isolar)
  driftEmpresa.push(anosEntre(p.admissao, HOJE) - anosEntre(p.admissao, DATA_BASE));
}

const media = (v: number[]) => v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0;

console.log(`AMOSTRA: ${linhas.length} pessoas do ciclo 000006 (encerrado ${DATA_BASE})\n`);
console.log(`1. NOTA DO QUESTIONÁRIO (÷18 fixo × denominador calculado)`);
console.log(`   idênticas: ${ident}/${linhas.length} | divergentes: ${difNota.length}`);
if (difNota.length) console.log(`   diferença média: ${media(difNota).toFixed(2)} pontos`);

console.log(`\n2. TEMPO NA FUNÇÃO (última linha do SR7 × última TROCA de função)`);
console.log(`   mudam de faixa: ${difFuncao.length}/${linhas.length}`);
for (const d of difFuncao.slice(0, 6)) {
  console.log(`   ${d.mat}: ${d.anosAntigo.toFixed(1)}a -> ${d.antigo ?? 'sem faixa'} pts  |  ${d.anosNovo.toFixed(1)}a -> ${d.novo} pts`);
}
const subiram = difFuncao.filter(d => (d.novo ?? 0) > (d.antigo ?? 0)).length;
console.log(`   sobem: ${subiram} | descem: ${difFuncao.length - subiram}`);

console.log(`\n3. RENORMALIZAÇÃO`);
console.log(`   sem escolaridade (viravam média ZERO no modelo antigo): ${semEscolaridade}`);
console.log(`   sem registro de troca de função (usam a admissão, decisão C9): ${semFuncaoRegistro}`);

console.log(`\n4. current_date × ciclo.dataBase`);
console.log(`   deriva média no tempo de empresa se o relatório rodasse hoje: +${media(driftEmpresa).toFixed(2)} ano`);
