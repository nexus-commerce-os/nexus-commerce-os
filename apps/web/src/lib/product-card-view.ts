/*
 * The seam between the catalog domain and the design system.
 *
 * `@nexus/catalog` knows what an Offer is; `@nexus/ui` knows what a card looks
 * like; neither imports the other. This module is the one place that does
 * both, and it lives in the app because the app is the composition root.
 *
 * It is also the only place money becomes a string. That is deliberate: the
 * card takes a pre-formatted price precisely so no component can be tempted to
 * add two of them together.
 */
import {
  deliveredPriceRankingEligibility,
  itemPrice,
  minorUnitExponent,
  type Money,
  type Offer,
} from '@nexus/catalog';
import type { ProductCardProps, ProductCardShipping } from '@nexus/ui';

/*
 * Format from the integer, never through a float.
 *
 * `Intl.NumberFormat` would mean dividing by 100 first, and 7999/100 is not
 * exactly 79.99 in IEEE-754 — it rounds back correctly today, at two decimal
 * places, for amounts this size. That is a lot of qualifiers to rely on when
 * the alternative is splitting a string. The currency symbol is looked up
 * rather than assumed, so a non-USD feed renders as its own currency instead
 * of silently wearing a dollar sign.
 */
const CURRENCY_SYMBOL: Readonly<Record<string, string>> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
};

export function formatMoney(money: Money): string {
  const exponent = minorUnitExponent(money.currency);
  const digits = String(Math.abs(money.amountMinor)).padStart(exponent + 1, '0');
  const units = digits.slice(0, digits.length - exponent) || '0';
  const fraction = exponent === 0 ? '' : `.${digits.slice(digits.length - exponent)}`;
  const grouped = units.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = CURRENCY_SYMBOL[money.currency];
  const sign = money.amountMinor < 0 ? '-' : '';
  return symbol === undefined
    ? `${sign}${grouped}${fraction} ${money.currency}`
    : `${sign}${symbol}${grouped}${fraction}`;
}

/** 2026-10-29T11:35:12.000Z -> "29 Oct 2026". Fixed locale: the page is en-US. */
export function formatSnapshot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function toShipping(offer: Offer): ProductCardShipping {
  if (offer.shipping.kind === 'VERIFIED') {
    return {
      kind: 'verified',
      label: formatMoney(offer.shipping.cost),
      destination: offer.shipping.destinationCountry,
    };
  }
  return { kind: 'not-verified' };
}

export interface ViewOptions {
  /** Display name for the merchant, from the merchant registry — not the feed. */
  readonly merchantName: string;
  /** Why no outbound link exists. Shown to the visitor. */
  readonly linkUnavailableReason: string;
  readonly disclosure: string;
}

/**
 * Offer -> ProductCard props.
 *
 * Nothing is invented on the way through. Shipping the provider did not state
 * stays `not-verified`; there is no delivered cost to map because the card has
 * no prop for one; and the guard below is a refusal rather than a comment —
 * if an offer ever did qualify for delivered-price ranking, this card is the
 * wrong component to render it in and the mapper should say so loudly rather
 * than quietly drop the fact.
 */
export function toProductCardView(offer: Offer, options: ViewOptions): ProductCardProps {
  if (deliveredPriceRankingEligibility(offer).eligible) {
    throw new Error(
      `offer ${offer.offerId} has a fully verified delivered cost; ` +
        'ProductCard cannot display one, so rendering it here would hide a fact the ' +
        'visitor is entitled to. Use the comparison surface instead.',
    );
  }

  return {
    title: offer.title,
    itemPrice: formatMoney(itemPrice(offer)),
    merchantName: options.merchantName,
    availability: offer.availability,
    shipping: toShipping(offer),
    snapshotAt: offer.snapshotAt,
    snapshotLabel: formatSnapshot(offer.snapshotAt),
    imageUrl: offer.imageUrl,
    imageAlt: offer.title,
    linkUnavailableReason: options.linkUnavailableReason,
    disclosure: options.disclosure,
  };
}
