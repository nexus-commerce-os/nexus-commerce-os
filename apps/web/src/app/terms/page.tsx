import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, PLACEHOLDERS as P } from '../legal/legal';

export const metadata: Metadata = {
  title: 'Terms — HonestTotal',
  description:
    'The terms covering this HonestTotal website and its waitlist. No product, purchase or saving is being offered yet.',
};

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="13 November 2026">
      <p>
        These terms cover <strong>this website and its waitlist</strong>, operated by {P.operator},{' '}
        {P.address}. They are short because the site does very little: it describes a product that
        is not open yet, and it lets you ask to be told when it is.
      </p>

      <h2>No product is being offered yet</h2>
      <p>
        HonestTotal is not open. Nothing on this site is an offer to sell, a price quote, or a
        promise that any particular saving is available to you. Joining the waitlist buys you
        nothing, commits you to nothing, and costs nothing.
      </p>

      <h2>Every figure on this site is an example</h2>
      <p>
        The receipt, the savings total and the merchant prices on the home page are{' '}
        <strong>illustrative examples, not verified live offers</strong>. They were written to show
        how the product is meant to work. They are not real prices, not real merchants, and not a
        saving anybody achieved. When HonestTotal does open, a saving will only be presented as
        verified once it has actually been confirmed — which is the entire point of the product, and
        the reason we will not fake it on the way there.
      </p>

      <h2>What we will and will not do with your address</h2>
      <p>
        We will email you when HonestTotal opens in your region, and about the launch. We will not
        sell, rent or share your address, and we will not pass it to merchants or affiliate
        networks. The <a href="/privacy">Privacy Notice</a> is the detail, and it governs if the two
        ever disagree.
      </p>

      <h2>The site is provided as it is</h2>
      <p>
        We try to keep this site accurate and available, but we do not guarantee either. We may
        change, pause or withdraw it, and we may decide not to launch at all — in which case we will
        delete the waitlist and tell you so.
      </p>

      <h2>Limits</h2>
      <p>
        Nothing here limits any right you have that cannot be limited by law, including your
        statutory rights as a consumer. Subject to that, our liability for this pre-launch website
        is limited to what the law requires of us.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Please do not attack the site, submit addresses that are not yours, or automate sign-ups. We
        rate-limit and filter the form, and we may block abuse.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of {P.jurisdiction}, and its courts have jurisdiction.
        Questions: {P.contact}.
      </p>
    </LegalPage>
  );
}
