-- Recibo (foto/PDF do cupom) da despesa de frota. O binário vive no object store
-- (MinIO, reusa o CofreStorageService); aqui ficam só a chave, o hash e o mime.
ALTER TABLE "logistica"."despesa_veiculo" ADD COLUMN "comprovante_object_key" TEXT;
ALTER TABLE "logistica"."despesa_veiculo" ADD COLUMN "comprovante_hash" TEXT;
ALTER TABLE "logistica"."despesa_veiculo" ADD COLUMN "comprovante_mime" TEXT;
