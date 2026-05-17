# PoC — Base Pública CNPJ (RFB) · F0/PoC executada 16/05/2026

Prova de conceito que **valida o acesso** e **mede o footprint real** antes de
comprometer a F1. Acompanha `docs/PLANO_MODULO_CNPJ_RFB_v1.md` (addendum F0).

## Achados (decisivos)

### 1. Mecanismo de acesso MUDOU — premissa do doc v3 está furada
A RFB **não** serve mais diretório previsível com `HEAD` em
`.../dados_abertos_cnpj/AAAA-MM/` (404 em todos os meses 2025-04→2026-05).
Hoje é um **Nextcloud público**:

- Root `https://arquivos.receitafederal.gov.br/` → 302 p/ `index.php/s/<TOKEN>`
- Acesso real = **WebDAV público**:
  `https://arquivos.receitafederal.gov.br/public.php/dav/files/<TOKEN>/Dados/Cadastros/CNPJ/<AAAA-MM>/`
- Auth = `curl -u "<TOKEN>:"` (share anônimo). Token observado:
  `gn672Ad4CF8N6TK` — **pode rotacionar → resolver dinâmico** seguindo o
  redirect do root; **valor no Configurador, nunca hardcode**.
- Detecção de versão = `PROPFIND Depth:1` em `.../CNPJ/`, pegar a maior
  pasta `AAAA-MM/` (NÃO `HEAD` em URL chutada). Download = GET WebDAV
  (suporta Content-Length/Range). `2026-05/` publicado.

### 2. Tamanhos REAIS (HEAD autoritativo, mês 2026-05) << doc v3
| Conjunto | Real (zip) |
|---|---|
| Estabelecimentos (10; part. 0 ≈ 1989 MB, 1-9 ≈ 325 MB) | ~4,85 GB |
| Empresas (10) | ~1,25 GB |
| Simples (1) | ~0,28 GB |
| Domínios | ~0,05 GB |
| **Essenciais (sem Sócios)** | **≈ 6,4 GB** |
| Sócios (excluído fase 1) | ~0,68 GB |

Doc v3 dizia ~20 GB zip / ~85 GB CSV — **superdimensionado**.

### 3. Footprint Postgres MEDIDO (dado real, com índices do plano)
Carga streaming `zip → python (latin-1, csv ';') → \copy` no Postgres DEV:

| Tabela (1 partição) | Linhas | Heap | **B/linha c/ índices** |
|---|---|---|---|
| Estabelecimentos | 4.753.435 | 791 MB (174 B/l) | **250,1 B/l** (5 índices, incl. GIN pg_trgm nome_fantasia) |
| Empresas | 4.494.860 | 372 MB (86,8 B/l) | **170,0 B/l** (btree cnpj_basico + GIN pg_trgm razao) |
| Simples | — | — | ~100 B/l (estimado — tabela mais estreita, sem trgm) |

Performance: 4,7M linhas em **21 s**; 4,5M em **7 s** — streaming escala,
baixa memória. **0 linhas malformadas** em 2 partições (encoding latin-1 +
`;` OK). `pg_trgm` disponível no Postgres da plataforma.

### 4. Extrapolação → footprint e provisionamento PROD
Contagens totais (única estimativa — figuras RFB públicas estáveis 2026):
~66M estabelecimentos · ~62M empresas (cnpj_basico) · ~45M simples.

| Item | Estimativa |
|---|---|
| Estabelecimentos | 250 B/l × 66M ≈ **16,5 GB** |
| Empresas | 170 B/l × 62M ≈ **10,5 GB** |
| Simples | ~100 B/l × 45M ≈ **~4,5 GB** |
| Domínios | desprezível |
| **Steady-state (schema `rfb`, tabelas+índices)** | **≈ ~32 GB** |
| + staging/swap **por tabela** (pico = maior tabela duplicada) | + ~17 GB |
| + scratch download zips (~0 se stream rede→parse) | ~6,5 GB |
| + temp build índice GIN trgm (66M) | + ~5-10 GB |
| **→ Provisionar livre no volume Postgres PROD** | **≥ ~70 GB** (conservador) |

bytes/linha é **exato** (medido em dado real 2026-05); só as contagens
totais são estimativa (figuras públicas). Refinável carregando part. 0.

## Como reproduzir
```bash
UA="Mozilla/5.0"
TOKEN=$(curl -sI "https://arquivos.receitafederal.gov.br/" | grep -i ^location | grep -oE 's/[A-Za-z0-9]+' | cut -d/ -f2)
B="https://arquivos.receitafederal.gov.br/public.php/dav/files/$TOKEN/Dados/Cadastros/CNPJ/2026-05"
curl -A "$UA" -u "$TOKEN:" -o Estab1.zip "$B/Estabelecimentos1.zip"
python3 load_estab.py Estab1.zip | psql -d capul_platform -c "\copy rfb.estabelecimentos FROM STDIN WITH (FORMAT csv)"
```
`load_estab.py` / `load_emp.py`: stream do zip (sem `unzip`), latin-1,
csv `;`, projeta só colunas essenciais → STDIN do `\copy`.

> Schema `rfb` foi DROPADO do DEV após medição (PoC ≠ implementação).
> F1 cria via migration formal (init job `fiscal-migrate`).
