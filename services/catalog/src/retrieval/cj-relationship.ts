/*
 * IS THIS ADVERTISER ACTUALLY JOINED?
 *
 * The repository has carried an unresolved contradiction for months: it
 * records the CJ application as PENDING, while a later note claims approval.
 * Both cannot be current, and nothing has been published on the strength of
 * either — correctly, because publishing a merchant's offers is the one
 * decision this project cannot take back.
 *
 * A RECURRING FEED DELIVERY IS NOT THE ANSWER. CJ keeps sending a
 * subscription that was created while a relationship existed; an export
 * landing in a mailbox says a subscription exists, not that the relationship
 * is current, and certainly not that it is in good standing. Treating
 * delivery as proof is how an unauthorised offer reaches the public.
 *
 * CJ's Advertiser Lookup API answers the actual question. Quoting its
 * documentation: "This API displays advertiser account status so publishers
 * can determine whether their joined advertisers' programs are in good
 * standing with CJ (active), or temporarily deactivated." Two independent
 * facts come back and BOTH are required here:
 *
 *   · relationship-status — joined, or not;
 *   · account-status      — the program is active, or it is not.
 *
 * Documented limit: 25 calls per minute, publishers only.
 */

/** The documented endpoint. */
export const CJ_ADVERTISER_LOOKUP_URL = 'https://advertiser-lookup.api.cj.com/v2/advertiser-lookup';

export interface CjAdvertiser {
  readonly advertiserId: string;
  readonly advertiserName: string | null;
  /** As CJ spells it, lowercased. `joined` is the only one that authorises. */
  readonly relationshipStatus: string | null;
  /** As CJ spells it, lowercased. `active` is the only one in good standing. */
  readonly accountStatus: string | null;
  readonly programUrl: string | null;
}

export type RelationshipVerdict =
  | {
      readonly ok: true;
      readonly advertiser: CjAdvertiser;
      readonly checkedAt: string;
      /** What to record against the merchant row, in words a human reads. */
      readonly evidence: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly advertiser: CjAdvertiser | null;
      readonly checkedAt: string;
    };

export interface VerifyOptions {
  /** The resolved personal access token. */
  readonly token: string;
  /** The PUBLISHER's CJ company id. */
  readonly requestorCid: string;
  /** The advertiser's CID to check. */
  readonly advertiserId: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

/**
 * Asks CJ, and believes only an unambiguous yes.
 *
 * Every failure mode — a bad token, a network error, an advertiser that is
 * not in the response, a status CJ spells in a way this code does not
 * recognise — is `ok: false`. An unreadable answer is not a yes, and the
 * caller must treat it the same as a no.
 */
export async function verifyAdvertiserRelationship(
  options: VerifyOptions,
): Promise<RelationshipVerdict> {
  const now = options.now ?? (() => new Date());
  const checkedAt = now().toISOString();
  const doFetch = options.fetchImpl ?? fetch;

  if (options.token.trim() === '') {
    return {
      ok: false,
      reason: 'no personal access token was provided',
      advertiser: null,
      checkedAt,
    };
  }

  const url = new URL(CJ_ADVERTISER_LOOKUP_URL);
  url.searchParams.set('requestor-cid', options.requestorCid);
  url.searchParams.set('advertiser-ids', options.advertiserId);

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  try {
    response = await doFetch(url.toString(), {
      headers: { authorization: `Bearer ${options.token}`, accept: 'application/xml' },
      signal: controller.signal,
      // `manual`, not `error`: Workers does not implement `error` and throws
      // before sending. A redirect is still refused below rather than
      // followed — this request carries a bearer token.
      redirect: 'manual',
    });
  } catch (error) {
    return {
      ok: false,
      reason: `the lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      advertiser: null,
      checkedAt,
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    return {
      ok: false,
      reason: `CJ redirected the advertiser lookup (${response.status}); a token is never followed elsewhere`,
      advertiser: null,
      checkedAt,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      reason: `CJ answered ${response.status} to the advertiser lookup`,
      advertiser: null,
      checkedAt,
    };
  }

  const advertiser = firstAdvertiser(await response.text(), options.advertiserId);
  if (advertiser === null) {
    return {
      ok: false,
      reason: `advertiser ${options.advertiserId} was not in the lookup response`,
      advertiser: null,
      checkedAt,
    };
  }

  if (advertiser.relationshipStatus !== 'joined') {
    return {
      ok: false,
      reason: `relationship-status is "${advertiser.relationshipStatus ?? 'absent'}", not "joined"`,
      advertiser,
      checkedAt,
    };
  }
  if (advertiser.accountStatus !== 'active') {
    return {
      ok: false,
      reason: `account-status is "${advertiser.accountStatus ?? 'absent'}", not "active"`,
      advertiser,
      checkedAt,
    };
  }

  return {
    ok: true,
    advertiser,
    checkedAt,
    evidence:
      `CJ Advertiser Lookup ${checkedAt}: advertiser ${advertiser.advertiserId} ` +
      `(${advertiser.advertiserName ?? 'unnamed'}) relationship-status=joined account-status=active`,
  };
}

/*
 * A DELIBERATELY SMALL XML READER.
 *
 * The response is a flat, CJ-defined document and the four values wanted from
 * it are leaf text nodes. Adding an XML parser to this package for that would
 * be a dependency, a bundle size and a parser-differential surface on a
 * response that is already authenticated — for four fields.
 *
 * What this does NOT do is anything a general parser would: no entity
 * expansion, no external entities, no namespaces, no attributes. Each regex
 * is anchored to one tag and takes the first match, and anything it cannot
 * read becomes null, which the caller treats as a refusal.
 */
function firstAdvertiser(xml: string, wanted: string): CjAdvertiser | null {
  for (const block of xml.split(/<advertiser>/i).slice(1)) {
    const advertiserId = tag(block, 'advertiser-id');
    if (advertiserId === null) continue;
    if (advertiserId !== wanted) continue;
    return {
      advertiserId,
      advertiserName: tag(block, 'advertiser-name'),
      relationshipStatus: lower(tag(block, 'relationship-status')),
      accountStatus: lower(tag(block, 'account-status')),
      programUrl: tag(block, 'program-url'),
    };
  }
  return null;
}

function tag(block: string, name: string): string | null {
  // Bounded: `[^<]*` cannot cross into the next tag, so this cannot run away
  // on a long document the way a lazy `.*?` between two tags can.
  const match = new RegExp(`<${name}>([^<]*)</${name}>`, 'i').exec(block);
  return match === null ? null : match[1].trim();
}

function lower(value: string | null): string | null {
  return value === null ? null : value.toLowerCase();
}
