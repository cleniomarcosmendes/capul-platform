import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext';

function TestConsumer() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Operacao OK')}>Sucesso</button>
      <button onClick={() => toast.error('Erro detectado')}>Erro</button>
      <button onClick={() => toast.warning('Aviso importante')}>Aviso</button>
    </div>
  );
}

describe('ToastContext', () => {
  it('shows a success toast when triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Sucesso'));
    expect(screen.getByText('Operacao OK')).toBeInTheDocument();
  });

  it('shows an error toast when triggered', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await user.click(screen.getByText('Erro'));
    expect(screen.getByText('Erro detectado')).toBeInTheDocument();
  });

  it('auto-removes toast after timeout', async () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <TestConsumer />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByText('Aviso').click();
    });
    expect(screen.getByText('Aviso importante')).toBeInTheDocument();

    // Fast-forward past 4s display + 300ms exit animation
    await act(async () => {
      vi.advanceTimersByTime(4500);
    });

    expect(screen.queryByText('Aviso importante')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
