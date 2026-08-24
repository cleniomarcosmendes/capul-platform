/**
 * "O APK que estou testando está falando com o backend certo?"
 *
 * App e backends saem do MESMO repositório: se os dois foram construídos do
 * mesmo commit, os rótulos batem exatamente. Divergência não é necessariamente
 * defeito (o backend costuma subir antes), mas é o que precisa estar À VISTA
 * antes de se gastar uma rodada de teste — foi o que aconteceu com a correção
 * do rodapé de 24/08: sem rótulo, "não funcionou" e "não chegou no aparelho"
 * têm exatamente a mesma cara.
 *
 * ⚠️ Comparação por PREFIXO, não por igualdade: o commit do app pode vir da EAS
 * com 7 caracteres (`EAS_BUILD_GIT_COMMIT_HASH` fatiado) e o do backend do
 * `git rev-parse --short`, que neste repositório devolve 8. Exigir igualdade
 * marcaria como divergente dois artefatos do MESMO commit — alarme falso que
 * ensina a ignorar o alarme.
 */
export type Situacao = 'alinhado' | 'divergente' | 'indeterminado';

/** Tira o sufixo de árvore suja: 'abc1234-sujo' e 'abc1234' são o mesmo commit. */
function normalizar(commit: string | null | undefined): string | null {
  const limpo = commit?.trim().replace(/-sujo$/, '');
  if (!limpo || limpo === 'desconhecido' || limpo === 'desconhecida') return null;
  return limpo;
}

function mesmoCommit(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

export function situacaoDoAlinhamento(
  commitApp: string | null | undefined,
  commitsDosServicos: Array<string | null | undefined>,
): Situacao {
  const app = normalizar(commitApp);
  const servicos = commitsDosServicos.map(normalizar);
  // Sem identidade em qualquer ponta não há o que comparar — e "indeterminado"
  // é a resposta honesta. Chutar 'alinhado' aqui seria dar um atestado falso.
  if (!app || servicos.length === 0 || servicos.some((c) => c === null)) return 'indeterminado';
  return servicos.every((c) => mesmoCommit(app, c as string)) ? 'alinhado' : 'divergente';
}

export function textoDoAlinhamento(situacao: Situacao): string {
  switch (situacao) {
    case 'alinhado':
      return 'App e serviços vieram do mesmo commit.';
    case 'divergente':
      return 'App e serviços vieram de commits DIFERENTES. Confira se o backend já foi atualizado.';
    case 'indeterminado':
      return 'Não dá para comparar: algum lado subiu sem identidade de build.';
  }
}
