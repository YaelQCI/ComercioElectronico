ALTER TABLE "Coupon" ADD COLUMN "freeShipping" BOOLEAN NOT NULL DEFAULT false;

-- Conservar la regla del umbral y permitir una bonificación de envío
-- respaldada por el cupón guardado en el pedido.
ALTER TABLE "Order" DROP CONSTRAINT "Order_shipping_rule";
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipping_rule" CHECK (
  CASE WHEN "couponId" IS NOT NULL AND COALESCE("couponSnapshot" @> '{"freeShipping":true}'::jsonb, false)
    THEN "shippingChargedCents" = 0
    ELSE (("goodsAfterCouponCents" >= 149900 AND "shippingChargedCents" = 0)
      OR ("goodsAfterCouponCents" < 149900 AND "shippingChargedCents" = "shippingQuotedCents"))
  END
);
