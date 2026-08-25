import * as fs from 'fs';
import * as path from 'path';

/**
 * ⭐⭐ INVARIANTE ESTRUTURAL — quem AGE sobre um chamado é staff NO DEPARTAMENTO DELE.
 *
 * O `@Roles('ADMIN','GESTOR','SUPORTE')` do controller lê a role DENORMALIZADA do JWT:
 * uma só para o módulo inteiro. Num Workspace multi-departamento isso não decide nada
 * — quem é SUPORTE no Fiscal passa nele também num chamado do T.I., onde é usuária
 * final (auditoria de 25/08). A decisão real tem de olhar `chamado.departamentoId`.
 *
 * Esse guard precisa estar em ~20 rotas, e guard que precisa estar em N rotas não se
 * garante por revisão — no RDV o mesmo defeito voltou QUATRO vezes até virar teste de
 * varredura (`supervisor.service.spec.ts`). Este é o equivalente aqui: lê o FONTE do
 * controller, acha as rotas de ação sobre `:id` e exige que o método de serviço passe
 * por um dos guards. Rota nova sem guard quebra aqui, na hora.
 */
describe('Chamado — INVARIANTE: ação sobre chamado passa por guard de departamento', () => {
  // Dispensados, com o motivo. Mexer nesta lista é decisão de negócio, não limpeza.
  const DISPENSADOS: Record<string, string> = {
    avaliar: 'CSAT é do solicitante — o guard próprio checa que é ele',
    listarRegistrosTempo:
      'leitura; a visibilidade da lista já é filtrada por departamento',
    encerrarTempoChamado:
      'encerra o timer do próprio usuário (chave usuarioId + horaFim null)',
    listarApoiadoresSac:
      'catálogo global de apoiadores — não age sobre chamado',
  };
  const GUARDS = [
    'assertTecnicoOuColaborador',
    'ehStaffNoDepto',
    'ehGestorNoDepto',
  ];

  it('nenhuma rota de ação sobre :id fica sem guard de departamento', () => {
    const dir = __dirname;
    const controller = fs.readFileSync(
      path.join(dir, 'chamado.controller.ts'),
      'utf8',
    );

    // O facade (`chamado.service.ts`) só delega, e às vezes RENOMEIA: `agruparEm` ->
    // `agrupamento.agrupar`, `adicionarCopias` -> `core.adicionarCopiasComCheck`. Sem
    // seguir esse pulo, a varredura marcaria como "não resolvido" método que existe —
    // e o ruído é o que faz uma varredura ser ignorada.
    const facade = fs.readFileSync(
      path.join(dir, 'chamado.service.ts'),
      'utf8',
    );
    const delegacao = new Map<string, string>();
    {
      const linhas = facade.split('\n');
      for (let i = 0; i < linhas.length; i++) {
        const m = /^ {2}(?:async )?([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(linhas[i]);
        if (!m) continue;
        const alvo = /return this\.[a-zA-Z]+\.([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(
          linhas.slice(i, i + 8).join('\n'),
        );
        if (alvo) delegacao.set(m[1], alvo[1]);
      }
    }

    // Corpos dos métodos dos sub-serviços.
    const corpos = new Map<string, string>();
    for (const arquivo of fs.readdirSync(path.join(dir, 'services'))) {
      if (!arquivo.endsWith('.service.ts')) continue;
      const src = fs
        .readFileSync(path.join(dir, 'services', arquivo), 'utf8')
        .split('\n');
      const inicios: { linha: number; nome: string }[] = [];
      src.forEach((l, i) => {
        const m =
          /^ {2}(?:async |private async |private )?([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(
            l,
          );
        if (m) inicios.push({ linha: i, nome: m[1] });
      });
      inicios.push({ linha: src.length, nome: '__fim__' });
      for (let i = 0; i < inicios.length - 1; i++) {
        corpos.set(
          inicios[i].nome,
          src.slice(inicios[i].linha, inicios[i + 1].linha).join('\n'),
        );
      }
    }

    // Rotas de AÇÃO: @Post/@Patch/@Delete/@Put sobre ':id' (GET é leitura, filtrada).
    const linhas = controller.split('\n');
    const semGuard: string[] = [];
    const naoResolvidos: string[] = [];
    for (let i = 0; i < linhas.length; i++) {
      if (!/@(Post|Patch|Delete|Put)\(['"][^'"]*:id/.test(linhas[i])) continue;
      const bloco = linhas.slice(i, i + 24).join('\n');
      const chamada = /this\.service\.([a-zA-Z][a-zA-Z0-9_]*)\(/.exec(bloco);
      if (!chamada) continue;
      const metodo = chamada[1];
      if (metodo in DISPENSADOS) continue;
      // A delegação do facade tem PRECEDÊNCIA: `adicionarCopias` existe nos dois lados
      // (o do core é o interno, sem checagem), e o que a rota chama é o `...ComCheck`.
      // Casar pelo nome primeiro daria um falso NEGATIVO — o pior resultado possível
      // numa varredura de segurança.
      const nome = delegacao.get(metodo) ?? metodo;
      const corpo = corpos.get(nome);
      // Método que a varredura não acha é pior que método sem guard: some do radar.
      if (corpo === undefined) {
        naoResolvidos.push(metodo);
        continue;
      }
      // Guard uma chamada abaixo TAMBÉM vale: `agruparMultiplos` confere por item,
      // dentro de `agrupar`. O que não vale é ninguém no caminho conferir.
      const guardaDireto = GUARDS.some((g) => corpo.includes(g));
      const guardaViaChamada = [...corpos.entries()].some(
        ([outro, corpoOutro]) =>
          outro !== nome &&
          new RegExp(`this\\.${outro}\\(`).test(corpo) &&
          GUARDS.some((g) => corpoOutro.includes(g)),
      );
      if (!guardaDireto && !guardaViaChamada) semGuard.push(metodo);
    }

    expect({
      semGuard: [...new Set(semGuard)].sort(),
      naoResolvidos: [...new Set(naoResolvidos)].sort(),
    }).toEqual({ semGuard: [], naoResolvidos: [] });
  });
});
