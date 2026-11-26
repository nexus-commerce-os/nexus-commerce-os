-- =============================================================================
-- The merchant's own category path, which was being parsed and then dropped.
--
-- WHY THIS COLUMN DID NOT EXIST. The feed reader recognised `product_type`,
-- `google_product_category_name` and `google_product_category` from the first
-- day, and `buildCatalog` then built an Offer without it. So the one place a
-- stated category existed was a parsed row that nobody kept, and automatic
-- classification could only ever produce NULL — which it did, silently,
-- because "no stated path means no category" is also the correct behaviour
-- when a path genuinely was not stated. The two cases were indistinguishable.
--
-- Nullable with no default. A product whose merchant stated no path has no
-- path, and a default would be a category this project invented.
-- =============================================================================

ALTER TABLE catalog_merchant_offer ADD COLUMN product_type TEXT;

-- Classification groups by this before it slugifies, so the lookup is worth an
-- index once more than one merchant is live. Partial, so it holds only rows
-- that actually state one.
CREATE INDEX IF NOT EXISTS merchant_offer_product_type
  ON catalog_merchant_offer (product_type) WHERE product_type IS NOT NULL;
