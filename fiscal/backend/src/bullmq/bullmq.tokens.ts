/**
 * Tokens DI das filas BullMQ — extraídos do bullmq.module.ts em 11/05/2026
 * para evitar circular import com QueueMonitorService
 * (auditoria #A3 — Robustez).
 *
 * O bullmq.module.ts importa QueueMonitorService como provider, e o service
 * precisa injetar QUEUE_CRUZAMENTO/SCHEDULER/ALERTAS. Importar do próprio
 * module cria ciclo. Tokens isolados aqui resolvem.
 */
export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');
export const QUEUE_CRUZAMENTO = Symbol('QUEUE_CRUZAMENTO');
export const QUEUE_SCHEDULER = Symbol('QUEUE_SCHEDULER');
export const QUEUE_ALERTAS = Symbol('QUEUE_ALERTAS');
