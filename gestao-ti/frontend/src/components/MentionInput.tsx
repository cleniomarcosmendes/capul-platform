import { useState, useRef, useEffect } from 'react';

interface MentionUser {
  id: string;
  nome: string;
  username: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  usuarios: MentionUser[];
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MentionInput({ value, onChange, usuarios, placeholder, rows = 2, className }: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtrados = usuarios.filter((u) =>
    !filtro || u.nome.toLowerCase().includes(filtro.toLowerCase()) || u.username.toLowerCase().includes(filtro.toLowerCase())
  );

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value;
    const pos = e.target.selectionStart || 0;
    onChange(newValue);
    setCursorPos(pos);

    // Detectar @ no texto
    const textBefore = newValue.substring(0, pos);
    const atIndex = textBefore.lastIndexOf('@');
    if (atIndex >= 0 && (atIndex === 0 || textBefore[atIndex - 1] === ' ' || textBefore[atIndex - 1] === '\n')) {
      const query = textBefore.substring(atIndex + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setFiltro(query);
        setShowDropdown(true);
        // Posicionar dropdown
        if (textareaRef.current) {
          const rect = textareaRef.current.getBoundingClientRect();
          setDropdownPos({ top: rect.height + 4, left: 0 });
        }
        return;
      }
    }
    setShowDropdown(false);
  }

  function handleSelect(user: MentionUser) {
    const textBefore = value.substring(0, cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const textAfter = value.substring(cursorPos);
    const newValue = textBefore.substring(0, atIndex) + `@${user.username} ` + textAfter;
    onChange(newValue);
    setShowDropdown(false);
    // Foco de volta no textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = atIndex + user.username.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showDropdown && e.key === 'Escape') {
      setShowDropdown(false);
      e.preventDefault();
    }
  }

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside() { setShowDropdown(false); }
    if (showDropdown) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className || 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm'}
      />
      {showDropdown && filtrados.length > 0 && (
        <div
          className="absolute z-50 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto w-64"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {filtrados.slice(0, 8).map((u) => (
            <button
              key={u.id}
              onClick={(e) => { e.stopPropagation(); handleSelect(u); }}
              className="w-full text-left px-3 py-2 hover:bg-capul-50 text-sm flex items-center gap-2 border-b border-slate-100 last:border-0"
            >
              <span className="font-medium text-slate-700">{u.nome}</span>
              <span className="text-slate-400 text-xs">@{u.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
