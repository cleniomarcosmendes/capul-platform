import { ForbiddenException } from '@nestjs/common';
import { assertMesmaFilial, resolverFilialLeitura, podeVerOutrasFiliais, assertRegistroDaFilial } from './filial-scope';

/* eslint-disable @typescript-eslint/no-explicit-any */
const user = (filialId?: string, role?: string) =>
  ({ sub: 'u1', filialId, modulos: role ? [{ codigo: 'LOGISTICA', role }] : [] }) as any;

describe('filial-scope', () => {
  describe('assertMesmaFilial', () => {
    it('passa quando a filial bate', () => expect(() => assertMesmaFilial(user('f1'), 'f1')).not.toThrow());
    it('passa quando filialId não foi informado', () => expect(() => assertMesmaFilial(user('f1'), undefined)).not.toThrow());
    it('lança 403 quando diverge', () => expect(() => assertMesmaFilial(user('f1'), 'f2')).toThrow(ForbiddenException));
  });

  describe('assertRegistroDaFilial', () => {
    it('passa quando o registro é da filial do user', () => expect(() => assertRegistroDaFilial(user('f1'), 'f1')).not.toThrow());
    it('lança 403 quando o registro é de outra filial', () => expect(() => assertRegistroDaFilial(user('f1'), 'f2')).toThrow(ForbiddenException));
  });

  describe('podeVerOutrasFiliais', () => {
    it('ADMIN e GESTOR_ENTREGA podem', () => {
      expect(podeVerOutrasFiliais(user('f1', 'ADMIN'))).toBe(true);
      expect(podeVerOutrasFiliais(user('f1', 'GESTOR_ENTREGA'))).toBe(true);
    });
    it('OPERADOR_ENTREGA não pode', () => expect(podeVerOutrasFiliais(user('f1', 'OPERADOR_ENTREGA'))).toBe(false));
  });

  describe('resolverFilialLeitura', () => {
    it('ADMIN/GESTOR respeitam o filtro pedido', () => expect(resolverFilialLeitura(user('f1', 'ADMIN'), 'f2')).toBe('f2'));
    it('ADMIN sem filtro = todas (undefined)', () => expect(resolverFilialLeitura(user('f1', 'ADMIN'), undefined)).toBeUndefined());
    it('OPERADOR fica restrito à própria filial mesmo pedindo outra', () => expect(resolverFilialLeitura(user('f1', 'OPERADOR_ENTREGA'), 'f2')).toBe('f1'));
  });
});
