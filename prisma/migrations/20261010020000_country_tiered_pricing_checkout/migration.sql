ALTER TABLE "User"
ADD COLUMN "countryCode" TEXT;

ALTER TABLE "ProductVariant"
ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Existing labels such as "5 kg" or "100 Packs" represented a full pack
-- price. Preserve the same line total while converting to unit-price tiers.
WITH parsed AS (
  SELECT
    "id",
    (substring("label" from '^[[:space:]]*([0-9]+)'))::INTEGER AS quantity
  FROM "ProductVariant"
  WHERE "label" ~ '^[[:space:]]*[0-9]+'
)
UPDATE "ProductVariant" AS variant
SET
  "quantity" = parsed.quantity,
  "price" = variant."price" / parsed.quantity
FROM parsed
WHERE variant."id" = parsed."id" AND parsed.quantity > 0;

ALTER TABLE "Order"
ADD COLUMN "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "shippingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "fiatCurrency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN "email" TEXT,
ADD COLUMN "shippingMethod" TEXT,
ADD COLUMN "cryptoAmount" TEXT;
