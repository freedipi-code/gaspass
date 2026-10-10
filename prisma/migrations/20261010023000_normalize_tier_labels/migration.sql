UPDATE "ProductVariant"
SET "label" = COALESCE(
  NULLIF(regexp_replace("label", '^[[:space:]]*[0-9]+[[:space:]]*', ''), ''),
  'units'
)
WHERE "label" ~ '^[[:space:]]*[0-9]+';
