BEGIN;
CREATE TABLE "VariantAvailability" (
  "variantId" UUID NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT false,
  "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VariantAvailability_pkey" PRIMARY KEY ("variantId"),
  CONSTRAINT "VariantAvailability_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
COMMIT;
