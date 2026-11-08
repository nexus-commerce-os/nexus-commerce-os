/*
 * The first-party product catalog.
 *
 * WHAT THIS IS. A PRODUCT catalog, not an OFFER catalog. Every record here
 * carries identity and specification and states no price, no stock and no
 * merchant. That distinction is the whole design: it is what lets products
 * become visible on this site without an affiliate relationship, and it is
 * why nothing on these pages depends on the CJ/Soundcore work.
 *
 * WHERE THE DATA COMES FROM. Every record was read off the manufacturer's own
 * published specification page, by hand, on the date in `verifiedOn`, and
 * `sourceUrl` is the exact page it was read from. Values are transcribed as
 * the manufacturer wrote them, including their own units and capitalisation.
 * Nothing is filled in from general knowledge: where a page does not state a
 * field, the field is simply absent, and where a page covers several variants
 * with different values the record says so in `notes` rather than silently
 * picking one.
 *
 * THIS IS NOT AN ENDORSEMENT, AND NOT AN AUTHORISATION. Reading a public
 * specification page tells us what a product is. It does not make us a
 * partner, an affiliate or a reseller of that manufacturer, and it grants no
 * right to their imagery — which is why no record carries an image and the
 * cards render a neutral placeholder instead.
 *
 * WHY TEN AND NOT TWENTY-FIVE. Twenty-five products were researched. Fifteen
 * were dropped because their manufacturer pages could not be read without
 * defeating a bot challenge, returned 403/404, redirected to another brand's
 * storefront, or covered a different generation than the one named. Those are
 * recorded in the release notes rather than papered over: a smaller catalog
 * that is true beats a fuller one that is partly invented.
 *
 * ADDING A RECORD. Read the manufacturer's page, transcribe the fields you can
 * see, set `verifiedOn` to the date you read it, and put anything uncertain in
 * `notes`. `apps/web/scripts/verify-catalog.mjs` refuses a record whose source
 * is not an https URL on the manufacturer's own domain, refuses a malformed or
 * future verification date, and refuses any price, rating or availability
 * field — so the honest state cannot be lost by accident.
 */

/** Where a record's content came from. Decides what the page may say. */
export type Provenance =
  /** Transcribed from the manufacturer's own published specification page. */
  'manufacturer-specification';

export type Category = {
  readonly slug: string;
  readonly name: string;
  /** One line, plain. Shown above the grid when the category is selected. */
  readonly blurb: string;
  /** An existing editorial guide explaining how to judge this category. */
  readonly guide?: string;
};

export type Spec = {
  readonly label: string;
  /** Verbatim from the manufacturer's page, in their units and wording. */
  readonly value: string;
};

export type Product = {
  readonly slug: string;
  /** The manufacturer, as they write their own name. */
  readonly brand: string;
  /** The product name as the manufacturer's page prints it. */
  readonly name: string;
  /**
   * Model number or SKU exactly as printed on the source page, or `null` when
   * the page states none. `null` is a finding, not a gap to be filled in.
   */
  readonly model: string | null;
  readonly categorySlug: string;
  readonly provenance: Provenance;
  /** The exact manufacturer page these values were read from. */
  readonly sourceUrl: string;
  /** ISO date the page was read. Not the manufacturer's own publication date. */
  readonly verifiedOn: string;
  /** Neutral description of what the thing is. No marketing adjectives. */
  readonly summary: string;
  readonly specs: readonly Spec[];
  /** Variant ambiguity, lifecycle status, and anything else a reader must know. */
  readonly notes?: readonly string[];
};

export const CATEGORIES: readonly Category[] = [
  {
    slug: 'headphones',
    name: 'Headphones',
    blurb: 'Over-ear, on-ear and in-ear, including active noise cancelling.',
    guide: '/guides/over-ear-headphones',
  },
  {
    slug: 'televisions',
    name: 'Televisions',
    blurb: 'Panel type is the first thing to establish; the rest follows from it.',
    guide: '/guides/oled-tv',
  },
  {
    slug: 'storage',
    name: 'Storage',
    blurb: 'Internal and portable solid-state drives.',
    guide: '/guides/ssd',
  },
  {
    slug: 'laptops',
    name: 'Laptops',
    blurb: 'Portable computers, grouped by what they are actually for.',
    guide: '/guides/laptop',
  },
  {
    slug: 'keyboards',
    name: 'Keyboards',
    blurb: 'Mechanical and membrane, by switch type and layout.',
    guide: '/guides/mechanical-keyboard',
  },
];

export const PRODUCTS: readonly Product[] = [
  // ======================= HEADPHONES =======================
  {
    slug: 'sennheiser-hd-600',
    brand: 'Sennheiser',
    name: 'HD 600 Wired Open-Back Headphones',
    model: '508824',
    categorySlug: 'headphones',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://us.sennheiser-hearing.com/products/hd-600',
    verifiedOn: '2026-11-08',
    summary:
      'Open-back, circumaural wired headphones with a dynamic transducer and no active electronics.',
    specs: [
      { label: 'Transducer principle', value: 'dynamic, open' },
      { label: 'Ear coupling', value: 'circumaural' },
      { label: 'Frequency response (speaker)', value: '12 Hz - 40,500 Hz' },
      { label: 'Impedance', value: '300 Ω' },
      { label: 'Weight', value: '260 g' },
      { label: 'Driver', value: '42mm' },
      { label: 'Connector', value: '3.5 mm stereo jack plug' },
    ],
    notes: [
      'Reached via a 301 redirect from sennheiser-hearing.com to the same brand’s US storefront; the final URL is the one recorded here.',
      'Wired only. The page states no Bluetooth and no active noise cancelling.',
    ],
  },
  {
    slug: 'bose-quietcomfort-ultra-headphones',
    brand: 'Bose',
    name: 'QuietComfort Ultra Headphones',
    model: null,
    categorySlug: 'headphones',
    provenance: 'manufacturer-specification',
    sourceUrl:
      'https://www.bose.com/p/headphones/bose-quietcomfort-ultra-headphones/QCUH-HEADPHONEARN.html',
    verifiedOn: '2026-11-09',
    summary:
      'Around-ear wireless headphones with active noise cancelling and Bose’s spatial-audio mode.',
    specs: [
      { label: 'Headphone Fit', value: 'Around Ear Circumaural' },
      {
        label: 'Noise Control Type',
        value: 'Active Noise Cancelling, Echo Reduction, Adjustable Noise Cancelling',
      },
      { label: 'Bluetooth Version', value: '5.3' },
      { label: 'Battery Life', value: '24 hours' },
      { label: 'Headphone', value: '7.7" H x 5.5" W x 2.0" D (0.56 lb)' },
      { label: 'Product Material', value: 'Plastic, Aluminum, Leather (Protein)' },
    ],
    notes: [
      'This is the first-generation model. The same page’s comparison table lists a separate “Bose QuietComfort Ultra Headphones (2nd Gen)” rated at 30 hours; none of its values are used here.',
      'Bose prints no model number on the page. The code QCUH-HEADPHONEARN appears only in the URL, so it is not recorded as a model number.',
      'Driver size, frequency response and impedance are not stated on the page.',
    ],
  },

  // ======================= TELEVISIONS =======================
  {
    slug: 'lg-oled65c4pua',
    brand: 'LG',
    name: 'LG C4 65 Inch Class OLED evo AI 4K Smart TV 2024',
    model: 'OLED65C4PUA',
    categorySlug: 'televisions',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://www.lg.com/us/tvs/lg-oled65c4pua-oled-4k-tv',
    verifiedOn: '2026-11-09',
    summary:
      'Self-emissive OLED television in the 65-inch class, with a 144Hz panel aimed at gaming as well as film.',
    specs: [
      { label: 'Display technology', value: 'OLED evo — “over 8.3 million self-lit pixels”' },
      { label: 'Screen size class', value: '65 Inch Class' },
      { label: 'Resolution', value: '4K' },
      { label: 'Refresh rate', value: '144Hz Refresh Rate' },
      { label: 'Processor', value: 'Alpha 9 AI Processor Gen7' },
      { label: 'HDR format named', value: 'Dolby Vision™' },
    ],
    notes: [
      'A 2024 model. The page itself states “There is a newer model of this TV available” and points to the LG OLED evo C6.',
      'The page sells the C4 in 42, 48, 55, 65, 77 and 83 inch sizes. Every value here is for the 65-inch OLED65C4PUA.',
      'Backlight type is not stated, because an OLED panel has none; the page describes self-lit pixels instead.',
    ],
  },

  // ======================= STORAGE =======================
  {
    slug: 'samsung-990-pro-2tb',
    brand: 'Samsung',
    name: '2TB PCIe 4.0 NVMe™ M.2 SSD 990 PRO',
    model: 'MZ-V9P2T0B/AM',
    categorySlug: 'storage',
    provenance: 'manufacturer-specification',
    sourceUrl:
      'https://www.samsung.com/us/computing/memory-storage/solid-state-drives/990-pro-pcie-4-0-nvme-ssd-2tb-mz-v9p2t0b-am/',
    verifiedOn: '2026-11-08',
    summary: 'Internal M.2 NVMe solid-state drive on the PCIe 4.0 interface, 2TB capacity.',
    specs: [
      { label: 'Interface', value: 'PCIe 4.0 NVMe™' },
      { label: 'Form factor', value: 'M.2 SSD' },
      { label: 'Capacity', value: '2TB' },
      { label: 'Sequential read', value: '7,450MB/s Read' },
      { label: 'Sequential write', value: '6,900MB/s Write' },
    ],
    notes: [
      'Samsung sells the 990 PRO in 1TB, 2TB and 4TB. The speeds above sit in the 2TB product header; the page carries no per-capacity spec table, so they are recorded for the 2TB model only.',
      'The page says “M.2 SSD” and does not state the 2280 length. NAND type and TBW endurance are not stated.',
    ],
  },
  {
    slug: 'samsung-t7-shield-2tb',
    brand: 'Samsung',
    name: '2TB Portable SSD T7 USB 3.2 Gen 2 Shield Black',
    model: 'MU-PE2T0S/AM',
    categorySlug: 'storage',
    provenance: 'manufacturer-specification',
    sourceUrl:
      'https://www.samsung.com/us/computing/memory-storage/portable-solid-state-drives/portable-ssd-t7-shield-usb-3-2-2tb-black-mu-pe2t0s-am/',
    verifiedOn: '2026-11-08',
    summary: 'External solid-state drive in a rubberised enclosure, connected over USB-C.',
    specs: [
      { label: 'Interface', value: 'USB 3.2 Gen 2' },
      { label: 'Capacity', value: '2TB' },
      { label: 'Sequential read/write', value: 'Read/write speeds of up to 1,050/1,000 MB/s' },
      { label: 'Water resistance', value: 'IP65 Water Resistant' },
      { label: 'Drop resistance', value: 'Rugged durability enduring up to 9.8 ft drop' },
    ],
    notes: [
      'The quoted speeds are stated for the product, not broken out by capacity.',
      'NAND type and TBW endurance are not stated on the page.',
    ],
  },
  {
    slug: 'crucial-p3-plus-1tb',
    brand: 'Crucial',
    name: 'Crucial P3 Plus 1TB PCIe M.2 2280 SSD',
    model: 'CT1000P3PSSD8',
    categorySlug: 'storage',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://www.crucial.com/ssd/p3-plus/ct1000p3pssd8',
    verifiedOn: '2026-11-09',
    summary: 'Internal M.2 2280 NVMe drive built by Micron, with Gen3 backward compatibility.',
    specs: [
      { label: 'Interface', value: 'Gen4 NVMe' },
      { label: 'Form factor', value: 'M.2 2280' },
      { label: 'Capacity', value: '1TB' },
      { label: 'Compatibility', value: 'flexible backward compatibility for most Gen3 systems' },
      { label: 'Built by', value: 'Engineered by Micron®' },
    ],
    notes: [
      'The manufacturer’s page marks this product EOL (end of life). It is kept as a specification record, not as a buying suggestion.',
      'The page offers 500GB, 1TB, 2TB and 4TB. Everything here is the 1TB CT1000P3PSSD8.',
      'Sequential read and write speeds were not present in the page content that loaded, so they are not recorded.',
    ],
  },

  // ======================= LAPTOPS =======================
  {
    slug: 'apple-macbook-air-13-m5',
    brand: 'Apple',
    name: 'MacBook Air 13-inch (M5)',
    model: null,
    categorySlug: 'laptops',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://www.apple.com/macbook-air/specs/',
    verifiedOn: '2026-11-09',
    summary: 'Thin-and-light 13.6-inch laptop on Apple silicon, with no discrete graphics.',
    specs: [
      { label: 'Chip', value: 'Apple M5 chip' },
      { label: 'CPU', value: '10-core CPU with 4 super cores and 6 efficiency cores' },
      {
        label: 'Display',
        value:
          '13.6-inch (diagonal) LED-backlit display with IPS technology; 2560-by-1664 native resolution at 224 pixels per inch',
      },
      { label: 'Brightness', value: '500 nits brightness' },
      { label: 'Battery', value: 'Built-in 53.8-watt-hour lithium-polymer battery' },
      {
        label: 'Charging and expansion',
        value: 'Two Thunderbolt 4 (USB-C) ports, MagSafe 3 charging port, 3.5 mm headphone jack',
      },
    ],
    notes: [
      'Apple’s specification page prints no model identifier — it labels the configurations only “Model 1”, “Model 2” and “Model 3” — so none is recorded.',
      'GPU, memory and storage vary by configuration: the page lists an 8-core GPU on the base model and a 10-core GPU on the others, 16GB or 24GB memory configurable to 32GB, and 512GB or 1TB storage configurable up to 4TB. No single configuration is presented here as “the” product.',
      'The page covers both the 13-inch and 15-inch sizes. Only 13-inch values are recorded.',
      'This is the M5 generation. An earlier M3 MacBook Air is a different product and none of its values appear here.',
    ],
  },

  // ======================= KEYBOARDS =======================
  {
    slug: 'corsair-k70-rgb-pro',
    brand: 'Corsair',
    name: 'K70 RGB PRO Mechanical Gaming Keyboard with PBT DOUBLE SHOT PRO Keycaps — CHERRY® MX Red',
    model: 'CH-9109410-NA',
    categorySlug: 'keyboards',
    provenance: 'manufacturer-specification',
    sourceUrl:
      'https://www.corsair.com/us/en/p/keyboards/ch-9109410-na/k70-rgb-pro-mechanical-gaming-keyboard-ch-9109410-na',
    verifiedOn: '2026-11-08',
    summary: 'Full-size wired mechanical keyboard with per-key RGB and a detachable USB-C cable.',
    specs: [
      { label: 'Key switches', value: 'CHERRY MX Red' },
      { label: 'Keyboard form factor', value: 'Full Size' },
      { label: 'Matrix', value: '104 Keys' },
      { label: 'Report rate', value: 'Up to 8,000Hz' },
      { label: 'Keyboard connectivity', value: 'Wired — USB 3.0 or 3.1 Type-A' },
      { label: 'Keycaps', value: 'PBT DOUBLE-SHOT PRO KEYCAPS' },
      { label: 'Backlighting', value: 'PER-KEY RGB BACKLIGHTING' },
    ],
    notes: [
      'This SKU is the CHERRY MX Red variant. The page’s switch selector also offers Cherry MX RGB Brown, Cherry MX RGB Red, Cherry MX RGB Speed and CORSAIR OPX, which are different SKUs.',
      'The spec table’s own “Size” row reads “Full TKL”, which contradicts the “Full Size” form-factor row and the 104-key matrix. The two unambiguous rows are recorded; the contradictory one is not.',
    ],
  },
  {
    slug: 'das-keyboard-4-professional',
    brand: 'Das Keyboard',
    name: 'Das Keyboard 4 Professional',
    model: null,
    categorySlug: 'keyboards',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://www.daskeyboard.com/daskeyboard-4-professional/',
    verifiedOn: '2026-11-08',
    summary: 'Full-size wired mechanical keyboard with a machined volume knob and media controls.',
    specs: [
      { label: 'Layout', value: '104-key US layout, 105-key for UK, NO, and DE layouts' },
      { label: 'Key switches', value: 'Cherry MX2A mechanical key switches with gold contacts' },
      {
        label: 'Connectivity',
        value: 'Extra long 6.5 ft USB cable with single USB type-A connector',
      },
    ],
    notes: [
      'Sold in two switch variants: Cherry MX Brown (soft tactile) and Cherry MX Blue (clicky). Neither is recorded as the default.',
      'The page prints no SKU, no polling rate and no backlighting specification, and states no keycap material for the stock keycaps.',
      'Wired only — the page describes no wireless mode.',
    ],
  },
  {
    slug: 'keychron-k2-v2',
    brand: 'Keychron',
    name: 'Keychron K2 Wireless Mechanical Keyboard (Version 2)',
    model: 'K2-A1Z',
    categorySlug: 'keyboards',
    provenance: 'manufacturer-specification',
    sourceUrl: 'https://www.keychron.com/products/keychron-k2-wireless-mechanical-keyboard',
    verifiedOn: '2026-11-09',
    summary:
      'Compact 75% mechanical keyboard with hot-swappable switches, usable wired or over Bluetooth.',
    specs: [
      { label: 'Layout', value: '75%' },
      { label: 'Connectivity', value: 'Bluetooth (up to 3 devices), wired; 1000 Hz polling rate' },
      {
        label: 'Switches',
        value: 'Keychron Super blue/red/brown switches; hot-swappable',
      },
      { label: 'Keycaps', value: 'ABS' },
      { label: 'Battery', value: '4000 mAh, up to 240 hours' },
      { label: 'Backlight', value: 'Adjustable 4-level RGB backlit' },
      { label: 'Build', value: 'ABS Plastic, tray mount' },
    ],
    notes: [
      'Version 2 specifically. The page also advertises newer K2 HE and K2 Ultra 8K models, whose values are not used here.',
      'Switch is chosen at purchase from Keychron Super Red, Super Blue or Super Brown; no single switch is recorded as the default.',
      'The “up to 240 hours” battery figure is stated by the page for use with the backlight off.',
      'Weight and frame differ by variant: the page gives 794g / 28oz for the aluminium frame and 663 g / 23.4 oz for the plastic frame, so neither is recorded as the product weight.',
    ],
  },
];

/** What the catalog says about price, everywhere. There is no verified price. */
export const PRICE_STATUS = 'Price not verified';

/** What the catalog says about stock, everywhere. There is no verified stock state. */
export const AVAILABILITY_STATUS = 'Not verified';

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function productBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function productsInCategory(slug: string): readonly Product[] {
  return PRODUCTS.filter((p) => p.categorySlug === slug);
}

/*
 * Brand plus name, without saying the brand twice.
 *
 * Manufacturers are inconsistent about whether their own name is part of the
 * product name: Sennheiser writes "HD 600 Wired Open-Back Headphones", while
 * LG writes "LG C4 65 Inch Class OLED evo AI 4K Smart TV 2024". Both are
 * transcribed verbatim, because editing a maker's product name to fit our
 * layout is exactly the kind of small untruth this catalog is built to avoid.
 * So the duplication is fixed at render time, not in the data.
 */
export function displayName(product: Product): string {
  const brand = product.brand.toLowerCase();
  return product.name.toLowerCase().startsWith(brand)
    ? product.name
    : `${product.brand} ${product.name}`;
}

/** The host of a record's source, for display: "www.lg.com" -> "lg.com". */
export function sourceHost(product: Product): string {
  return new URL(product.sourceUrl).hostname.replace(/^www\./, '');
}

/** 2026-11-09 -> "9 Nov 2026". Fixed locale: the page is en-US. */
export function formatVerifiedOn(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/*
 * Search over the brand, name, model, summary and specification values.
 *
 * TOKEN-PREFIX, NOT SUBSTRING. An earlier version matched raw substrings and
 * a search for "OLED" returned a laptop, because "actively cooled" contains
 * the letters o-l-e-d. That is correct substring behaviour and useless search
 * behaviour. Matching a query token against the START of a word fixes it
 * without inventing relevance scoring: "OLED" finds OLED, "nvme" finds NVMe,
 * "ten" still finds tenkeyless.
 *
 * Deliberately not fuzzy and deliberately unranked. A catalog this size needs
 * neither, and a search that quietly returns near-misses is worse than one
 * that honestly returns nothing.
 */
function tokens(text: string): readonly string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9.]+/)
    .filter(Boolean);
}

export function searchProducts(
  query: string,
  products: readonly Product[] = PRODUCTS,
): readonly Product[] {
  const needles = tokens(query);
  if (needles.length === 0) return products;
  return products.filter((p) => {
    const haystack = tokens(
      [p.brand, p.name, p.model ?? '', p.summary, ...p.specs.map((s) => `${s.label} ${s.value}`)]
        .join(' '),
    );
    // Every typed token must match the start of some word: "open ear" should
    // not match a product that merely has an "open" somewhere and no "ear".
    return needles.every((needle) => haystack.some((word) => word.startsWith(needle)));
  });
}

/**
 * Invariants a reviewer should not have to re-check by eye. Exercised by
 * apps/web/scripts/verify-catalog.mjs, so a violation fails the build.
 */
/*
 * The latest calendar date in use anywhere on Earth right now (UTC+14, Kiritimati).
 *
 * `verifiedOn` records the date on the reviewer's own calendar. Comparing that
 * against the UTC date rejects a perfectly honest record for up to fourteen
 * hours a day — which is exactly how this guard first failed, on records read
 * in Dhaka (UTC+6) on a date UTC had not reached yet. A "not in the future"
 * check has to mean "not in the future for anybody".
 */
export function latestDateOnEarth(now: Date = new Date()): string {
  return new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function assertCatalogIntegrity(): void {
  const seen = new Set<string>();
  const today = latestDateOnEarth();
  for (const p of PRODUCTS) {
    if (seen.has(p.slug)) throw new Error(`duplicate product slug: ${p.slug}`);
    seen.add(p.slug);
    if (!categoryBySlug(p.categorySlug)) {
      throw new Error(`${p.slug}: unknown category ${p.categorySlug}`);
    }
    if (p.provenance !== 'manufacturer-specification') {
      throw new Error(`${p.slug}: unknown provenance ${String(p.provenance)}`);
    }
    if (!/^https:\/\//.test(p.sourceUrl)) {
      throw new Error(`${p.slug}: source is not an https URL`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedOn)) {
      throw new Error(`${p.slug}: verifiedOn is not an ISO date`);
    }
    if (p.verifiedOn > today) throw new Error(`${p.slug}: verifiedOn is in the future`);
    if (p.specs.length === 0) throw new Error(`${p.slug}: no specifications`);
    if (p.brand.trim() === '') throw new Error(`${p.slug}: no brand`);
    if (p.model !== null && p.model.trim() === '') {
      throw new Error(`${p.slug}: model is an empty string — use null when the page states none`);
    }
  }
  for (const c of CATEGORIES) {
    if (productsInCategory(c.slug).length === 0) {
      throw new Error(`category ${c.slug} has no products and would render empty`);
    }
  }
}
