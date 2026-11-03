import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ProductCard,
  ProductCardError,
  ProductCardSkeleton,
  type ProductCardProps,
} from '../ProductCard';

/*
 * Every product below is INVENTED. No Soundcore title, price, GTIN, image URL or
 * link appears in this repository: the real feed is provider content under the CJ
 * terms and this repository is public. What the fixture does mirror is the SHAPE
 * of a validated offer — an item price with no shipping figure behind it, which is
 * the state 227 of 227 real records are in.
 */
function synthetic(overrides: Partial<ProductCardProps> = {}): ProductCardProps {
  return {
    title: 'Northwind Trading Over-Ear Headphones',
    itemPrice: '$79.99',
    merchantName: 'Northwind Trading',
    availability: 'in_stock',
    shipping: { kind: 'not-verified' },
    snapshotAt: '2026-10-29T11:35:12.000Z',
    snapshotLabel: '29 Oct 2026',
    imageUrl: 'https://cdn.example.invalid/img/headphones.jpg',
    imageAlt: 'Northwind Trading over-ear headphones in black',
    linkUnavailableReason:
      'We do not yet have an authorised link to this merchant, so we will not send you to one.',
    disclosure: 'Northwind Trading is not an affiliate partner. We earn nothing from this listing.',
    ...overrides,
  };
}

describe('ProductCard', () => {
  it('shows the real product fields', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Northwind Trading Over-Ear Headphones');
    expect(text).toContain('$79.99');
    expect(text).toContain('Item price');
    expect(text).toContain('Northwind Trading');
    expect(text).toContain('In stock');
    expect(text).toContain('29 Oct 2026');
  });

  it('marks the feed timestamp up as a machine-readable instant', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-29T11:35:12.000Z');
    expect(time?.textContent).toBe('29 Oct 2026');
  });

  /* ---------------- the shipping invariant ---------------- */

  it('renders unverified shipping as "Not verified", never as a number', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Shipping');
    expect(text).toContain('Not verified');
    // The three ways this has gone wrong on other sites.
    expect(text).not.toContain('$0');
    expect(text).not.toMatch(/\bfree\b/i);
    expect(text).not.toMatch(/\bestimated\b/i);
  });

  it('says in words that the price is not a total', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    expect(container.textContent).toContain('this is not a total');
  });

  it('renders a verified shipping cost with its destination', () => {
    const { container } = render(
      <ProductCard
        {...synthetic({
          shipping: { kind: 'verified', label: '$5.99', destination: 'US' },
        })}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('$5.99');
    expect(text).toContain('to US');
    expect(text).not.toContain('Not verified');
  });

  /* ---------------- what the card must never claim ---------------- */

  it('never shows a delivered cost, a saving, a ranking or a cheapest-price claim', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const text = (container.textContent ?? '').toLowerCase();
    for (const forbidden of [
      'delivered',
      'total cost',
      'all-in',
      'you save',
      'savings',
      'cheapest',
      'lowest price',
      'best price',
      'rank',
      '#1',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  /*
   * A type-level guard, not a rendering one. If someone adds a `deliveredCost`,
   * `total`, `savings`, `rank` or `href` prop to ProductCardProps, this file
   * stops compiling — which is the point: the restriction should be impossible
   * to remove quietly while the tests still pass.
   */
  it('has no prop that could express a total or an outbound link', () => {
    type Forbidden =
      | 'deliveredCost'
      | 'total'
      | 'totalPrice'
      | 'savings'
      | 'rank'
      | 'cheapest'
      | 'href'
      | 'affiliateUrl';
    type HasForbidden = Extract<keyof ProductCardProps, Forbidden>;
    const noneExist: HasForbidden extends never ? true : false = true;
    expect(noneExist).toBe(true);
  });

  /* ---------------- no unauthorised links ---------------- */

  it('renders no anchor at all, and a disabled button in its place', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    expect(container.querySelectorAll('a').length).toBe(0);

    const cta = container.querySelector('button');
    expect(cta?.disabled).toBe(true);
    expect(cta?.textContent).toBe('Link unavailable');

    // The disabled state explains itself to a screen reader, not just visually.
    const describedBy = cta?.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const reason = container.querySelector(`#${describedBy}`);
    expect(reason?.textContent).toContain('authorised link');
  });

  it('carries a merchant disclosure', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    expect(container.querySelector('.pc-disc')?.textContent).toContain('not an affiliate partner');
  });

  /* ---------------- images ---------------- */

  it('renders the image with its alt text when a URL is given', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.invalid/img/headphones.jpg');
    expect(img?.getAttribute('alt')).toBe('Northwind Trading over-ear headphones in black');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to a labelled placeholder when no URL is given', () => {
    const { container } = render(
      <ProductCard {...synthetic({ imageUrl: undefined, imageAlt: undefined })} />,
    );
    expect(container.querySelector('img')).toBeNull();
    const media = container.querySelector('.pc-media');
    expect(media?.getAttribute('data-placeholder')).toBe('true');
    expect(media?.textContent).toContain('No image');
  });

  it('hides the placeholder text from assistive tech when an image is present', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    expect(container.querySelector('.pc-media-ph')?.getAttribute('aria-hidden')).toBe('true');
  });

  /* ---------------- accessibility & states ---------------- */

  it('is an article labelled by its own title', () => {
    const { container } = render(<ProductCard {...synthetic()} />);
    const article = container.querySelector('article');
    const labelledBy = article?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(container.querySelector(`#${labelledBy}`)?.textContent).toBe(
      'Northwind Trading Over-Ear Headphones',
    );
  });

  it('produces the same ids for the same product on every render', () => {
    const a = render(<ProductCard {...synthetic()} />).container.innerHTML;
    const b = render(<ProductCard {...synthetic()} />).container.innerHTML;
    expect(a).toBe(b);
  });

  const availabilities: Array<[ProductCardProps['availability'], string, string]> = [
    ['in_stock', 'In stock', 'ok'],
    ['out_of_stock', 'Out of stock', 'off'],
    ['preorder', 'Pre-order', 'warn'],
    ['backorder', 'Backordered', 'warn'],
  ];

  availabilities.forEach(([value, label, tone]) => {
    it(`renders availability ${value} as "${label}"`, () => {
      const { container } = render(<ProductCard {...synthetic({ availability: value })} />);
      const pill = container.querySelector('.pc-avail');
      expect(pill?.textContent).toBe(label);
      expect(pill?.className).toBe(`pc-avail ${tone}`);
    });
  });
});

describe('ProductCardSkeleton', () => {
  it('announces itself as busy and shows no product data', () => {
    const { container } = render(<ProductCardSkeleton />);
    const article = container.querySelector('article');
    expect(article?.getAttribute('aria-busy')).toBe('true');
    expect(article?.getAttribute('aria-label')).toBe('Loading product');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('keeps the media ratio so a grid does not reflow when data lands', () => {
    const { container } = render(<ProductCardSkeleton />);
    expect(container.querySelector('.pc-media')?.getAttribute('data-placeholder')).toBe('true');
  });
});

describe('ProductCardError', () => {
  it('states that nothing is known rather than rendering half a product', () => {
    const { container } = render(<ProductCardError message="We could not load this product." />);
    const text = container.textContent ?? '';
    expect(text).toContain('Product unavailable');
    expect(text).toContain('We could not load this product.');
    expect(container.querySelector('article')?.getAttribute('role')).toBe('status');
    expect(container.querySelectorAll('a').length).toBe(0);
    expect(container.querySelector('button')).toBeNull();
  });
});
