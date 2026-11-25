/**
 * @nexus/shared — framework-agnostic domain types and pure functions.
 *
 * Everything here is data in, data out: no I/O, no framework, no clock of its
 * own (every function that needs "now" takes it as an argument). That is what
 * lets the same rule run in the Worker, in a service and in a test, and give
 * the same answer in all three.
 *
 * The shapes follow the certified architecture rather than inventing one:
 * money is integer minor units plus an ISO-4217 code (NFR-CONS-01, ADR-0020),
 * and the licence tag is the one in docs/06 §4, whose RFC-2119 rules are
 * implemented in `license.ts` rather than restated in prose.
 */

export {
  type CurrencyCode,
  type Money,
  type Rounding,
  MoneyError,
  isSupportedCurrency,
  currencyExponent,
  money,
  zero,
  parseMoney,
  add,
  subtract,
  sum,
  compare,
  equals,
  isNegative,
  isZero,
  min,
  max,
  multiply,
  percentOf,
  toDecimalString,
  formatMoney,
  toJSON as moneyToJSON,
  fromJSON as moneyFromJSON,
} from './money.js';

export {
  type Gtin,
  type GtinFormat,
  type MatchStrength,
  type MerchantSku,
  type ProductIdentifiers,
  IdentifierError,
  gtinCheckDigit,
  parseGtin,
  tryParseGtin,
  gtinEquals,
  gtinInOriginalFormat,
  normalizeMpn,
  merchantSkuKey,
  matchStrength,
  isSameProduct,
} from './identifiers.js';

export {
  type AcquisitionMethod,
  type LicenseDecision,
  type LicenseRefusal,
  type LicenseTag,
  licenseAllowsUse,
  licenseAllowsRegion,
  licenseAllowsPriceDisplay,
  licenseAllowsImageRedistribution,
  licenseAllowsReviewText,
  cacheTtlSeconds,
  attributionFor,
} from './license.js';

export {
  type Freshness,
  type FreshnessTier,
  type FreshnessVerdict,
  type StalenessReason,
  MAX_AGE_SECONDS,
  evaluateFreshness,
  isFresh,
  describeAge,
} from './freshness.js';

export {
  type AllInResult,
  type Availability,
  type CostComponent,
  type Offer,
  type OfferProblem,
  type OfferValidation,
  OfferError,
  knownCost,
  unknownCost,
  offerId,
  allInPrice,
  comparableTotal,
  validateOffer,
  offerIsDisplayable,
  rankByTotal,
  sameTotal,
} from './offer.js';

export {
  type DropClaim,
  type PriceObservation,
  type PriceSummary,
  PriceHistoryError,
  sortByTime,
  withinWindow,
  summarise,
  describeDrop,
  trailingLow,
  daysSinceLow,
  volatilityBasisPoints,
  dailyCloses,
} from './price-history.js';

export {
  type Product,
  type ProductProblem,
  type ProductValidation,
  type VariantAxis,
  type VariantGroup,
  ProductError,
  categoryKey,
  isWithinCategory,
  identifiersOf,
  productMatchStrength,
  variantKey,
  groupVariants,
  duplicateVariants,
  validateProduct,
} from './product.js';

export {
  type AvailabilityRefusal,
  type ReachVerdict,
  type RegionCode,
  type RegionalAvailability,
  type ShippingReach,
  normalizeRegion,
  reachesRegion,
  regionalAvailability,
  offersVisibleInRegion,
} from './region.js';

export {
  type CsvOptions,
  type ImportResult,
  type RowRejection,
  OFFER_CSV_HEADER,
  PRODUCT_CSV_HEADER,
  SerializationError,
  parseCsv,
  csvField,
  toCsv,
  looksLikeFormula,
  sanitizeForSpreadsheet,
  importProductsCsv,
  exportProductsCsv,
  importOffersCsv,
  exportOffersCsv,
  importOffersJson,
  importProductsJson,
  exportOffersJson,
  exportProductsJson,
} from './serialization.js';
