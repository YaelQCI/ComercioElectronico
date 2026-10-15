BEGIN;

-- Catálogo base solicitado por el propietario. Conserva IDs y asociaciones existentes.
INSERT INTO "Category" ("id", "name", "slug", "position", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Proteína', 'proteina', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Creatina', 'creatina', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Pre-entreno', 'pre-entreno', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Electrolitos', 'electrolitos', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Vitaminas', 'vitaminas', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Aminoácidos', 'aminoacidos', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Accesorios', 'accesorios', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name", "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP
WHERE "Category"."name" IS DISTINCT FROM EXCLUDED."name" OR NOT "Category"."isActive";

COMMIT;
