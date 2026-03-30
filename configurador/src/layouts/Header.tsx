import { useAuth } from '../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { User, Radio } from 'lucide-react';
import { integracaoService } from '../services/integracao.service';

export function Header({ title, ambienteAtivo }: { title: string; ambienteAtivo?: string | null }) {
  const { usuario, configuradorRole } = useAuth();
  const [ambienteLocal, setAmbienteLocal] = useState<string | null>(null);

  useEffect(() => {
    if (ambienteAtivo !== undefined) return; // se a pagina fornece, nao buscar
    integracaoService.listar()
      .then((data) => {
        const protheus = data.find((i) => i.codigo === 'PROTHEUS');
        if (protheus) setAmbienteLocal(protheus.ambiente);
      })
      .catch(() => {});
  }, [ambienteAtivo]);

  const ambiente = ambienteAtivo !== undefined ? ambienteAtivo : ambienteLocal;

  const isProd = ambiente === 'PRODUCAO';

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-4">
        {ambiente && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${
            isProd
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <Radio className={`w-3 h-3 ${isProd ? 'text-red-500' : 'text-amber-500'}`} />
            API-{isProd ? 'PRD' : 'HLG'}
          </div>
        )}
        <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
          {configuradorRole}
        </span>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User className="w-4 h-4" />
          {usuario?.nome}
        </div>
      </div>
    </header>
  );
}
