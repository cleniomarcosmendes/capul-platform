import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ViagemService } from './viagem.service';
import { createPrismaMock } from '../common/testing/prisma-mock';

/* eslint-disable @typescript-eslint/no-explicit-any */
const coreMock = () => ({ validarUsuario: jest.fn().mockResolvedValue(undefined), assertEntregador: jest.fn().mockResolvedValue(undefined), nomesUsuarios: jest.fn().mockResolvedValue(new Map()) }) as any;

describe('ViagemService', () => {
  let prisma: any;
  let svc: ViagemService;
  let core: any;

  beforeEach(() => {
    prisma = createPrismaMock();
    core = coreMock();
    svc = new ViagemService(prisma, core);
  });

  describe('despachar', () => {
    it('404 se a viagem não existe', async () => {
      prisma.viagem.findUnique.mockResolvedValue(null);
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(NotFoundException);
    });
    it('403 se a viagem é de outra filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(ForbiddenException);
    });
    it('400 se não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se a viagem não tem paradas', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('400 se rascunho ainda não tem veículo/motorista (12/06)', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: null, motoristaId: null, situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow('Defina veículo e motorista');
    });
    it('400 se o motorista perdeu o papel ENTREGADOR (brecha E11a)', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', motoristaId: 'm1', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      core.assertEntregador.mockRejectedValueOnce(new BadRequestException('Motorista inválido: precisa ter o papel Entregador ativo nesta filial.'));
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow('papel Entregador');
    });
    it('400 se o veículo não está DISPONIVEL', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', motoristaId: 'm1', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }] });
      prisma.veiculo.findUnique.mockResolvedValue({ id: 'vc1', situacao: 'EM_USO' });
      await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(BadRequestException);
    });
    it('happy path: entregas→EM_VIAGEM, veículo→EM_USO, viagem→EM_CURSO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', motoristaId: 'm1', situacao: 'RASCUNHO', paradas: [{ entregaId: 'e1' }, { entregaId: 'e2' }] });
      prisma.veiculo.findUnique.mockResolvedValue({ id: 'vc1', situacao: 'DISPONIVEL' });
      prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'EM_CURSO' });
      await svc.despachar('v1', {} as any, 'f1');
      expect(prisma.entrega.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EM_VIAGEM' } }));
      expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { situacao: 'EM_USO' } }));
      expect(prisma.viagem.update).toHaveBeenCalled();
    });
  });

  /**
   * ⭐ Ponto 1 (09/08) — encerrar a rota é: **KM final + todas as paradas resolvidas**.
   *
   * Antes, encerrar marcava as entregas pendentes como ENTREGUE sozinho. A tela do app
   * até avisava ("sem comprovante"), mas deixava — fabricava entrega sem prova
   * justamente nas paradas que ficaram sem baixa, e anulava o cofre da Fase 1b.
   * Para a rota pendurada existe o encerramento FORÇADO do gestor, que é um juízo
   * dele e fica auditado.
   */
  describe('concluir', () => {
    const viagem = (extra: any = {}) =>
      ({ id: 'v1', filialId: 'f1', veiculoId: 'vc1', situacao: 'EM_CURSO', kmInicial: 100, paradas: [], ...extra }) as any;

    it('400 se não está EM_CURSO', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem({ situacao: 'RASCUNHO' }));
      await expect(svc.concluir('v1', 'f1', 'u9', { kmFinal: 150 } as any)).rejects.toThrow(BadRequestException);
    });

    it('400 sem KM de retorno — é o que fecha o KM rodado', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem());
      await expect(svc.concluir('v1', 'f1', 'u9')).rejects.toThrow(/KM de retorno/i);
    });

    // A rota não deveria ter começado sem KM; se começou, encerrar não inventa um.
    it('400 quando a rota não tem KM de SAÍDA', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem({ kmInicial: null }));
      await expect(svc.concluir('v1', 'f1', 'u9', { kmFinal: 150 } as any)).rejects.toThrow(/KM de saída/i);
    });

    it('400 se o KM de retorno é menor que o de saída (odômetro não retrocede)', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem());
      await expect(svc.concluir('v1', 'f1', 'u9', { kmFinal: 90 } as any)).rejects.toThrow(/menor que o KM de saída/i);
    });

    // ⭐ O coração do item: não entrega sozinho.
    it('400 com parada ainda EM_VIAGEM — e NÃO marca ninguém como ENTREGUE', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem({
        paradas: [{ entregaId: 'e1', entrega: { status: 'EM_VIAGEM' } }, { entregaId: 'e2', entrega: { status: 'ENTREGUE' } }],
      }));
      await expect(svc.concluir('v1', 'f1', 'u9', { kmFinal: 150 } as any)).rejects.toThrow(/1 entrega\(s\) ainda sem baixa/);
      expect(prisma.entrega.updateMany).not.toHaveBeenCalled();
    });

    it('happy: paradas resolvidas + KM → conclui, libera o veículo e atualiza o odômetro', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem({
        paradas: [{ entregaId: 'e1', entrega: { status: 'ENTREGUE' } }, { entregaId: 'e2', entrega: { status: 'NAO_ENTREGUE' } }],
      }));
      prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'CONCLUIDA' });
      await svc.concluir('v1', 'f1', 'u9', { kmFinal: 150 } as any);
      expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({
        data: { situacao: 'DISPONIVEL', kmAtual: 150 },
      }));
      // Nunca mais mexe no status das entregas ao encerrar.
      expect(prisma.entrega.updateMany).not.toHaveBeenCalled();
    });

    it('rota sem paradas (só deslocamento) encerra normalmente', async () => {
      prisma.viagem.findUnique.mockResolvedValue(viagem());
      prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'CONCLUIDA' });
      await expect(svc.concluir('v1', 'f1', 'u9', { kmFinal: 150 } as any)).resolves.toBeDefined();
    });
  });

  describe('removerEntrega', () => {
    it('400 se a viagem não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }] });
      await expect(svc.removerEntrega('v1', 'e1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('404 se a entrega não está na viagem', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }] });
      await expect(svc.removerEntrega('v1', 'eX', 'f1')).rejects.toThrow(NotFoundException);
    });
    it('happy path: apaga a parada e re-sequencia as demais', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', paradas: [{ id: 'p1', entregaId: 'e1', sequencia: 1 }, { id: 'p2', entregaId: 'e2', sequencia: 2 }] });
      await svc.removerEntrega('v1', 'e1', 'f1');
      expect(prisma.parada.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      expect(prisma.parada.update).toHaveBeenCalledWith({ where: { id: 'p2' }, data: { sequencia: 1 } });
    });
  });

  describe('descartar', () => {
    it('400 se não está em RASCUNHO', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', situacao: 'EM_CURSO', paradas: [] });
      await expect(svc.descartar('v1', 'f1')).rejects.toThrow(BadRequestException);
    });
    it('403 se de outra filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', situacao: 'RASCUNHO', paradas: [] });
      await expect(svc.descartar('v1', 'f1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne (escopo de filial — F1)', () => {
    const op = (f: string) => ({ sub: 'u', filialId: f, modulos: [{ codigo: 'LOGISTICA', role: 'OPERADOR_ENTREGA' }] }) as any;
    it('OPERADOR NÃO vê viagem de outra filial (403)', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', paradas: [] });
      await expect(svc.findOne('v1', op('f1'))).rejects.toThrow(ForbiddenException);
    });
    it('OPERADOR vê viagem da própria filial', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f1', paradas: [] });
      await expect(svc.findOne('v1', op('f1'))).resolves.toBeTruthy();
    });
    it('sem user (chamada interna) não aplica escopo', async () => {
      prisma.viagem.findUnique.mockResolvedValue({ id: 'v1', filialId: 'f2', paradas: [] });
      await expect(svc.findOne('v1')).resolves.toBeTruthy();
    });
  });
});

/**
 * ⭐ Ponto 1 (09/08) — uma rota por vez, por VEÍCULO e por MOTORISTA.
 *
 * Não havia trava nenhuma: o mesmo carro (e a mesma pessoa) podia estar em duas rotas
 * ao mesmo tempo, e o KM de uma sobrescrevia o da outra. A mensagem diz QUAL rota está
 * aberta — "veículo indisponível" mandaria o operador procurar sozinho.
 */
describe('ViagemService.despachar — uma rota por vez', () => {
  let prisma: any;
  let svc: ViagemService;

  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ViagemService(prisma, coreMock());
    prisma.viagem.findUnique.mockResolvedValue({
      id: 'v1', filialId: 'f1', situacao: 'RASCUNHO', veiculoId: 'vc1', motoristaId: 'm1',
      paradas: [{ entregaId: 'e1' }],
    });
    prisma.veiculo.findUnique.mockResolvedValue({ id: 'vc1', situacao: 'DISPONIVEL', kmAtual: 100 });
    prisma.viagem.update.mockResolvedValue({ id: 'v1', situacao: 'EM_CURSO' });
  });

  it('veículo já em rota → recusa dizendo QUAL rota está aberta', async () => {
    prisma.viagem.findMany.mockResolvedValue([{ numero: 42, veiculoId: 'vc1', motoristaId: 'outro' }]);
    await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(/veículo já está na rota #42/i);
  });

  it('motorista já em rota (noutro veículo) → recusa', async () => {
    prisma.viagem.findMany.mockResolvedValue([{ numero: 43, veiculoId: 'vc9', motoristaId: 'm1' }]);
    await expect(svc.despachar('v1', {} as any, 'f1')).rejects.toThrow(/motorista já está na rota #43/i);
  });

  it('nada aberto → despacha', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await expect(svc.despachar('v1', {} as any, 'f1')).resolves.toBeDefined();
    expect(prisma.veiculo.update).toHaveBeenCalledWith(expect.objectContaining({ data: { situacao: 'EM_USO' } }));
  });

  // O despacho é no DESKTOP, onde ninguém vê o hodômetro. KM é leitura do PAINEL.
  it('não grava KM no despacho — o hodômetro vem do app', async () => {
    prisma.viagem.findMany.mockResolvedValue([]);
    await svc.despachar('v1', { kmInicial: 999 } as any, 'f1');
    const data = prisma.viagem.update.mock.calls[0][0].data;
    expect(data.kmInicial).toBeUndefined();
  });
});

/**
 * `logistica.viagem` guarda TRÊS coisas com significados diferentes: a rota de ENTREGA,
 * a saída de veículo da FROTA e o container mensal do RDV (SUPERVISOR). Quem lê pelo
 * lado da Entrega tem de recortar — e não recortava.
 *
 * Medido em 11/09/2026, pela tela: a filial 18 exibia 10 "Rotas de Entrega" das quais
 * NENHUMA era entrega (9 da frota, 1 do RDV); a filial 01 exibia 27, com 5 entregas.
 * A regra já existia em 14 pontos dos módulos frota/supervisor — faltava exatamente na
 * tela que dá nome ao conceito.
 */
describe('ViagemService — a tela de ENTREGA só enxerga viagem de ENTREGA', () => {
  let prisma: any; let svc: ViagemService;
  beforeEach(() => {
    prisma = createPrismaMock();
    svc = new ViagemService(prisma, coreMock());
    prisma.viagem.findMany.mockResolvedValue([]);
  });

  it('list() filtra tipo=ENTREGA', async () => {
    await svc.list({ filialId: 'f1' });
    expect(prisma.viagem.findMany.mock.calls[0][0].where).toMatchObject({ tipo: 'ENTREGA', filialId: 'f1' });
  });

  it('list() mantém o filtro mesmo sem filial', async () => {
    await svc.list({});
    expect(prisma.viagem.findMany.mock.calls[0][0].where.tipo).toBe('ENTREGA');
  });

  it('listMinhas() (app do entregador) também filtra — não depende de a frota deixar motoristaId nulo', async () => {
    await svc.listMinhas('m1');
    expect(prisma.viagem.findMany.mock.calls[0][0].where).toMatchObject({ tipo: 'ENTREGA', motoristaId: 'm1' });
  });
});

/**
 * INVARIANTE: toda LISTAGEM de viagem neste serviço declara o `tipo` — ou está
 * dispensada com o motivo escrito.
 *
 * Mesma ideia do invariante de `assertRdvAberto` no RDV: revisão caso a caso falha na
 * consulta que ninguém revisou. Aqui o teste lê o FONTE, acha todo
 * `prisma.viagem.findMany(` e exige `tipo:` no bloco — porque `logistica.viagem` guarda
 * ENTREGA, FROTA e SUPERVISOR, e ler os três onde se espera um foi o defeito de 11/09.
 *
 * A lista de dispensados é curta de propósito, e cada item diz POR QUE ler os três tipos
 * é o comportamento certo ali. Consulta nova sem `tipo` e sem dispensa quebra aqui.
 */
describe('ViagemService — INVARIANTE: listagem de viagem declara o tipo', () => {
  // Dispensados, com o porquê. Mexer nesta lista é decisão de negócio, não limpeza.
  const DISPENSADOS: Record<string, string> = {
    abertas: 'trava de "uma rota por vez": o carro preso numa saída de FROTA está ocupado do mesmo jeito — filtrar aqui permitiria despachar rota num veículo já na rua, e o KM de uma sobrescreveria o da outra',
  };

  it('nenhum findMany de viagem fica sem `tipo` (fora os dispensados)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, 'viagem.service.ts'), 'utf8');
    const linhas = src.split('\n');
    const semTipo: string[] = [];
    linhas.forEach((l, i) => {
      if (!/prisma\.viagem\.findMany\(/.test(l)) return;
      // nome da const que recebe o resultado (`const abertas = await ...`)
      const nome = /(?:const|let)\s+([a-zA-Z][a-zA-Z0-9_]*)\s*=/.exec(l)?.[1] ?? `linha_${i + 1}`;
      if (nome in DISPENSADOS) return;
      const bloco = linhas.slice(i, i + 14).join('\n'); // where costuma abrir logo abaixo
      if (!/\btipo:/.test(bloco)) semTipo.push(nome);
    });
    expect(semTipo).toEqual([]);
  });

  it('a lista de dispensados não guarda nome que já sumiu do serviço', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, 'viagem.service.ts'), 'utf8');
    const orfaos = Object.keys(DISPENSADOS).filter((n) => !new RegExp(`(?:const|let)\\s+${n}\\s*=`).test(src));
    expect(orfaos).toEqual([]);
  });

  it('a trava de veículo ocupado continua SEM filtro de tipo', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(path.join(__dirname, 'viagem.service.ts'), 'utf8');
    const i = src.indexOf('const abertas = await this.prisma.viagem.findMany(');
    expect(i).toBeGreaterThan(-1);
    // se alguém "uniformizar" e puser tipo aqui, a trava de KM fura — e este teste avisa
    expect(/\btipo:/.test(src.slice(i, i + 400))).toBe(false);
  });
});
