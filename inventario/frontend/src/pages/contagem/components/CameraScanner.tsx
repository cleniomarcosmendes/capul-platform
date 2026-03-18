import { useEffect, useRef, useCallback, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, AlertCircle } from 'lucide-react';

interface CameraScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef(0);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const containerId = 'camera-scanner-container';

  const handleStop = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch {
      // ignore cleanup errors
    }
    scannerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Pequeno delay para garantir que o DOM renderizou o container
    const timer = setTimeout(() => {
      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 100 },
        },
        (decodedText) => {
          const now = Date.now();
          if (now - lastScanRef.current < 1500) return;
          lastScanRef.current = now;
          onScan(decodedText.trim());
        },
        () => {
          // scan failure (no code found) - ignore
        },
      ).catch((err) => {
        console.error('Erro ao iniciar camera:', err);
        if (mountedRef.current) {
          if (String(err).includes('NotAllowedError') || String(err).includes('Permission')) {
            setError('Permissao de camera negada. Verifique as configuracoes do navegador.');
          } else if (String(err).includes('NotFoundError')) {
            setError('Nenhuma camera encontrada no dispositivo.');
          } else {
            setError('Nao foi possivel acessar a camera. Verifique as permissoes.');
          }
        }
      });
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      handleStop();
    };
  }, [onScan, handleStop]);

  return (
    <div className="relative rounded-lg overflow-hidden border-2 border-capul-500 bg-black">
      <div className="flex items-center justify-between bg-capul-600 px-3 py-1.5">
        <span className="text-xs text-white font-medium">
          Aponte para o codigo de barras
        </span>
        <button
          type="button"
          onClick={() => { handleStop().then(onClose); }}
          className="text-white/80 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-2 p-6 text-white bg-black">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-center">{error}</p>
        </div>
      ) : (
        <div
          id={containerId}
          style={{ minHeight: 250, width: '100%' }}
        />
      )}
    </div>
  );
}
