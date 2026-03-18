import { useState, useRef, useEffect } from 'react';
import { Search, Camera } from 'lucide-react';
import { CameraScanner } from './CameraScanner';

interface ScannerInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'default' | 'large';
}

export function ScannerInput({ onScan, placeholder, autoFocus = true, size = 'default' }: ScannerInputProps) {
  const [value, setValue] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef(0);

  useEffect(() => {
    if (autoFocus && !cameraOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, cameraOpen]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) {
      // Debounce para scanners fisicos que enviam multiplos Enter
      const now = Date.now();
      if (now - lastScanRef.current < 200) return;
      lastScanRef.current = now;

      onScan(value.trim());
      setValue('');
    }
  }

  function handleCameraScan(code: string) {
    onScan(code);
  }

  const isLarge = size === 'large';

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${isLarge ? 'w-5 h-5' : 'w-4 h-4'}`} />
        <input
          ref={inputRef}
          type="text"
          inputMode="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Escanear codigo de barras...'}
          className={`w-full border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-capul-500 ${
            isLarge ? 'pl-11 pr-12 py-4 text-lg' : 'pl-9 pr-10 py-2 text-sm'
          }`}
        />
        <button
          type="button"
          onClick={() => setCameraOpen(!cameraOpen)}
          title={cameraOpen ? 'Fechar camera' : 'Abrir camera'}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
            cameraOpen
              ? 'bg-capul-600 text-white'
              : 'text-slate-400 hover:text-capul-600 hover:bg-capul-50'
          }`}
        >
          <Camera className={isLarge ? 'w-5 h-5' : 'w-4 h-4'} />
        </button>
      </div>

      {cameraOpen && (
        <CameraScanner
          onScan={handleCameraScan}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
