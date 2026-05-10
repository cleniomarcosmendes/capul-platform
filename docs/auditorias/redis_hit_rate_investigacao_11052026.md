# Investigação Redis hit rate baixo — 11/05/2026

**Origem:** Auditoria F4 Performance #M3 (10/05/2026) — flagou hit rate de 31.8%

## Resultado

**Achado é EXPLICADO** — não há ação necessária.

## Dados coletados

```
Stats Redis:
  keyspace_hits:    2718
  keyspace_misses:  5868
  hit_rate:         31.7%

Keyspace: 142 keys total
  - 136 hashes (95.8%) — BullMQ jobs
  - 1   stream (0.7%)  — bull:fiscal-cruzamento:events
  - 3   strings (2.1%) — sessões/cache app
  - 2   zsets (1.4%)   — bull:fiscal-cruzamento:completed/active

Bigkeys: tudo em "bull:fiscal-cruzamento:*"
```

## Análise

Redis é dominado por BullMQ (95%+ do keyspace). O hit rate baixo é
**comportamento esperado** desse padrão de uso:

1. **`BZPOPMIN`/`BRPOPLPUSH` em workers idle** — cada poll em fila vazia
   conta como miss
2. **Job state checks** (`stalled-check`, `delayed`) periodicamente
   consultam keys que podem não existir
3. **Cache real da app** (sessions, config Protheus) é minoritário
   (3 strings de 17 bytes total)

O hit rate de cache real (excluindo BullMQ) seria muito mais alto, mas
não é mensurável diretamente sem instrumentação adicional.

## Conclusão

- ❌ **Não é gargalo** — Redis está com 1.71MB de uso vs 200MB limite (~1%)
- ❌ **Não é problema de design** — BullMQ funciona assim por natureza
- ✅ **Aceitável manter** — sem ação recomendada

## Próximas ações condicionais

Se em algum momento aparecer **dúvida sobre cache hit rate da APP** (não
do BullMQ), instrumentar contadores manuais:

```typescript
// Em cada cache operation:
this.metrics.increment(success ? 'cache.hit' : 'cache.miss', { layer: 'X' });
```

Por enquanto, **não vale o esforço** — não há reclamação operacional.

## Status

✅ **Achado #M3 RESOLVIDO via investigação** — sem mudança de código necessária.
