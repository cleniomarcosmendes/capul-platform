import { Smartphone } from 'lucide-react';

/**
 * Selo "esta lista está baixada em um aplicativo".
 *
 * Existe porque avisar só no erro da gravação é tarde: quem chegou até ali já
 * abriu a lista e se posicionou para trabalhar. O aviso tem que estar visível
 * ANTES de começar — na escolha da lista, no topo da contagem e na visão do
 * supervisor.
 *
 * Mostra também de QUEM é o aparelho: o lease é por dispositivo, mas quem olha
 * precisa saber a quem cobrar — "dispositivo …a3f" sozinho não resolve nada.
 */

interface Props {
  ativo?: boolean;
  /** Sufixo do id do aparelho (o backend abrevia de propósito). */
  deviceId?: string | null;
  /** Nome de quem retirou, quando a tela conseguir resolver o usuário. */
  usuarioNome?: string | null;
  desde?: string | null;
  /** `faixa` ocupa a largura toda (topo de tela); `chip` fica em linha (listas). */
  variante?: 'faixa' | 'chip';
}

function horaDe(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function SeloLease({ ativo, deviceId, usuarioNome, desde, variante = 'chip' }: Props) {
  if (!ativo) return null;

  const hora = horaDe(desde);
  const quem = usuarioNome?.trim() || (deviceId ? `dispositivo …${deviceId}` : 'um aparelho');
  const texto = hora ? `Em contagem no aplicativo (${quem}) desde as ${hora}` : `Em contagem no aplicativo (${quem})`;

  if (variante === 'chip') {
    return (
      <span
        title={texto}
        className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800"
      >
        <Smartphone className="h-3 w-3 shrink-0" />
        <span className="truncate">{hora ? `No aplicativo desde ${hora}` : 'No aplicativo'}</span>
      </span>
    );
  }

  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2">
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
      <div className="min-w-0 text-sm text-indigo-900">
        <strong>{texto}.</strong>{' '}
        <span className="text-indigo-800">
          Contar por aqui pode descartar contagens que ainda não foram sincronizadas.
        </span>
      </div>
    </div>
  );
}
