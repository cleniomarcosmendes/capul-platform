import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  /** Classe do wrapper (ex.: "flex-1" para encaixar num flex ao lado de um botão). */
  wrapperClassName?: string;
};

/** Input de senha com botão de mostrar/ocultar (olhinho). Padrão da plataforma. */
const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className = '', wrapperClassName = '', disabled, ...rest },
  ref,
) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        disabled={disabled}
        className={`${className} pr-10`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        disabled={disabled}
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-slate-400
          hover:text-slate-600 disabled:opacity-50 focus:outline-none transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
});

export default PasswordInput;
