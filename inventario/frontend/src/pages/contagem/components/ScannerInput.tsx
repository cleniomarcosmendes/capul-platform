import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface ScannerInputProps {
  onScan: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  size?: 'default' | 'large';
}

export function ScannerInput({ onScan, placeholder, autoFocus = true, size = 'default' }: ScannerInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef(0);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

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

  const isLarge = size === 'large';

  return (
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
          isLarge ? 'pl-11 pr-4 py-4 text-lg' : 'pl-9 pr-3 py-2 text-sm'
        }`}
      />
    </div>
  );
}
