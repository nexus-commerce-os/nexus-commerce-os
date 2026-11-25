'use client';

import { useEffect } from 'react';

/**
 * Gives the header a working menu on a phone.
 *
 * `.nav-links` is hidden below 820px and there has never been anything to
 * replace it, so on a phone the header has been a logo, a theme toggle and a
 * call to action — no navigation at all. Nothing was strictly unreachable,
 * because the footer carries every link, but "scroll to the bottom of the
 * page" is not navigation.
 *
 * WHY THIS ENHANCES THE EXISTING HEADER instead of being a <SiteHeader>
 * component. The header markup is duplicated across 25 pages. Replacing all 25
 * is the right refactor and it is a separate change; adding a menu button to
 * each of them by hand is how 24 of them end up with it. This follows the
 * precedent already set by the skip link in `layout.tsx`, which lives in the
 * one <body> for exactly the same reason.
 *
 * The button is created here rather than written in markup because it must
 * appear inside each page's own `.nav-in`, which this component does not own.
 * Everything it adds is inert without JavaScript, and without JavaScript the
 * footer navigation is unchanged — so this removes nothing and adds a menu
 * wherever scripts run.
 *
 * Accessibility, deliberately and not by accident:
 *   - a real <button> with `aria-expanded` and `aria-controls` pointing at the
 *     list it opens, which is the disclosure pattern screen readers announce;
 *   - Escape closes it and returns focus to the button, because a menu that
 *     traps focus on a phone is worse than no menu;
 *   - following a link closes it, so the next page does not open mid-menu;
 *   - it closes itself if the viewport grows past the breakpoint, otherwise a
 *     rotation leaves an open panel over a header that no longer has a button;
 *   - 44px minimum target (WCAG 2.5.8 asks 24; 44 is the comfortable size).
 */
export function MobileNav() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('header.nav');
    const bar = header?.querySelector<HTMLElement>('.nav-in');
    const links = bar?.querySelector<HTMLElement>('.nav-links');
    if (!header || !bar || !links) return;

    // The panel needs an id for aria-controls; reuse one if the page set it.
    if (!links.id) links.id = 'site-nav-links';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', links.id);
    button.setAttribute('aria-label', 'Open menu');
    // Two bars, drawn in CSS. aria-hidden because the label above says it all.
    button.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span>';

    // Before the call to action, so the tab order reads
    // brand → menu → theme → waitlist, matching left-to-right.
    const cta = bar.querySelector('.btn-primary');
    if (cta) bar.insertBefore(button, cta);
    else bar.appendChild(button);

    const setOpen = (open: boolean) => {
      header.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };

    const onButtonClick = () => {
      setOpen(button.getAttribute('aria-expanded') !== 'true');
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (button.getAttribute('aria-expanded') !== 'true') return;
      setOpen(false);
      button.focus();
    };

    const onLinkClick = (event: Event) => {
      if ((event.target as HTMLElement).closest('a')) setOpen(false);
    };

    // `matchMedia` rather than a resize listener: it fires on the crossing
    // only, not on every pixel of a drag.
    const wide = window.matchMedia('(min-width: 821px)');
    const onWiden = () => {
      if (wide.matches) setOpen(false);
    };

    button.addEventListener('click', onButtonClick);
    document.addEventListener('keydown', onKeyDown);
    links.addEventListener('click', onLinkClick);
    wide.addEventListener('change', onWiden);

    return () => {
      button.removeEventListener('click', onButtonClick);
      document.removeEventListener('keydown', onKeyDown);
      links.removeEventListener('click', onLinkClick);
      wide.removeEventListener('change', onWiden);
      header.classList.remove('nav-open');
      button.remove();
    };
  }, []);

  return null;
}
