# Soundcore — draft request: product image usage

**Status:** DRAFT · **NOT SENT** · prepared 3 November 2026
**Recipient:** `affiliate@anker.com` (Soundcore Affiliate Team, per the CJ advertiser record)
**Authorisation to send:** NOT GIVEN. Do not send this without the founder saying so.

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
> 1. Whether displaying feed product images on our pages is permitted.
> 2. Whether hot-linking the supplied image URLs is acceptable, or whether you would
>    prefer we copy the images to our own hosting.
> 3. Whether any attribution or caption wording is required alongside them.
> 4. Whether there is a caching or refresh expectation for feed data and images.
>
> I ask because the program terms cover SEM, URLs, coupons and brand representation but do
> not mention product images, and I would rather confirm than assume.
>
> One related note: the "Use of Logos and Trademarks in Web sites" field in the program
> terms appears to contain the prohibited-content text rather than a logo policy. We are
> using no Soundcore or Anker logos and will continue not to until there is a written
> policy, but you may want to correct the field.
>
> For completeness: we publish no coupons, run no paid search, operate no social accounts
> and use no sub-affiliates. No affiliate link to Soundcore is live today.
>
> Thank you,
> Md Samsuzzaman — HonestTotal

## What a reply changes

| Reply | Consequence |
| --- | --- |
| Images permitted, hot-linking fine | Blocker B2 clears; record the reply here with its date |
| Images permitted, self-host required | Blocker B2 clears after images are copied to our own storage — a separate increment |
| Attribution required | Add the required wording to the card before any publication |
| No reply within a reasonable window | B2 stays **UNKNOWN**. Silence is not permission, and the catalogue stays unpublished or ships without images |
