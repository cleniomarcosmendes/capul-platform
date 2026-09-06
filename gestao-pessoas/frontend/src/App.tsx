import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './layouts/Layout';
import MinhasAvaliacoesPage from './pages/MinhasAvaliacoesPage';
import AvaliacaoResponderPage from './pages/AvaliacaoResponderPage';

export default function App() {
  return (
    <BrowserRouter basename="/gestao-pessoas">
      <AuthProvider>
        <Routes>
          {/* A tela de resposta fica FORA do Layout de propósito: ela já tem
              cabeçalho próprio, com o nome de quem está sendo avaliado, o
              progresso e o botão voltar. Empilhar os dois custava ~90px de uma
              tela de celular — espaço que, respondendo em pé no corredor da
              loja, é uma alternativa a menos visível por vez. */}
          <Route path="/avaliacao/:id" element={<AvaliacaoResponderPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<MinhasAvaliacoesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
