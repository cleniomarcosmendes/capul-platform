import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ProtheusService } from './protheus.service.js';
import { ValidarColaboradorDto } from './dto/validar-colaborador.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { GestaoTiGuard } from '../common/guards/gestao-ti.guard.js';

@Controller('protheus')
@UseGuards(JwtAuthGuard, GestaoTiGuard)
export class ProtheusController {
  constructor(private readonly service: ProtheusService) {}

  /**
   * Autocomplete de funcionário por NOME (portal RH). Mínimo 3 caracteres —
   * evita lista gigante e martelar o Protheus a cada tecla (o front também
   * faz debounce). Retorna `{ funcionarios: [{matricula,nome,cc}] }`.
   */
  @Get('colaboradores')
  async buscarPorNome(@Query('nome') nome?: string) {
    const q = (nome || '').trim();
    if (q.length < 3) return { funcionarios: [] };
    const funcionarios = await this.service.buscarPorNome(q);
    return { funcionarios };
  }

  @Get('colaborador/:matricula')
  async buscarColaborador(@Param('matricula') matricula: string) {
    const resultado = await this.service.buscarColaborador(matricula);
    if (!resultado) return { encontrado: false, matricula, nome: null };
    return { encontrado: true, ...resultado };
  }

  // SAC — busca o CLIENTE (cooperado) na SA1 por matrícula, para autofill.
  @Get('cliente-sac/:matricula')
  async buscarClienteSac(@Param('matricula') matricula: string) {
    const r = await this.service.buscarClienteSac(matricula);
    if (!r) return { encontrado: false, matricula, nome: null };
    return { encontrado: true, ...r };
  }

  /**
   * Valida matrícula+senha no portal RH (loginPortal). Usado na abertura de
   * Chamado por usuário PADRAO. Quando válida, já devolve o nome do colaborador
   * (busca o `infoFuncionario` na sequência) — assim a tela só revela o nome
   * APÓS a senha conferir (senha-primeiro). `motivo` distingue credencial
   * inválida de Protheus indisponível, pra UX dar a mensagem certa.
   */
  @Post('colaborador/validar')
  async validarColaborador(@Body() dto: ValidarColaboradorDto) {
    const r = await this.service.validarCredencialPortal(dto.matricula, dto.senha);
    if (!r.valida) {
      return { valida: false, motivo: r.motivo, encontrado: false, nome: null };
    }
    // Credencial OK — busca o nome usando a matrícula numérica validada (chapa
    // que o loginPortal confirmou), mesmo formato esperado pelo infoFuncionario.
    const colaborador = await this.service.buscarColaborador(r.matricula);
    return {
      valida: true,
      encontrado: !!colaborador,
      matricula: colaborador?.matricula ?? dto.matricula,
      nome: colaborador?.nome ?? null,
      cc: colaborador?.cc ?? null,
    };
  }
}
