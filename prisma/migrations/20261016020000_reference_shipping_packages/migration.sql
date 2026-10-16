BEGIN;

-- Cajas de referencia autorizadas por el propietario, no medidas físicas certificadas.
-- Conserva cajas existentes, incluso si se editaron o desactivaron estos códigos.
INSERT INTO "PackageType" (
  "id", "code", "innerLengthMm", "innerWidthMm", "innerHeightMm",
  "outerLengthMm", "outerWidthMm", "outerHeightMm", "tareWeightGrams",
  "maxGrossWeightGrams", "isActive", "version", "createdAt", "updatedAt"
)
VALUES
  (gen_random_uuid(), 'CAJA-CHICA', 240, 190, 190, 250, 200, 200, 150, 5000, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CAJA-MEDIANA', 340, 290, 240, 350, 300, 250, 300, 10000, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'CAJA-GRANDE', 440, 340, 290, 450, 350, 300, 500, 20000, true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

COMMIT;
