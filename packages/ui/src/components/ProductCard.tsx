import type { CSSProperties, ReactNode } from "react";

/*
 * A single product, as a card.
 *
 * WHAT THIS COMPONENT CANNOT DO, AND WHY THAT IS THE DESIGN. There is no
 * `deliveredCost` prop, no `total`, no `savings`, no `rank`, no `cheapest`
 * flag, and no `href`. Not "unset by default" — absent from the type. The feed
 * behind this card states no shipping cost for any of its 227 records, so a
 * delivered total would have to be invented, and a card that merely *defaults*
 * to hiding one is a card somebody wires up a total on next quarter. You cannot
 * pass what does not exist.
 *
 * Shipping is therefore shown, and shown as unknown. Leaving the row out
 * entirely would read as "no shipping charge"; printing a zero would be a lie.
 * The row says "Not verified" and the card says, in words, that the price is
 * the item only.
 *
 * The outbound link is absent for the same reason: this project has no
 * network-issued affiliate URL for any merchant, and a disabled control that
 * explains itself is more honest than a button that sends a real buyer to a URL
 * nobody authorised. Enabling it is a later, deliberate change — and it should
 * have to touch this file.
 *
 * Money arrives pre-formatted. The card does no arithmetic: formatting a money
 * value is the caller's job, summing them is nobody's job here.
 */

/** What is known about getting this item to a buyer. There is no third state. */
export type ProductCardShipping =
  | { readonly kind: "not-verified" }
  | {
      readonly kind: "verified";
      /** Pre-formatted, e.g. "$5.99". The card never computes it. */
      readonly label: string;
      /** Where that figure applies, e.g. "US". A cost without one is not verified. */
      readonly destination: string;
    };

export type ProductCardAvailability =
  "in_stock" | "out_of_stock" | "preorder" | "backorder";

const AVAILABILITY_LABEL: Record<ProductCardAvailability, string> = {
  in_stock: "In stock",
  out_of_stock: "Out of stock",
  preorder: "Pre-order",
  backorder: "Backordered",
};

const AVAILABILITY_TONE: Record<ProductCardAvailability, string> = {
  in_stock: "ok",
  out_of_stock: "off",
  preorder: "warn",
  backorder: "warn",
};

export type ProductCardProps = {
  title: string;
  /** Pre-formatted item price, e.g. "$79.99". The item alone — never a total. */
  itemPrice: string;
  merchantName: string;
  availability: ProductCardAvailability;
  shipping: ProductCardShipping;
  /** ISO-8601 instant the provider last confirmed this record. */
  snapshotAt: string;
  /** Human-readable rendering of `snapshotAt`, e.g. "29 Oct 2026". */
  snapshotLabel: string;
  /** Validated https image URL. Omit it and a labelled placeholder renders. */
  imageUrl?: string;
  /** Describes the product for screen readers. Required whenever an image is shown. */
  imageAlt?: string;
  /** Why no outbound link exists yet. Shown to the visitor, not hidden in a title. */
  linkUnavailableReason: string;
  /** Merchant/affiliate disclosure. Required: a product card without one is undisclosed. */
  disclosure: ReactNode;
  className?: string;
  style?: CSSProperties;
};

/**
 * Stable DOM id for the parts that reference each other. Derived from the
 * merchant SKU rather than a random value so the markup is identical on the
 * server and in a static export.
 */
function idFrom(title: string, suffix: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `pc-${slug || "item"}-${suffix}`;
}

export function ProductCard({
  title,
  itemPrice,
  merchantName,
  availability,
  shipping,
  snapshotAt,
  snapshotLabel,
  imageUrl,
  imageAlt,
  linkUnavailableReason,
  disclosure,
  className,
  style,
}: ProductCardProps) {
  const titleId = idFrom(title, "title");
  const reasonId = idFrom(title, "reason");

  return (
    <article
      className={["card", "pcard", className].filter(Boolean).join(" ")}
      style={style}
      aria-labelledby={titleId}
    >
      {/*
       * The media box keeps its aspect ratio whether or not an image loads, so
       * a grid of these never reflows. The placeholder lives *behind* the
       * image: when `imageUrl` is absent it is what you see, and when a URL
       * 404s at runtime the neutral tile shows through instead of a white gap.
       * No onError handler, deliberately — the design system is hook-free and
       * server-rendered, and the catalog guard already rejects any offer whose
       * image URL is not a valid https link, so an absent image here means the
       * caller chose not to pass one.
       */}
      <div
        className="pc-media"
        data-placeholder={imageUrl ? undefined : "true"}
      >
        <span className="pc-media-ph" aria-hidden="true">
          No image
        </span>
        {imageUrl ? (
          <img
            className="pc-img"
            src={imageUrl}
            alt={imageAlt ?? ""}
            loading="lazy"
          />
        ) : null}
      </div>

      <div className="pc-body">
        <h3 className="pc-title" id={titleId}>
          {title}
        </h3>

        <dl className="pc-facts">
          <div className="pc-fact">
            <dt>Item price</dt>
            <dd className="pc-price mono">{itemPrice}</dd>
          </div>

          <div className="pc-fact">
            <dt>Shipping</dt>
            <dd>
              {shipping.kind === "verified" ? (
                <span className="mono">
                  {shipping.label}{" "}
                  <span className="pc-dest">to {shipping.destination}</span>
                </span>
              ) : (
                <span className="pc-unverified">Not verified</span>
              )}
            </dd>
          </div>

          <div className="pc-fact">
            <dt>Sold by</dt>
            <dd>{merchantName}</dd>
          </div>

          <div className="pc-fact">
            <dt>Availability</dt>
            <dd>
              <span className={`pc-avail ${AVAILABILITY_TONE[availability]}`}>
                {AVAILABILITY_LABEL[availability]}
              </span>
            </dd>
          </div>

          <div className="pc-fact">
            <dt>Price last confirmed</dt>
            <dd>
              <time dateTime={snapshotAt}>{snapshotLabel}</time>
            </dd>
          </div>
        </dl>

        {/*
         * Said in words, not only in a table row a shopper may skim past. This
         * is the sentence that keeps the card honest when shipping is unknown.
         */}
        <p className="pc-note">
          Item price only. We have not verified what delivery costs, so this is
          not a total.
        </p>

        <button
          className="btn btn-ghost pc-cta"
          type="button"
          disabled
          aria-describedby={reasonId}
        >
          Link unavailable
        </button>
        <p className="pc-reason" id={reasonId}>
          {linkUnavailableReason}
        </p>

        <p className="pc-disc">{disclosure}</p>
      </div>
    </article>
  );
}

/**
 * Placeholder shown while a card's data is in flight. Same media ratio and the
 * same number of text rows as the real card, so a grid does not jump when the
 * data lands.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <article
      className={["card", "pcard", "pc-skel", className]
        .filter(Boolean)
        .join(" ")}
      aria-busy="true"
      aria-label="Loading product"
    >
      <div className="pc-media" data-placeholder="true" />
      <div className="pc-body">
        <div className="pc-skel-line pc-skel-title" />
        <div className="pc-skel-line" />
        <div className="pc-skel-line" />
        <div className="pc-skel-line pc-skel-short" />
      </div>
    </article>
  );
}

export type ProductCardErrorProps = {
  /** What could not be shown, in the visitor's terms. */
  message: string;
  className?: string;
};

/**
 * Shown in a card's place when its data could not be loaded or failed
 * validation. It states that nothing is known rather than rendering a partial
 * product: half a product card is indistinguishable from a cheap one.
 */
export function ProductCardError({
  message,
  className,
}: ProductCardErrorProps) {
  return (
    <article
      className={["card", "pcard", "pc-err", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      <div className="pc-body">
        <h3 className="pc-title">Product unavailable</h3>
        <p className="pc-note">{message}</p>
      </div>
    </article>
  );
}
