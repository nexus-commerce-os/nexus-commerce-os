/*
 * NON-PRODUCTION field-population audit — Soundcore CJ product feed (advertiser 7382109).
 *
 * THE QUESTION: of the real Soundcore records, how many carry machine-readable shipping
 * data good enough to compute a delivered cost? CJ's Shopping spec makes `shipping`
 * OPTIONAL, so the schema cannot answer this — only the advertiser's actual file can.
 *
 * NOT AN ADAPTER. No Product/Offer model, no ingestion, no wiring into services/catalog,
 * services/affiliate, apps/web or CI. It reads one file and prints aggregates.
 *
 * IT DOES NOT ASSUME THE HEADERS. The first thing it reports is the header row it actually
 * found. Logical fields are mapped only to columns that exist; anything absent is reported
 * as NOT PRESENT IN FEED rather than substituted by a similarly named column.
 *
 * RAW DATA. The feed is provider content, not repository content. Extraction goes to the OS
 * temp directory, never into the repo, and is deleted at the end. Only aggregates are written.
 *
 * Usage:
 *   node provider-access/research/cj-soundcore-feed-measurement.mjs <path-to.zip|.txt|.tsv>
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const input = process.argv[2];
if (!input) {
  console.error("usage: node cj-soundcore-feed-measurement.mjs <feed.zip|feed.txt>");
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error("input file not found: " + input);
  process.exit(2);
}

/* ---------- 1. obtain the delimited text, without ever writing into the repo ---------- */

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cjfeed-"));
let feedPath = input;
const cleanup = [];

if (/\.zip$/i.test(input)) {
  // Node has no built-in unzip. PowerShell's Expand-Archive ships with every supported Windows
  // build and avoids adding a dependency to a throwaway research tool.
  //
  // SAFETY: the paths are NOT interpolated into the -Command string. An earlier version built
  // `Expand-Archive -LiteralPath '<path>' ...` by substitution, which a single apostrophe in the
  // path terminates -- the remainder of the filename is then parsed as PowerShell code.
  // execFileSync does not help: it hands the string to powershell.exe unsplit and PowerShell
  // parses it itself, so argument-array quoting never applies to the contents of -Command.
  //
  // The command string below is therefore a CONSTANT, and both paths arrive out of band as
  // environment variables. `$env:X` is an expression that evaluates to a string VALUE; a bound
  // argument value is never re-parsed as code, so apostrophes, double quotes, spaces, `;`, `&`,
  // `|`, backticks, `$(...)` and a leading `-` are all inert. -LiteralPath additionally stops
  // `[`, `]`, `*` and `?` being read as wildcards.
  const PS_EXPAND =
    "Expand-Archive -LiteralPath $env:CJ_FEED_ZIP -DestinationPath $env:CJ_FEED_DEST -Force";
  execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", PS_EXPAND], {
    stdio: "pipe",
    env: { ...process.env, CJ_FEED_ZIP: path.resolve(input), CJ_FEED_DEST: tmpDir },
  });
  const found = fs.readdirSync(tmpDir).filter((f) => /\.(txt|tsv|csv)$/i.test(f));
  if (found.length === 0) {
    console.error("no delimited file inside the archive; contents: " + fs.readdirSync(tmpDir).join(", "));
    process.exit(3);
  }
  feedPath = path.join(tmpDir, found[0]);
  cleanup.push(tmpDir);
}

let text = fs.readFileSync(feedPath, "utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

/* ---------- 2. parse: TAB-delimited, quote-aware, CRLF/LF tolerant ---------- */

function parseDelimited(src, delim = "\t") {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === delim) { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    if (c === "\r") continue; // CRLF
    field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseDelimited(text);
if (rows.length === 0) { console.error("feed is empty"); process.exit(3); }

const headers = rows[0].map((h) => h.trim());
const body = rows.slice(1);

/* ---------- 3. map logical fields ONLY to columns that exist ---------- */

const idx = Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), i]));
const col = (...names) => {
  for (const n of names) if (n.toLowerCase() in idx) return { name: n, i: idx[n.toLowerCase()] };
  return null;
};

const MAP = {
  id: col("id", "offer_id", "sku"),
  gtin: col("gtin", "upc", "ean"),
  mpn: col("mpn"),
  brand: col("brand", "manufacturer"),
  title: col("title", "name"),
  item_group_id: col("item_group_id"),
  price: col("price"),
  sale_price: col("sale_price"),
  availability: col("availability"),
  condition: col("condition"),
  link: col("link", "product_url", "buy_url"),
  mobile_link: col("mobile_link"),
  // CJ's Shopping export does not emit a plain `shipping` column. It splits the attribute
  // into structured variants, so look for those too — a literal "shipping" lookup reports
  // NOT PRESENT and hides the real distinction: present-but-empty is not the same as absent.
  shipping: col(
    "shipping",
    "SHIPPING(COUNTRY:REGION:SERVICE:PRICE)",
    "SHIPPING(COUNTRY:POSTAL_CODE:SERVICE:PRICE)",
    "SHIPPING(COUNTRY:LOCATION_ID:SERVICE:PRICE)",
    "SHIPPING(COUNTRY:LOCATION_GROUP_NAME:SERVICE:PRICE)",
  ),
  shipping_price: col("SHIPPING(PRICE)"),
  shipping_country: col("SHIPPING(COUNTRY)"),
  shipping_label: col("shipping_label"),
  shipping_weight: col("shipping_weight"),
  image_link: col("image_link", "image_url"),
  expiration_date: col("expiration_date"),
  product_type: col("product_type", "google_product_category"),
};

const get = (r, key) => {
  const m = MAP[key];
  if (!m) return "";
  const v = r[m.i];
  return typeof v === "string" ? v.trim() : "";
};
const has = (r, key) => get(r, key) !== "";

/* ---------- 4. row quality ---------- */

const width = headers.length;
const malformed = body.filter((r) => r.length !== width && r.join("").trim() !== "");
const wellFormed = body.filter((r) => r.length === width);
const blankRows = body.length - malformed.length - wellFormed.length;

const noTitle = wellFormed.filter((r) => !has(r, "title"));
const noLink = wellFormed.filter((r) => !has(r, "link"));

const seen = new Set();
const dupes = [];
const valid = [];
for (const r of wellFormed) {
  if (!has(r, "title") || !has(r, "link")) continue; // excluded, counted above
  const k = MAP.id ? get(r, "id") : get(r, "link");
  if (seen.has(k)) { dupes.push(r); continue; }
  seen.add(k);
  valid.push(r);
}
const N = valid.length;

/* ---------- 5. shipping semantics, inspected rather than assumed ---------- */

/*
 * CJ's Shopping spec gives `shipping` nine sub-attributes (country required; region,
 * postal_code, service, price, handling/transit times optional). Encodings vary, so this
 * pulls a currency amount and a country token out of whatever shape arrives and records
 * distinct raw shapes for the report. Absence is MISSING — never zero: the published
 * method excludes an offer whose components are unknown rather than assuming them away.
 */
const MONEY = /(-?\d+(?:[.,]\d{1,2})?)\s*([A-Z]{3})?/;
const shapes = new Map();

function shippingInfo(r) {
  // The split columns are authoritative when present: a bare SHIPPING(PRICE) with
  // SHIPPING(COUNTRY)=US fixes the component just as well as the packed form.
  const splitPrice = get(r, "shipping_price");
  const splitCountry = get(r, "shipping_country");
  if (splitPrice !== "" && MONEY.test(splitPrice) && /\d/.test(splitPrice)) {
    return { cls: "L2_USABLE", us: /^(US|USA|United States)$/i.test(splitCountry), raw: "split" };
  }
  const raw = get(r, "shipping");
  if (!raw) {
    if (splitCountry !== "") return { cls: "PARTIAL", us: /^(US|USA)$/i.test(splitCountry), raw: "country-only" };
    return { cls: "MISSING", us: false, raw };
  }
  const shape = raw.replace(/\d+(?:[.,]\d+)?/g, "#").slice(0, 60);
  shapes.set(shape, (shapes.get(shape) ?? 0) + 1);

  const entries = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  let us = false;
  let priceKnown = false;
  for (const e of entries) {
    const parts = e.split(":").map((s) => s.trim());
    const isUS = parts.some((p) => /^(US|USA|United States)$/i.test(p));
    const moneyPart = parts.find((p) => MONEY.test(p) && /\d/.test(p));
    if (isUS) us = true;
    if (moneyPart && (isUS || entries.length === 1)) priceKnown = true;
  }
  if (priceKnown) return { cls: "L2_USABLE", us, raw };
  return { cls: "PARTIAL", us, raw };
}

const priceOk = (r) => {
  const v = get(r, "price");
  return v !== "" && MONEY.test(v) && /\d/.test(v);
};
const salePriceOk = (r) => {
  const v = get(r, "sale_price");
  return v !== "" && MONEY.test(v) && /\d/.test(v);
};
const num = (s) => { const m = String(s).match(MONEY); return m ? parseFloat(m[1].replace(",", ".")) : NaN; };

const strongIdentity = (r) => has(r, "gtin") || (has(r, "brand") && has(r, "mpn"));

/* ---------- 6. category grouping, from feed evidence only ---------- */

function category(r) {
  const t = (get(r, "title") + " " + get(r, "product_type")).toLowerCase();
  if (/\bearbud|\bear buds|true[- ]wireless|\btws\b|in-ear/.test(t)) return "earbuds";
  if (/headphone|over-ear|on-ear|headset/.test(t)) return "headphones";
  if (/speaker|soundbar|boombox/.test(t)) return "speakers";
  if (/case|cable|charger|adapter|tip|strap|mount|stand/.test(t)) return "accessories";
  return "other";
}

/* ---------- 7. aggregate ---------- */

const pct = (n, d) => (d === 0 ? "n/a" : `${((n / d) * 100).toFixed(1)}% (${n}/${d})`);
const ship = valid.map(shippingInfo);

const agg = {
  gtin: valid.filter((r) => has(r, "gtin")).length,
  mpn: valid.filter((r) => has(r, "mpn")).length,
  brand: valid.filter((r) => has(r, "brand")).length,
  gtinBrand: valid.filter((r) => has(r, "gtin") && has(r, "brand")).length,
  brandMpn: valid.filter((r) => has(r, "brand") && has(r, "mpn")).length,
  strong: valid.filter(strongIdentity).length,
  price: valid.filter(priceOk).length,
  salePrice: valid.filter(salePriceOk).length,
  saleLower: valid.filter((r) => salePriceOk(r) && priceOk(r) && num(get(r, "sale_price")) < num(get(r, "price"))).length,
  availability: valid.filter((r) => has(r, "availability")).length,
  condition: valid.filter((r) => has(r, "condition")).length,
  link: valid.filter((r) => has(r, "link")).length,
  image: valid.filter((r) => has(r, "image_link")).length,
  itemGroup: valid.filter((r) => has(r, "item_group_id")).length,
  shipPop: valid.filter((r) => has(r, "shipping")).length,
  l2: ship.filter((s) => s.cls === "L2_USABLE").length,
  partial: ship.filter((s) => s.cls === "PARTIAL").length,
  missing: ship.filter((s) => s.cls === "MISSING").length,
  usRecords: ship.filter((s) => s.us).length,
  usL2: ship.filter((s) => s.us && s.cls === "L2_USABLE").length,
};
agg.priceUsL2 = valid.filter((r, i) => priceOk(r) && ship[i].us && ship[i].cls === "L2_USABLE").length;

/* link structure */
const linkSamples = valid.slice(0, 200).map((r) => get(r, "link"));
const cjHosts = /dpbolvw|anrdoezrs|tkqlhce|jdoqocy|kqzyfj|emjcd|ftjcfx|awltovhc|lduhtrp|tqlkg|yceml|\.cj\.com/i;
const nCj = linkSamples.filter((u) => cjHosts.test(u)).length;
const nDirect = linkSamples.filter((u) => /soundcore\.com|anker\.com/i.test(u)).length;
const LINK_TYPE = nCj > 0 && nDirect > 0 ? "MIXED" : nCj > 0 ? "CJ_TRACKING" : nDirect > 0 ? "DIRECT" : "UNKNOWN";

/* ---------- 8. report (aggregates only) ---------- */

const L = [];
const w = (s = "") => L.push(s);
w("# Soundcore CJ product feed — real field population");
w();
w(`Run ${new Date().toISOString()} · **NON-PRODUCTION** · aggregates only, no product records retained.`);
w();
w("## A. Actual feed schema");
w();
w(`**ACTUAL_HEADERS_FOUND (${headers.length}):**`);
w();
w("```");
w(headers.join("\n"));
w("```");
w();
w("**Logical mapping (only columns that exist):**");
w();
w("| logical field | feed column |");
w("|---|---|");
for (const [k, v] of Object.entries(MAP)) w(`| ${k} | ${v ? "`" + v.name + "`" : "**NOT PRESENT IN FEED**"} |`);
w();
w("## B. Dataset quality");
w();
w(`| metric | value |`);
w(`|---|---|`);
w(`| total data rows | ${body.length} |`);
w(`| well-formed rows | ${wellFormed.length} |`);
w(`| malformed (column count ≠ header) | ${malformed.length} |`);
w(`| blank rows | ${blankRows} |`);
w(`| excluded — missing title | ${noTitle.length} |`);
w(`| excluded — missing link | ${noLink.length} |`);
w(`| duplicates dropped | ${dupes.length} |`);
w(`| **VALID_UNIQUE_PRODUCT_ROWS (denominator)** | **${N}** |`);
w();
w("## C. Identity");
w();
w(`| measure | population |`);
w(`|---|---|`);
w(`| GTIN | ${pct(agg.gtin, N)} |`);
w(`| MPN | ${pct(agg.mpn, N)} |`);
w(`| Brand | ${pct(agg.brand, N)} |`);
w(`| GTIN + Brand | ${pct(agg.gtinBrand, N)} |`);
w(`| Brand + MPN | ${pct(agg.brandMpn, N)} |`);
w(`| **STRONG_IDENTITY** (GTIN or Brand+MPN) | **${pct(agg.strong, N)}** |`);
w();
w("## D. Price / availability / media");
w();
w(`| field | population |`);
w(`|---|---|`);
w(`| price (parsed as money) | ${pct(agg.price, N)} |`);
w(`| sale_price populated | ${pct(agg.salePrice, N)} |`);
w(`| sale_price < price | ${pct(agg.saleLower, N)} |`);
w(`| availability | ${pct(agg.availability, N)} |`);
w(`| condition | ${pct(agg.condition, N)} |`);
w(`| link | ${pct(agg.link, N)} |`);
w(`| image_link | ${pct(agg.image, N)} |`);
w(`| item_group_id | ${pct(agg.itemGroup, N)} |`);
w();
w("## E. Shipping — the hard gate");
w();
w(`| measure | value |`);
w(`|---|---|`);
w(`| SHIPPING_FIELD_POPULATED | ${pct(agg.shipPop, N)} |`);
w(`| **L2_USABLE_SHIPPING** | **${pct(agg.l2, N)}** |`);
w(`| PARTIAL_SHIPPING | ${pct(agg.partial, N)} |`);
w(`| MISSING_SHIPPING | ${pct(agg.missing, N)} |`);
w(`| records naming US | ${pct(agg.usRecords, N)} |`);
w(`| **US_L2_USABLE** | **${pct(agg.usL2, N)}** |`);
w();
if (shapes.size) {
  w("**Distinct raw `shipping` shapes observed** (digits replaced with `#`, so no product data is reproduced):");
  w();
  w("| shape | count |");
  w("|---|---|");
  [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([s, c]) => w(`| \`${s}\` | ${c} |`));
} else {
  w("No `shipping` values present at all — nothing to characterise.");
}
w();
w("## F. Delivered-cost readiness");
w();
w(`- **PRICE_PLUS_US_L2_SHIPPING: ${pct(agg.priceUsL2, N)}**`);
w(`- **MANDATORY_FEES: ${MAP.shipping_label || MAP.shipping_weight ? "NOT AVAILABLE" : "NOT AVAILABLE"}** — the Shopping feed`);
w(`  has no unavoidable-fee column, so \`price + shipping\` is **not** a verified checkout total.`);
w();
w("## G. Category breakdown (from feed evidence only)");
w();
w("| category | N | strong identity | price | availability | US L2 shipping |");
w("|---|---|---|---|---|---|");
for (const c of ["headphones", "earbuds", "speakers", "accessories", "other"]) {
  const rowsC = valid.filter((r) => category(r) === c);
  const shipC = rowsC.map(shippingInfo);
  const n = rowsC.length;
  if (n === 0) { w(`| ${c} | 0 | n/a | n/a | n/a | n/a |`); continue; }
  w(`| ${c} | ${n} | ${pct(rowsC.filter(strongIdentity).length, n)} | ${pct(rowsC.filter(priceOk).length, n)} | ${pct(rowsC.filter((r) => has(r, "availability")).length, n)} | ${pct(shipC.filter((s) => s.us && s.cls === "L2_USABLE").length, n)} |`);
}
w();
w("## H. Link structure");
w();
w(`- **LINK_TYPE = ${LINK_TYPE}** (sampled ${linkSamples.length} links, structural inspection only — none followed)`);
w(`- CJ tracking hosts seen: ${nCj} · direct soundcore/anker hosts seen: ${nDirect}`);
w(`- mobile_link column: ${MAP.mobile_link ? "present" : "NOT PRESENT IN FEED"}`);
w();
w("## I. Gates (HonestTotal internal thresholds, not CJ or Soundcore requirements)");
w();
const g = (label, n) => w(`- ${label}: **${N > 0 && n / N >= 0.9 ? "PASS" : "FAIL"}** — ${pct(n, N)}`);
g("STRONG_IDENTITY >= 90%", agg.strong);
g("VALID PRICE >= 90%", agg.price);
g("AVAILABILITY >= 90%", agg.availability);
g("US_L2_SHIPPING >= 90%", agg.usL2);
g("PRICE + US L2 SHIPPING >= 90%", agg.priceUsL2);
w();
w("> Technical data fitness only. This authorises no production activation, no affiliate link,");
w("> and no change to the merchant registry.");

fs.mkdirSync("provider-access/research", { recursive: true });
fs.writeFileSync("provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md", L.join("\n"), "utf8");

/* ---------- 9. delete extracted provider data ---------- */
for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true });

console.log("wrote provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md");
console.log(`headers=${headers.length} · valid unique rows=${N}`);
console.log(`strong identity ${pct(agg.strong, N)} · price ${pct(agg.price, N)} · US L2 shipping ${pct(agg.usL2, N)}`);
console.log("extracted feed files deleted; no product records retained.");
