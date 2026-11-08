# Soundcore — draft request: product image usage

**Status:** **SENT** — 6 November 2026, 8:11 PM (Asia/Dhaka), from `samsuzzaman@gmail.com`
**Recipient:** `affiliate@anker.com` (Soundcore Affiliate Team, per the CJ advertiser record)
**Authorisation:** given by the founder in chat, 6 November 2026, after reviewing the wording and recipient.
**Awaiting reply.** Until one arrives, image display and hot-linking remain **UNKNOWN** and nothing
using those images may be published. Record the reply here, with its date, the moment it lands.

> Two cosmetic differences between the text below and what was sent: the questions were numbered
> `(1)`–`(5)` rather than `1.`–`5.`, because Gmail's editor turns `1. ` at the start of a line into
> an auto-numbered list and renumbers everything after it; and the signature dash is a hyphen. No
> wording changed.

## Why this exists

The CJ program terms for Soundcore (advertiser `7382109`) were read on 10 August 2026 and
re-read on 6 September 2026. They cover SEM, domains, URLs, prohibited content, social
media, coupons, incentivised traffic, email, sub-affiliates and brand representation.

**They say nothing about product images.** They also say nothing usable about logos — the
"Web Site — Use of Logos and Trademarks in Web sites" field repeats the prohibited-content
sentence instead of stating a policy, which looks like an error in the advertiser's own terms.

Silence is not permission. The product catalogue renders the `IMAGE_LINK` values from the
authorized feed, which means hot-linking the merchant's own CDN (`cdn.shopify.com`) and
serving their bandwidth on our pages. That is a normal affiliate pattern and it is probably
intended — the images are in the feed for a reason — but "probably intended" is not a
permission, and this project does not treat a gap in a contract as a grant.

## Draft

> **Subject:** Product image usage in an affiliate catalogue — HonestTotal (CJ publisher 7720576)
>
> Hello,
>
> I run HonestTotal (honesttotal.com), an approved publisher in your CJ program
> (advertiser 7382109, publisher CID 8038031). I am building a product catalogue from
> the Shopping-format product feed and want to confirm one point before anything is
> published.
>
> **May I display the product images referenced by the `IMAGE_LINK` field of the feed, and
> may those images be loaded directly from the URLs the feed supplies?**
>
> Specifically I would like to know:
>
> 1. **Display.** May we show the product images referenced by the feed's `IMAGE_LINK`
>    field on our pages?
> 2. **Hotlinking vs self-hosting.** May those images be loaded directly from the URLs the
>    feed supplies, or would you prefer we copy them to our own hosting?
> 3. **Attribution.** Is any credit line or caption wording required alongside them?
> 4. **Caching and refresh.** How current must the feed data be? We currently refuse to
>    publish a build from a feed more than 48 hours old, and would like to know whether
>    that meets your expectation or whether a different window applies — to the images as
>    well as to prices and availability.
> 5. **Logos and trademarks.** What are the restrictions on the Soundcore and Anker word
>    marks and logos? We use product names in text to identify what we are listing, and no
>    logos at all. The "Use of Logos and Trademarks in Web sites" field in the program
>    terms appears to contain the prohibited-content paragraph rather than a logo policy,
>    so we have no written rule to follow and have assumed logos are not permitted.
>
> I ask because the program terms cover SEM, URLs, coupons and brand representation but do
> not mention product images at all, and we would rather confirm than assume.
>
> For completeness, so you can see what we are and are not doing: no affiliate link to
> Soundcore is live, we have never sent you a click, we publish no coupons, run no paid
> search, operate no social accounts and use no sub-affiliates. No page URL contains your
> brand name. Our listings show the item price only and state plainly that we have not
> verified delivery cost, because the feed does not carry one.
>
> Thank you,
> Md Samsuzzaman — HonestTotal

## What a reply changes

| Reply | Consequence |
| --- | --- |
| Images permitted, hot-linking fine | Blocker B2 clears; record the reply here with its date |
| Images permitted, self-host required | Blocker B2 clears after images are copied to our own storage — a separate increment |
| Attribution required | Add the required wording to the card before any publication |
| Caching window stated | Compare it against the 48-hour release guard in `@nexus/catalog`; adopt theirs if it is stricter |
| Logo policy stated | Record it here; until then no Soundcore or Anker mark is used anywhere |
| No reply within a reasonable window | B2 stays **UNKNOWN**. Silence is not permission, and the catalogue stays unpublished or ships without images |
