import { authApi, coreApi } from './api';
import type {
  LoginResponse,
  SwitchFilialResponse,
  UsuarioLogado,
} from '../types';

export interface PreferenciasEmail {
  chamados?: boolean;
  pendencias?: boolean;
  atividades?: boolean;
}

export interface PreferenciasUsuario {
  email?: PreferenciasEmail;
  inactivityTimeoutMin?: number | 'never';
  [k: string]: unknown;
}

export const authService = {
  async login(login: string, senha: string): Promise<LoginResponse> {
    const { data } = await authApi.post<LoginResponse>('/login', {
      login,
      senha,
    });
    if (data.mfaRequired) {
      // Retornar sem salvar tokens — precisa do segundo fator
      return data;
    }
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return data;
  },

  async mfaLogin(mfaToken: string, code: string): Promise<LoginResponse> {
    const { data } = await authApi.post<LoginResponse>('/mfa/login', { mfaToken, code });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return data;
  },

  async mfaSetup(): Promise<{ qrCodeUrl: string; secret: string }> {
    const { data } = await authApi.post('/mfa/setup');
    return data;
  },

  async mfaVerify(code: string): Promise<{ success: boolean }> {
    const { data } = await authApi.post('/mfa/verify', { code });
    return data;
  },

  async mfaDisable(code: string): Promise<{ success: boolean }> {
    const { data } = await authApi.post('/mfa/disable', { code });
    return data;
  },

  async logout(): Promise<void> {
    try {
      await authApi.post('/logout');
    } catch {
      // ignora erro de logout
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('usuario');
  },

  async me(): Promise<UsuarioLogado> {
    const { data } = await authApi.get<UsuarioLogado>('/me');
    localStorage.setItem('usuario', JSON.stringify(data));
    return data;
  },

  async switchFilial(filialId: string): Promise<SwitchFilialResponse> {
    const { data } = await authApi.post<SwitchFilialResponse>(
      '/switch-filial',
      { filialId },
    );
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    // Atualizar usuario no localStorage
    const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
    usuario.filialAtual = data.filialAtual;
    localStorage.setItem('usuario', JSON.stringify(usuario));
    return data;
  },

  async changePassword(senhaAtual: string, novaSenha: string): Promise<void> {
    await authApi.patch('/change-password', { senhaAtual, novaSenha });
  },

  async getPreferencias(): Promise<PreferenciasUsuario> {
    const { data } = await coreApi.get<PreferenciasUsuario>('/usuarios/me/preferencias');
    return data;
  },

  async updatePreferencias(patch: Partial<PreferenciasUsuario>): Promise<PreferenciasUsuario> {
    const { data } = await coreApi.patch<PreferenciasUsuario>('/usuarios/me/preferencias', patch);
    return data;
  },

  getUsuarioLocal(): UsuarioLogado | null {
    const str = localStorage.getItem('usuario');
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },
};
