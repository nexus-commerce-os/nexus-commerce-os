import React from 'react';
import type { Metadata } from 'next';
import { LegalPage, PLACEHOLDERS as P } from '../legal/legal';

export const metadata: Metadata = {
  title: 'Privacy Notice — HonestTotal',
  description:
    'What HonestTotal collects when you join the waitlist, why, where it is stored, and how to have it deleted.',
};

export default function PrivacyNotice() {
  return (
    <LegalPage title="Privacy Notice" updated="13 November 2026">
      <p>
        This notice covers the HonestTotal website as it exists today: a single page describing the
        product, and a waitlist form. There is nothing else here yet — no accounts, no shopping, no
        payments.
      </p>

      <h2>Who is responsible</h2>
      <p>
        The controller of your data is {P.operator}, {P.address}. For any question about this
        notice, or to exercise any right below, write to {P.contact}.
      </p>

      <h2>What we collect, and nothing more</h2>
      <p>
        <strong>Your email address</strong>, and only because you typed it into the waitlist form.
        With it we store the word <code>web</code> to record that it came from this site, and the
        time you submitted it.
      </p>
      <p>We do not collect, and this site does not contain:</p>
      <ul>
        <li>no analytics, no pixels, no advertising or tracking scripts</li>
        <li>
          no cookies at all — which is why you were not asked to accept any. If that changes, you
          will be asked before anything is set.
        </li>
        <li>no name, no address, no payment details, no browsing or purchase history</li>
      </ul>

      <h2>Why we are allowed to hold it</h2>
      <p>
        Your consent, given by submitting the form. You can withdraw it at any time (see below), and
        withdrawing it costs you nothing because the address is used for one purpose only.
      </p>

      <h2>What we use it for</h2>
      <p>
        To send you <strong>one email when HonestTotal opens in your region</strong>, plus the
        occasional message about the launch itself. We do not send marketing for anything else. We
        never sell, rent or share your address, and we do not pass it to merchants or affiliate
        networks.
      </p>

      <h2>Where it is stored</h2>
      <p>
        With our email provider, {P.esp}, on infrastructure in {P.espCountry}. They process it on
        our instructions only. The website itself is served by Vercel, which handles the request but
        does not retain your address.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Until you ask us to delete it, or until twenty-four months after launch — whichever comes
        first. If the product never launches, we delete the list and tell you we have.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask us to show you what we hold, correct it, delete it, or hand it back in a
        portable form, and you can withdraw consent at any time. Every launch email carries a
        one-click unsubscribe, which also deletes the address. Or write to {P.contact} and we will
        act within 30 days.
      </p>
      <p>
        If you are in the UK or the EU and think we have handled your data badly, you may complain
        to your national data protection authority. We would rather you told us first at {P.contact}
        .
      </p>

      <h2>Children</h2>
      <p>
        HonestTotal is not for under-16s and we do not knowingly collect their data. If you believe
        we hold a child&apos;s address, tell us at {P.contact} and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If this notice changes in a way that affects you, we will say so in an email before the
        change takes effect rather than quietly updating this page.
      </p>
    </LegalPage>
  );
}
