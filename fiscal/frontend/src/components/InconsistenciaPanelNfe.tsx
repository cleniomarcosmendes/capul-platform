import { useState } from 'react';
import { fiscalApi } from '../services/api';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { PromptDialog } from './PromptDialog';
import { Button } from './Button';
import { extractApiError } from '../utils/errors';
import type { InconsistenciaOverlay } from '../types';

interface Props {
  documentoId: string;
  inconsistencia: InconsistenciaOverlay;
  onChange: (parcial: Partial<InconsistenciaOverlay>) => void;
}

/**
 * Painel exibido na NfeConsultaPage quando a chave consultada teve uma
 * pendência registrada (preNotaFalhou ou pendenteAmarracao em consulta passada).
 *
 * Estados:
 *  - Pendente (resolvidaEm == null): bloco amarelo + botão "marcar resolvida"
 *  - Resolvida (resolvidaEm != null): bloco verde + botão "desmarcar"
 *
 * O backend persiste flags na consulta inicial (xmlNfe MISS → grvXML). Quando
 * operador consulta de novo a mesma chave (xmlNfe HIT em SZR010), os flags
 * antigos persistem — esse painel permite ao operador encerrar o ciclo manual
 * sem precisar criar tela nova de pendências NF-e (ela existe em /nfe/pendencias
 * pra varredura, mas o flow comum é descobrir aqui).
 */
export function InconsistenciaPanelNfe({ documentoId, inconsistencia, onChange }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [carregando, setCarregando] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const tipo = inconsistencia.preNotaFalhou
    ? 'pre-nota'
    : inconsistencia.pendenteAmarracao
      ? 'amarracao'
      : 'pendencia';

  const tituloPendencia =
    tipo === 'pre-nota'
      ? 'Pré-nota não foi gerada'
      : tipo === 'amarracao'
        ? 'Aguarda amarração com pedido de compra'
        : 'Inconsistência registrada';

  const descricaoPendencia =
    tipo === 'pre-nota'
      ? 'XML em SZR010+SZQ010 OK, mas a pré-nota (U_PRENF/U_NFeSaida) falhou. Operador deve concluir manualmente no Protheus.'
      : tipo === 'amarracao'
        ? 'XML em SZR010+SZQ010 e pré-nota OK, mas falta amarrar com o pedido de compra correspondente no Protheus.'
        : 'Inconsistência registrada na última gravação no Protheus.';

  const confirmarMarcarResolvida = async (observacao: string) => {
    setPromptOpen(false);
    setCarregando(true);
    try {
      const { data } = await fiscalApi.post<{
        inconsistenciaResolvidaEm: string;
        inconsistenciaResolvidaPorNome: string;
        inconsistenciaObservacao: string | null;
      }>(`/nfe/${documentoId}/marcar-resolvida`, {
        observacao: observacao.trim() || undefined,
      });
      onChange({
        resolvidaEm: data.inconsistenciaResolvidaEm,
        resolvidaPorNome: data.inconsistenciaResolvidaPorNome,
        observacao: data.inconsistenciaObservacao,
      });
      toast.success('Inconsistência marcada como resolvida');
    } catch (err) {
      toast.error('Falha ao marcar', extractApiError(err) ?? undefined);
    } finally {
      setCarregando(false);
    }
  };

  const desmarcarResolvida = async () => {
    const ok = await confirm({
      title: 'Desmarcar resolução?',
      description: 'Use só se marcou por engano — vai voltar pra pendência.',
      variant: 'warning',
      confirmLabel: 'Desmarcar',
    });
    if (!ok) return;
    setCarregando(true);
    try {
      await fiscalApi.post(`/nfe/${documentoId}/desmarcar-resolvida`);
      onChange({ resolvidaEm: null, resolvidaPorNome: null, observacao: null });
      toast.success('Resolução desmarcada');
    } catch (err) {
      toast.error('Falha ao desmarcar', extractApiError(err) ?? undefined);
    } finally {
      setCarregando(false);
    }
  };

  if (inconsistencia.resolvidaEm) {
    return (
      <div className="rounded-md border border-green-300 bg-green-50 p-4 print:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm text-green-900 flex-1">
            <p className="font-semibold mb-1">✓ Inconsistência resolvida manualmente no Protheus</p>
            <p>
              Por <strong>{inconsistencia.resolvidaPorNome ?? '?'}</strong>
              {' '}em{' '}
              {new Date(inconsistencia.resolvidaEm).toLocaleString('pt-BR')}
            </p>
            {inconsistencia.observacao && (
              <p className="mt-1 italic text-green-700">"{inconsistencia.observacao}"</p>
            )}
          </div>
          <Button variant="secondary" onClick={desmarcarResolvida} loading={carregando}>
            Desmarcar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 p-4 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-yellow-900 flex-1">
          <p className="font-semibold mb-1">⚠ Pendência registrada anteriormente: {tituloPendencia}</p>
          <p>{descricaoPendencia}</p>
          {inconsistencia.mensagemProtheus && (
            <p className="mt-2 text-xs text-yellow-800 italic break-words">
              Mensagem do Protheus: "{inconsistencia.mensagemProtheus}"
            </p>
          )}
          <p className="mt-2 text-xs">
            Quando o setor fiscal concluir manualmente no Protheus, marque aqui
            pra remover esta NF-e da fila de pendências.
          </p>
        </div>
        <Button variant="primary" onClick={() => setPromptOpen(true)} loading={carregando}>
          ✓ Marcar resolvida
        </Button>
      </div>
      <PromptDialog
        open={promptOpen}
        title="Marcar inconsistência como resolvida"
        description={`Confirma que a pendência de ${tituloPendencia.toLowerCase()} foi resolvida manualmente no Protheus?`}
        label="Observação"
        placeholder='Ex: "cadastrado SA2 da BRASPRESS e concluí pré-nota"'
        inputType="textarea"
        rows={3}
        maxLength={500}
        confirmLabel="Marcar resolvida"
        onConfirm={confirmarMarcarResolvida}
        onCancel={() => setPromptOpen(false)}
      />
    </div>
  );
}
