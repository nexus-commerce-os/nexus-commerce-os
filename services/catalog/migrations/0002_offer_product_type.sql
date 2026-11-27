-- =============================================================================
-- The merchant's own category path, mirroring migrations-d1/0004.
--
-- WHY IT IS HERE AND NOT ONLY IN D1. Both adapters satisfy the same
-- `OfferStore` contract and the same contract suite runs against each. The
-- moment one schema carries a column the other does not, that claim is false —
-- and it failed exactly that way: adding `product_type` to the D1 migrations
-- alone made the Postgres adapter SELECT a column that did not exist, which
-- CI caught on the schema suite rather than in production.
--
-- Nullable with no default. A product whose merchant stated no path has no
-- path, and a default would be a category this project invented.
-- =============================================================================

ALTER TABLE catalog.merchant_offer ADD COLUMN IF NOT EXISTS product_type text NULL;

COMMENT ON COLUMN catalog.merchant_offer.product_type IS
  'The merchant''s own category path, verbatim (e.g. "Home > Drinkware"). NULL when the feed stated none; classification treats NULL as "no category", never as a gap to fill.';

CREATE INDEX IF NOT EXISTS merchant_offer_product_type
  ON catalog.merchant_offer (product_type) WHERE product_type IS NOT NULL;
