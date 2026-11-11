/*
 * The guard: the only way a provider row becomes an Offer.
 *
 * Default-deny. A row is admitted when every field the catalog will later
 * render or compare has been checked, and it is rejected otherwise — there is
 * no partial record and no placeholder. The alternative, letting a row in with
 * a blank image or an unparsable price and "fixing it in the UI", is how a
 * comparison site ends up displaying a number nobody can defend.
 *
 * WHAT A REJECTION IS ALLOWED TO SAY. A row number, the merchant's own SKU, and
 * machine-readable reason codes. Never a cell's contents: the `link` column in
 * this feed holds CJ tracking URLs, and a rejection list is exactly the kind of
 * thing that gets pasted into a CI log or an issue. Reason codes are a closed
 * union so that a new failure mode has to be named deliberately.
 *
 * All reasons for a row are collected rather than stopping at the first, so one
 * import run tells you everything wrong with a record.
 */
import {
  missingShipping,
  verifiedShipping,
  type Availability,
  type ItemCondition,
  type MandatoryFees,
  type Offer,
  type ShippingCost,
} from './offer';
import { parseBareAmount, parseFeedMoney, type Money } from './money';
import {
  SHOPPING_FEED_NO_FEE_COLUMN,
  type RawShoppingRow,
  type ShoppingFeedParse,
} from './feed/cj-shopping-feed';

export type RejectionReason =
  | 'missing-offer-id'
  | 'missing-title'
  | 'missing-brand'
  | 'weak-identity'
  | 'invalid-price'
  | 'invalid-sale-price'
  | 'price-currency-mismatch'
  | 'non-positive-price'
  | 'invalid-availability'
  | 'invalid-condition'
  | 'invalid-product-url'
  | 'invalid-image-url'
  | 'invalid-snapshot-timestamp'
  | 'future-snapshot-timestamp'
  | 'duplicate-offer-id';

export interface RejectedRow {
  readonly rowNumber: number;
  /** The merchant's SKU when it could be read. Never a URL or a price. */
  readonly merchantOfferId: string | null;
  readonly reasons: readonly RejectionReason[];
}

export interface CatalogSource {
  /** Must match a merchant in the registry; lower-case kebab, e.g. `soundcore`. */
  readonly merchantId: string;
  /** Provenance label, e.g. `cj:shopping:7382109`. Must carry no credentials. */
  readonly sourceFeed: string;
  /** When the export itself was produced; the fallback for rows with no own date. */
  readonly feedSnapshotAt: string;
  /** Reference instant for the future-timestamp check. Defaults to now. */
  readonly now?: Date;
}

export interface CatalogBuild {
  readonly offers: readonly Offer[];
  readonly rejected: readonly RejectedRow[];
}

const MERCHANT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SOURCE_FEED = /^[A-Za-z0-9:_.-]+$/;

/*
 * A provider clock can run ahead of ours, so a small lead is tolerated rather
 * than rejected. A record dated next week is a different thing entirely — it
 * means the timestamp is wrong, and a wrong timestamp makes "as of" claims on
 * the page wrong too.
 */
const MAX_CLOCK_SKEW_MS = 48 * 60 * 60 * 1000;

const AVAILABILITY: Readonly<Record<string, Availability>> = {
  'in stock': 'in_stock',
  in_stock: 'in_stock',
  'out of stock': 'out_of_stock',
  out_of_stock: 'out_of_stock',
  preorder: 'preorder',
  backorder: 'backorder',
};

const CONDITION: Readonly<Record<string, ItemCondition>> = {
  new: 'new',
  refurbished: 'refurbished',
  used: 'used',
};

/**
 * GTIN-8/12/13/14 with its check digit verified.
 *
 * The length test alone would admit a twelve-digit internal part number, and
 * GTIN is the key products are matched across merchants by. A mismatch there
 * does not show up as an error; it shows up as two different products being
 * compared as if they were one.
 */
export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop() as number;
  // Weights alternate 3,1 from the right-hand end of the payload.
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/*
 * A deliberately narrow test: https, a non-empty authority, no whitespace or
 * control characters anywhere. It is not a full WHATWG parse — the `URL`
 * constructor is not typed in this package, and pulling `@types/node` in for a
 * two-line check would mean a lockfile change for no behavioural gain. What
 * the catalog needs is the question this answers: may we put this string in an
 * `href` or an `img src` and show it to a shopper?
 *
 * Plain http is rejected rather than upgraded. Silently rewriting a provider's
 * URL is how a working link becomes a broken one.
 */
/*
 * The two halves must NOT overlap. The first version ended `[^\s/?#...]+[^\s...]*`,
 * and every character the second class accepts the first one accepts too — so on a
 * string that ultimately fails to match (`https://` then many `!` then a space) the
 * engine retries every split point between them. Measured on this machine: 10k
 * characters took 87ms, 40k took 1.4s and 80k took 5.6s, which is quadratic, and
 * the input is a URL field in an untrusted provider feed. Requiring the remainder
 * to begin with `/`, `?` or `#` makes the split deterministic: 80k now takes 0.3ms.
 *
 * It accepts exactly the same strings as before. Verified against the 450 real URLs
 * in the 10 November export plus 22 edge cases (no path, bare authority, port,
 * control characters, leading/trailing space, plain http, empty authority): zero
 * differences.
 */
const HTTPS_URL = /^https:\/\/[^\s/?#\x00-\x1f]+(?:[/?#][^\s\x00-\x1f]*)?$/;

export function isHttpsUrl(value: string): boolean {
  return HTTPS_URL.test(value);
}

/**
 * Read shipping from whatever the provider supplied, or state that it did not.
 *
 * The split columns are authoritative when present: `SHIPPING(PRICE)` with
 * `SHIPPING(COUNTRY)=US` pins the cost and destination as firmly as the packed
 * form. A price with no destination is NOT promoted to verified — the cost of
 * delivering somewhere unspecified is not a fact about delivering to a buyer.
 */
function readShipping(row: RawShoppingRow, currency: string, sourceFeed: string): ShippingCost {
  const splitPrice = row.fields.shippingPrice;
  const splitCountry = row.fields.shippingCountry.toUpperCase();

  if (splitPrice !== '') {
    const parsed = parseBareAmount(splitPrice, currency);
    if (parsed.ok && /^[A-Z]{2}$/.test(splitCountry)) {
      return verifiedShipping(parsed.money, splitCountry, `${sourceFeed}#SHIPPING(PRICE)`);
    }
    return missingShipping(
      parsed.ok
        ? 'provider stated a shipping price with no destination country'
        : 'provider shipping price could not be read as an amount',
    );
  }

  const packed = row.fields.shippingPacked;
  if (packed === '') {
    return missingShipping('provider feed carries no shipping value for this offer');
  }

  /*
   * Packed form: `US:CA:Ground:5.99`, several entries separated by commas.
   * A US entry wins when present; a lone entry is used as-is. Anything whose
   * country and amount cannot both be identified stays MISSING rather than
   * being half-read into a number.
   */
  const entries = packed
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  for (const entry of entries) {
    const parts = entry.split(':').map((part) => part.trim());
    const country = (parts[0] ?? '').toUpperCase();
    const amount = parts[parts.length - 1] ?? '';
    if (!/^[A-Z]{2}$/.test(country)) continue;
    const parsed = parseBareAmount(amount, currency);
    if (!parsed.ok) continue;
    if (country === 'US' || entries.length === 1) {
      return verifiedShipping(parsed.money, country, `${sourceFeed}#shipping`);
    }
  }

  return missingShipping('provider shipping value states no usable country and amount pair');
}

/**
 * Turn a parsed feed into offers.
 *
 * Throws only on a caller mistake — a malformed merchant id, a source label
 * that could smuggle a credential, an unreadable feed timestamp. Bad provider
 * data never throws; it lands in `rejected`.
 */
export function buildCatalog(parse: ShoppingFeedParse, source: CatalogSource): CatalogBuild {
  if (!MERCHANT_ID.test(source.merchantId)) {
    throw new TypeError('invalid merchantId: expected lower-case kebab-case');
  }
  if (!SOURCE_FEED.test(source.sourceFeed)) {
    throw new TypeError('invalid sourceFeed label: use a plain provenance token, not a URL');
  }
  const feedSnapshot = new Date(source.feedSnapshotAt);
  if (Number.isNaN(feedSnapshot.getTime())) {
    throw new TypeError('invalid feedSnapshotAt: expected an ISO-8601 instant');
  }
  const now = source.now ?? new Date();

  const offers: Offer[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();

  for (const row of parse.rows) {
    const reasons: RejectionReason[] = [];
    const f = row.fields;

    const merchantOfferId = f.id;
    if (merchantOfferId === '') reasons.push('missing-offer-id');
    if (f.title === '') reasons.push('missing-title');
    if (f.brand === '') reasons.push('missing-brand');

    const gtin = isValidGtin(f.gtin) ? f.gtin : null;
    const mpn = f.mpn === '' ? null : f.mpn;
    // Either a verified GTIN, or a brand/MPN pair. Nothing else identifies a
    // product well enough to compare it with another merchant's listing.
    if (gtin === null && !(f.brand !== '' && mpn !== null)) reasons.push('weak-identity');

    const price = parseFeedMoney(f.price);
    let listPrice: Money | null = null;
    if (!price.ok) {
      reasons.push('invalid-price');
    } else if (price.money.amountMinor <= 0) {
      reasons.push('non-positive-price');
    } else {
      listPrice = price.money;
    }

    let salePrice: Money | null = null;
    if (f.salePrice !== '') {
      const sale = parseFeedMoney(f.salePrice);
      if (!sale.ok) {
        reasons.push('invalid-sale-price');
      } else if (sale.money.amountMinor <= 0) {
        reasons.push('invalid-sale-price');
      } else if (listPrice !== null && sale.money.currency !== listPrice.currency) {
        reasons.push('price-currency-mismatch');
      } else {
        salePrice = sale.money;
      }
    }

    const availability = AVAILABILITY[f.availability.toLowerCase()];
    if (availability === undefined) reasons.push('invalid-availability');

    const condition = CONDITION[f.condition.toLowerCase()];
    if (condition === undefined) reasons.push('invalid-condition');

    if (!isHttpsUrl(f.link)) reasons.push('invalid-product-url');
    if (!isHttpsUrl(f.imageLink)) reasons.push('invalid-image-url');

    const snapshotRaw = f.lastUpdated === '' ? source.feedSnapshotAt : f.lastUpdated;
    const snapshot = new Date(snapshotRaw);
    if (Number.isNaN(snapshot.getTime())) {
      reasons.push('invalid-snapshot-timestamp');
    } else if (snapshot.getTime() - now.getTime() > MAX_CLOCK_SKEW_MS) {
      reasons.push('future-snapshot-timestamp');
    }

    // Duplicates are judged last so that a repeated row still reports its own
    // faults, and the FIRST occurrence is the one kept: later rows in a feed
    // are revisions of unknown order, and silently preferring one would make
    // the import non-deterministic.
    if (merchantOfferId !== '' && seen.has(merchantOfferId)) {
      reasons.push('duplicate-offer-id');
    }

    if (
      reasons.length > 0 ||
      listPrice === null ||
      availability === undefined ||
      condition === undefined
    ) {
      rejected.push({
        rowNumber: row.rowNumber,
        merchantOfferId: merchantOfferId === '' ? null : merchantOfferId,
        reasons,
      });
      continue;
    }

    seen.add(merchantOfferId);

    const mandatoryFees: MandatoryFees = {
      kind: 'UNKNOWN',
      reason: SHOPPING_FEED_NO_FEE_COLUMN,
    };

    offers.push({
      offerId: `${source.merchantId}:${merchantOfferId}`,
      merchantId: source.merchantId,
      merchantOfferId,
      gtin,
      mpn,
      brand: f.brand,
      title: f.title,
      listPrice,
      salePrice,
      availability,
      condition,
      productUrl: f.link,
      imageUrl: f.imageLink,
      shipping: readShipping(row, listPrice.currency, source.sourceFeed),
      mandatoryFees,
      snapshotAt: snapshot.toISOString(),
      sourceFeed: source.sourceFeed,
    });
  }

  return { offers, rejected };
}
