import { PortalAuthService } from './portal-auth.service';
import type { IntegracaoService } from '../integracao/integracao.service';

// Cobre a RESOLUÇÃO do endpoint (sem rede). O caminho HTTP (válida/inválida) é
// validado em E2E com o Protheus — aqui garantimos os fallbacks INDISPONIVEL.
describe('PortalAuthService', () => {
  function make(getEndpointsAtivos: jest.Mock) {
    const integracao = { getEndpointsAtivos } as unknown as IntegracaoService;
    return new PortalAuthService(integracao);
  }

  it('INDISPONIVEL quando a integração PROTHEUS não está cadastrada', async () => {
    const svc = make(jest.fn().mockRejectedValue(new Error('not found')));
    await expect(svc.validar('001047', 'x')).resolves.toBe('INDISPONIVEL');
  });

  it('INDISPONIVEL quando não há endpoint loginPortal ativo', async () => {
    const svc = make(jest.fn().mockResolvedValue({
      tipoAuth: 'BASIC', authConfig: 'abc',
      endpoints: [{ operacao: 'getLimite', url: 'http://x', metodo: 'GET', timeoutMs: 3000, ambiente: 'HOMOLOGACAO' }],
    }));
    await expect(svc.validar('001047', 'x')).resolves.toBe('INDISPONIVEL');
  });
});
