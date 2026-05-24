-- Workspace Onda 2 — fix consistência responsável × usuários-chave (25/05).
--
-- Antes deste fix, somente projetos criados por USUARIO_CHAVE/TERCEIRIZADO
-- ganhavam entrada automática em `usuarios_chave_projeto` com função
-- "Responsavel". Projetos criados por staff (admin/gestor/suporte) só
-- gravavam `responsavel_id` no projeto, deixando a aba "Usuários-Chave"
-- vazia mesmo com responsável definido.
--
-- Backfill: para cada projeto com responsável definido, garante uma
-- entrada ativa em `usuarios_chave_projeto` com função "Responsavel".
--
-- ON CONFLICT DO NOTHING: projetos onde o responsável JÁ tem entrada
-- (de qualquer tipo, mesmo `ativo=false` por revogação manual) ficam
-- intactos — admin não fica surpreso com reativação.

INSERT INTO gestao_ti.usuarios_chave_projeto (id, projeto_id, usuario_id, funcao, ativo, created_at)
SELECT gen_random_uuid(), p.id, p.responsavel_id, 'Responsavel', true, NOW()
FROM gestao_ti.projetos p
WHERE p.responsavel_id IS NOT NULL
ON CONFLICT (projeto_id, usuario_id) DO NOTHING;
