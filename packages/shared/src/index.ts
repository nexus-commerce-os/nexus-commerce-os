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
