import { PageWrapper } from '../components/PageWrapper';
import { SefazCaAdminSection } from '../components/SefazCaAdminSection';

export function OperacaoTlsPage() {
  return (
    <PageWrapper title="Cadeia TLS ICP-Brasil">
      <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Certificados raiz e intermediários da ICP-Brasil usados no mTLS com os web services SEFAZ.
        Mantém 5 certs oficiais ICP-Brasil + ~144 roots do Mozilla CA bundle. Atualização
        automática quando passa de 30 dias em produção (flag <code>FISCAL_SEFAZ_CA_AUTO_REFRESH</code>).
      </div>
      <SefazCaAdminSection />
    </PageWrapper>
  );
}
