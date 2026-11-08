// Preview-only Worker entrypoint. NOT used by production.
//
// Production deploys `worker/index.ts` via wrangler.toml. This file is named
// only by wrangler.preview.toml, wraps that same handler, and adds one thing:
// `X-Robots-Tag: noindex, nofollow` on EVERY response.
//
// WHY A WRAPPER AND NOT A FLAG INSIDE index.ts. An environment check in the
// production entrypoint would put preview logic on the path that serves
// honesttotal.com, where a mistake in the condition is a production incident.
// A separate file cannot misfire in production because production never loads
// it. The production handler is imported unchanged, so the preview exercises
// the real routing rather than a parallel copy that can drift.
//
// WHY A HEADER AND NOT robots.txt. The preview serves the whole site — the
// homepage, seventeen editorial guides, the policy pages. Those are indexable
// by design in production, and a workers.dev copy of them is a duplicate of
// honesttotal.com competing with it. robots.txt asks a crawler not to fetch a
// URL; it does not stop one that already knows the URL from indexing it, and
// it is advisory. `X-Robots-Tag` is a directive on the response itself and
// applies to every status code and content type, including the XML of
// sitemap.xml and the 404 page, neither of which carries a `<meta>` tag.
//
// THIS MODULE EXPORTS ONLY `default`, deliberately. The Workers runtime reads
// every named export of an entry module as a Worker entrypoint and refuses to
// start if one is not a handler, so the header constant and the response
// helper live in ./noindex.ts instead. See that file for the error this cost.

import { withNoindex } from './noindex';
import worker, { type Env as ProductionEnv } from './index';

/**
 * The preview has no KV namespace — see wrangler.preview.toml for why. The
 * binding is therefore optional here, and the waitlist route is answered
 * before anything could read it.
 */
type PreviewEnv = Omit<ProductionEnv, 'WAITLIST'> & Partial<ProductionEnv>;

export default {
  async fetch(request: Request, env: PreviewEnv): Promise<Response> {
    const { pathname } = new URL(request.url);

    /*
     * Answered here rather than being allowed through. Without the KV binding
     * the production handler would reach `env.WAITLIST.get(...)`, throw, and
     * return its generic "Could not save right now — please try again."
     * That sentence invites a retry that cannot succeed and implies the
     * address might land somewhere. A preview collects nobody's email, and it
     * should say so.
     */
    if (pathname === '/api/waitlist') {
      return withNoindex(
        new Response(
          JSON.stringify({
            ok: false,
            error: 'This is an internal preview build. It does not accept sign-ups.',
          }),
          { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
        ),
      );
    }

    return withNoindex(await worker.fetch(request, env as ProductionEnv));
  },
};
