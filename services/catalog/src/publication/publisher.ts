/*
 * THE PUBLISHER.
 *
 * `applyRun` is not atomic on D1 — measured, not assumed, and written down in
 * docs/engineering/d1-database.md. An interrupted import leaves its committed
 * writes behind. That is survivable only because nothing public reads the
 * import tables, and this file is the reason that holds: it is the one place
 * where a computed catalogue becomes a visible one, and it does so by moving a
 * single row.
 *
 * ──────────────────────────── THE COMMIT ────────────────────────────
 *
 * The expensive half of publication — opening and closing interval rows — is
 * DELIBERATELY OUTSIDE the atomic unit, and that is safe for a reason worth
 * stating precisely:
 *
 *   · a row opened at generation N has first_generation = N, and a reader at
 *     live generation L < N requires first_generation <= L. Invisible.
 *
 *   · a row closed for generation N has last_generation = L, and a reader at
 *     L requires last_generation >= L. STILL VISIBLE.
 *
 * So neither phase changes what the public sees. Both can be interrupted,
 * resumed, or run twice. What must be atomic is only {mark live, supersede the
 * previous, move the pointer} — three statements, which always fit in one
 * batch no matter how large the catalogue is.
 *
 * That is the whole design: an unbounded amount of work made safe by a bounded
 * commit.
 *
 * ──────────────────────────── IDEMPOTENCE ────────────────────────────
 *
 * Every statement here can run twice. Closes are UPDATEs to a value they
 * already hold; opens are INSERT OR IGNORE on (product_id, first_generation);
 * the pointer move is guarded by the generation it expects to replace, so the
 * second attempt finds the pointer already moved and reports `alreadyLive`
 * rather than writing anything.
 */
import type { D1Like, D1PreparedStatement } from '../store/d1/d1-client';
import { exactInteger, fromInt, toInt } from '../store/d1/d1-client';
import {
  ConcurrentPublicationError,
  DEFAULT_PUBLICATION_LIMITS,
  GenerationRejectedError,
  PointerMovedError,
  type Generation,
  type GenerationStatus,
  type PublicationCandidate,
  type PublishOutcome,
  type ValidationLimits,
  validateGeneration,
} from './generation';

/** Statements per batch. Far below any plausible limit, and bounded on purpose. */
const BATCH = 40;

/** Columns bound per candidate row; decides how many rows fit one statement. */
const CANDIDATE_COLUMNS = 13;
/** Columns bound per opened published row. */
const PUBLISHED_COLUMNS = 12;

export interface PruneOptions {
  /** Generations to keep behind the live one. Below 1 would delete rollback. */
  readonly keep: number;
  /**
   * The most rows one call may delete. Cleanup that could consume the daily
   * write budget is not cleanup.
   */
  readonly maxDeletes: number;
}

export interface PruneOutcome {
  readonly oldestKept: number | null;
  readonly candidatesDeleted: number;
  readonly publishedDeleted: number;
  readonly generationsDeleted: number;
  /** True when the cap stopped the work before it finished. */
  readonly truncated: boolean;
}

export class GenerationPublisher {
  constructor(private readonly db: D1Like) {}

  /* ───────────────────────────── reading ───────────────────────────── */

  /** The generation the public is currently served, or null if nothing is. */
  async liveGeneration(): Promise<number | null> {
    const row = await this.db
      .prepare('SELECT live_generation FROM catalog_publication_pointer WHERE id = 1')
      .first<{ live_generation: number | null }>();
    const value = row?.live_generation;
    return value === null || value === undefined ? null : exactInteger(value, 'live_generation');
  }

  async getGeneration(generation: number): Promise<Generation | null> {
    const row = await this.db
      .prepare(
        `SELECT generation, status, started_at, completed_at, source_run_id,
                product_count, decided_by, detail
           FROM catalog_publication_generation WHERE generation = ?`,
      )
      .bind(generation)
      .first<Record<string, unknown>>();
    return row ? toGeneration(row) : null;
  }

  async listGenerations(limit = 20): Promise<readonly Generation[]> {
    const out = await this.db
      .prepare(
        `SELECT generation, status, started_at, completed_at, source_run_id,
                product_count, decided_by, detail
           FROM catalog_publication_generation
          ORDER BY generation DESC LIMIT ?`,
      )
      .bind(limit)
      .all<Record<string, unknown>>();
    return out.results.map(toGeneration);
  }

  /** How many products the public catalogue holds at the live generation. */
  async publishedCount(): Promise<number> {
    const live = await this.liveGeneration();
    if (live === null) return 0;
    const row = await this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM catalog_published_product
          WHERE first_generation <= ?
            AND (last_generation IS NULL OR last_generation >= ?)`,
      )
      .bind(live, live)
      .first<{ n: number }>();
    return exactInteger(row?.n ?? 0, 'publishedCount');
  }

  /* ──────────────────────────── building ──────────────────────────── */

  /**
   * Opens a generation.
   *
   * Concurrency is refused by the database: `publication_one_building` is a
   * partial unique index over status = 'building', so a second caller's INSERT
   * fails rather than racing. A lock held in memory would not survive the
   * process that took it.
   */
  async beginGeneration(options: {
    at: string;
    sourceRunId?: string | null;
    decidedBy?: string;
    detail?: string | null;
  }): Promise<number> {
    const next = await this.nextGenerationNumber();
    try {
      await this.db
        .prepare(
          `INSERT INTO catalog_publication_generation
             (generation, status, started_at, completed_at, source_run_id,
              product_count, decided_by, detail)
           VALUES (?, 'building', ?, NULL, ?, NULL, ?, ?)`,
        )
        .bind(
          next,
          options.at,
          options.sourceRunId ?? null,
          options.decidedBy ?? 'automatic',
          options.detail ?? null,
        )
        .run();
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Either another generation is building, or another caller took this
        // number. Reporting which is more useful than reporting neither.
        const building = await this.buildingGeneration();
        throw new ConcurrentPublicationError(building?.generation ?? null);
      }
      throw error;
    }
    return next;
  }

  async buildingGeneration(): Promise<Generation | null> {
    const row = await this.db
      .prepare(
        `SELECT generation, status, started_at, completed_at, source_run_id,
                product_count, decided_by, detail
           FROM catalog_publication_generation WHERE status = 'building'`,
      )
      .first<Record<string, unknown>>();
    return row ? toGeneration(row) : null;
  }

  /**
   * Stages candidates for a generation. Re-staging the same product replaces
   * its row, so a build interrupted halfway can simply be run again.
   */
  async stageCandidates(
    generation: number,
    candidates: readonly PublicationCandidate[],
  ): Promise<void> {
    if (candidates.length === 0) return;
    const statements: D1PreparedStatement[] = [];
    for (const group of chunk(candidates, Math.floor(100 / CANDIDATE_COLUMNS))) {
      const values = group.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const bound: unknown[] = [];
      for (const c of group) {
        bound.push(
          generation,
          c.productId,
          c.slug,
          c.title,
          c.brand,
          c.categorySlug,
          c.dataVerifiedAt,
          c.searchText,
          c.fromPrice ? c.fromPrice.amountMinor : null,
          c.fromPrice ? c.fromPrice.currency : null,
          c.offerCount,
          toInt(c.eligible),
          c.reasonCode,
        );
      }
      statements.push(
        this.db
          .prepare(
            `INSERT INTO catalog_publication_candidate
               (generation, product_id, slug, title, brand, category_slug,
                data_verified_at, search_text, from_price_minor, from_currency,
                offer_count, eligible, reason_code)
             VALUES ${values}
             ON CONFLICT (generation, product_id) DO UPDATE SET
               slug = excluded.slug,
               title = excluded.title,
               brand = excluded.brand,
               category_slug = excluded.category_slug,
               data_verified_at = excluded.data_verified_at,
               search_text = excluded.search_text,
               from_price_minor = excluded.from_price_minor,
               from_currency = excluded.from_currency,
               offer_count = excluded.offer_count,
               eligible = excluded.eligible,
               reason_code = excluded.reason_code`,
          )
          .bind(...bound),
      );
    }
    await this.flush(statements);
  }

  /* ─────────────────────────── publishing ─────────────────────────── */

  async publish(
    generation: number,
    options: {
      at: string;
      limits?: ValidationLimits;
      decidedBy?: string;
    },
  ): Promise<PublishOutcome> {
    const limits = options.limits ?? DEFAULT_PUBLICATION_LIMITS;
    const record = await this.getGeneration(generation);
    if (!record) {
      throw new GenerationRejectedError(generation, 'unknown_generation', 'no such generation');
    }

    const live = await this.liveGeneration();

    // IDEMPOTENT RETRY. A publisher that crashed after the pointer moved finds
    // its work already done and must not do it twice.
    if (record.status === 'live' && live === generation) {
      return {
        generation,
        publishedCount: await this.publishedCount(),
        opened: 0,
        closed: 0,
        refreshed: 0,
        unchanged: 0,
        previousGeneration: live,
        alreadyLive: true,
      };
    }

    /*
     * A HALF-FINISHED COMMIT.
     *
     * The commit is one batch, and Cloudflare documents a batch as atomic —
     * but this repository has NOT measured that. The D1 HTTP API refuses
     * bindings alongside multiple statements, so the remote suite cannot
     * express a batch at all (docs/engineering/d1-database.md lists it as
     * unproven). Relying on an unverified guarantee at the one point where the
     * public catalogue changes is the wrong place to be optimistic.
     *
     * So if the generation says 'live' while the pointer says otherwise, the
     * commit started and did not finish. The open and close phases provably
     * completed, because the commit is only reached after them, and the right
     * answer is to finish the commit rather than reject the generation.
     *
     * Without this branch that state is PERMANENT: validateGeneration would
     * refuse it for not being 'building', and the generation could then
     * neither be published nor rolled back to.
     */
    const eligibleCount = await this.countEligible(generation);
    if (record.status === 'live' && live !== generation) {
      await this.commit(generation, eligibleCount, live, options);
      return {
        generation,
        publishedCount: await this.publishedCount(),
        opened: 0,
        closed: 0,
        refreshed: 0,
        unchanged: 0,
        previousGeneration: live,
        alreadyLive: false,
      };
    }

    const liveCount = await this.publishedCount();
    const verdict = validateGeneration(
      { generation, status: record.status, eligibleCount, liveCount },
      limits,
    );
    if (!verdict.ok) {
      throw new GenerationRejectedError(generation, verdict.code, verdict.detail);
    }

    const diff = await this.diff(generation);

    /*
     * ── phase 1: close what leaves, and the old rows of what changed ──
     *
     * Invisible at the live generation, because a row closed AT L is still
     * inside the interval a reader at L asks for.
     *
     * When nothing is live yet, there is no L to close at — and
     * `last_generation = NULL` means STILL OPEN, so writing that would be a
     * silent no-op that leaves two open rows for one product. A row that was
     * never public is deleted instead.
     */
    const closes = diff.toClose.map((productId) =>
      live === null
        ? this.db
            .prepare(
              `DELETE FROM catalog_published_product
                WHERE product_id = ? AND last_generation IS NULL`,
            )
            .bind(productId)
        : this.db
            .prepare(
              `UPDATE catalog_published_product
                  SET last_generation = ?
                WHERE product_id = ? AND last_generation IS NULL`,
            )
            .bind(live, productId),
    );
    await this.flush(closes);

    // ── phase 2: open what arrives, and the new rows of what changed ──
    // Invisible until the pointer reaches this generation.
    await this.flush(this.openStatements(generation, options.at, diff.toOpen));

    // ── phase 3: the commit. Three statements, one batch. ──
    await this.commit(generation, eligibleCount, live, options);

    /*
     * ── phase 4: freshness, AFTER the pointer has moved ──
     *
     * These rows are already live, so this is the one write here that a
     * visitor sees immediately — which is why it runs last. A generation the
     * validator rejects never reaches this line, so a refused publication
     * leaves the live catalogue completely untouched, timestamps included.
     *
     * An interruption here leaves a stale timestamp on an otherwise correct
     * catalogue, and the next cycle fixes it. That is the cheapest failure
     * mode available: the alternative is versioning every row every cycle.
     */
    await this.flush(
      diff.toRefresh.map((row) =>
        this.db
          .prepare(
            `UPDATE catalog_published_product
                SET data_verified_at = ?
              WHERE product_id = ? AND last_generation IS NULL`,
          )
          .bind(row.dataVerifiedAt, row.productId),
      ),
    );

    return {
      generation,
      publishedCount: diff.toOpen.length + diff.unchanged,
      opened: diff.toOpen.length,
      closed: diff.toClose.length,
      refreshed: diff.toRefresh.length,
      unchanged: diff.unchanged,
      previousGeneration: live,
      alreadyLive: false,
    };
  }

  /**
   * The three statements that make a generation visible, in one batch.
   *
   * Each one is idempotent and the pointer move is guarded by the generation
   * it expects to replace, so running this twice either finishes the work or
   * refuses. It never publishes twice, and never silently discards whoever
   * moved the pointer in between.
   */
  private async commit(
    generation: number,
    productCount: number,
    expectedLive: number | null,
    options: { at: string; decidedBy?: string },
  ): Promise<void> {
    // The only thing that varies is whether the guard compares against NULL.
    // Everything else is bound, so no value can reach the SQL text.
    const guard = expectedLive === null ? 'live_generation IS NULL' : 'live_generation = ?';
    const decidedBy = options.decidedBy ?? 'automatic';
    const pointerBindings: unknown[] =
      expectedLive === null
        ? [generation, options.at, decidedBy]
        : [generation, options.at, decidedBy, expectedLive];

    const results = await this.db.batch([
      this.db
        .prepare(
          `UPDATE catalog_publication_generation
              SET status = 'live', completed_at = ?, product_count = ?
            WHERE generation = ? AND status = 'building'`,
        )
        .bind(options.at, productCount, generation),
      this.db
        .prepare(
          `UPDATE catalog_publication_generation
              SET status = 'superseded'
            WHERE status = 'live' AND generation <> ?`,
        )
        .bind(generation),
      this.db
        .prepare(
          `UPDATE catalog_publication_pointer
              SET live_generation = ?, updated_at = ?, updated_by = ?
            WHERE id = 1 AND ${guard}`,
        )
        .bind(...pointerBindings),
    ]);

    if (Number(results[results.length - 1]?.meta?.changes ?? 0) !== 1) {
      // The pointer was not where we expected. Finishing would discard
      // somebody else's publication, or an operator's rollback, in silence.
      throw new PointerMovedError(expectedLive, generation);
    }
  }

  /**
   * Moves the pointer back to a generation that was live before.
   *
   * Nothing is reconstructed: the rows closed when that generation was
   * superseded are still inside its interval, so pointing at it again restores
   * exactly the catalogue it served.
   */
  async rollbackTo(
    generation: number,
    options: { at: string; decidedBy: string; detail?: string },
  ): Promise<{ from: number | null; to: number; publishedCount: number }> {
    const target = await this.getGeneration(generation);
    if (!target) {
      throw new GenerationRejectedError(generation, 'unknown_generation', 'no such generation');
    }
    /*
     * ONLY a generation that actually served traffic. 'building' never did;
     * 'abandoned' was discarded before it could; and 'rolled_back' had the
     * rows it opened DELETED by the rollback that discarded it, so pointing at
     * it again would serve a catalogue that no longer exists.
     */
    if (target.status !== 'live' && target.status !== 'superseded') {
      throw new GenerationRejectedError(
        generation,
        'not_building',
        `status is '${target.status}'; only a generation that was published can be returned to`,
      );
    }

    const from = await this.liveGeneration();
    if (from !== null && generation > from) {
      throw new GenerationRejectedError(
        generation,
        'unknown_generation',
        `generation ${generation} is ahead of the live generation ${from}; ` +
          'rollback moves the pointer back, and rolling forward is publication',
      );
    }
    const guard = from === null ? 'live_generation IS NULL' : 'live_generation = ?';
    const bindings: unknown[] =
      from === null
        ? [generation, options.at, options.decidedBy]
        : [generation, options.at, options.decidedBy, from];

    const commit: D1PreparedStatement[] = [
      this.db
        .prepare(
          /*
           * completed_at has to be set here, not only the status. The ledger
           * carries CHECK ((status = 'building') = (completed_at IS NULL)), so
           * moving a generation that is still BUILDING to 'rolled_back' while
           * leaving completed_at NULL violates it — which is how this was
           * found, from the rollback-during-publish test rather than by
           * reading the migration.
           *
           * COALESCE so a generation that already finished keeps the time it
           * actually finished.
           */
          `UPDATE catalog_publication_generation
              SET status = 'rolled_back',
                  completed_at = COALESCE(completed_at, ?),
                  detail = ?
            WHERE generation > ? AND status IN ('live','building')`,
        )
        .bind(options.at, options.detail ?? `rolled back to ${generation}`, generation),
      this.db
        .prepare(`UPDATE catalog_publication_generation SET status = 'live' WHERE generation = ?`)
        .bind(generation),
      this.db
        .prepare(
          `UPDATE catalog_publication_pointer
              SET live_generation = ?, updated_at = ?, updated_by = ?
            WHERE id = 1 AND ${guard}`,
        )
        .bind(...bindings),
    ];

    const results = await this.db.batch(commit);
    if (Number(results[results.length - 1]?.meta?.changes ?? 0) !== 1) {
      throw new PointerMovedError(from, generation);
    }

    /*
     * AFTER the pointer has moved, discard the rows the abandoned generations
     * opened.
     *
     * They are invisible the moment the pointer moves back — first_generation
     * is ahead of the live generation — so the public catalogue is already
     * correct before this runs, and an interrupted cleanup leaves the site
     * right and only the invariant to repair.
     *
     * They cannot be LEFT, though. Each still holds a slot in
     * `published_product_open`, so a later generation trying to publish the
     * same product would be refused by that index: one rollback would block
     * every future publication of those products.
     *
     * The rows those generations CLOSED need nothing: a row closed at this
     * generation is still inside the interval a reader here asks for, which is
     * what makes rollback a pointer move rather than a reconstruction.
     */
    await this.db.batch([
      this.db
        .prepare('DELETE FROM catalog_published_product WHERE first_generation > ?')
        .bind(generation),
      this.db
        .prepare('DELETE FROM catalog_publication_candidate WHERE generation > ?')
        .bind(generation),
    ]);

    return { from, to: generation, publishedCount: await this.publishedCount() };
  }

  /**
   * Abandons a generation under construction, with its candidates AND the
   * published rows it had already opened.
   *
   * THE OPENED ROWS ARE THE REASON THIS IS NOT JUST A STATUS CHANGE. A
   * generation that crashed after its open phase has rows with
   * last_generation IS NULL, invisible at the live generation but still
   * occupying `published_product_open` — so the NEXT generation's attempt to
   * open a row for the same product would be refused by that index. Leaving
   * them would make one failed publication poison every later one.
   *
   * Rows that generation CLOSED are left alone: a row closed at the live
   * generation is still inside the interval a reader at the live generation
   * asks for, so the public catalogue never saw the close.
   */
  async abandon(generation: number, options: { at: string; detail: string }): Promise<void> {
    await this.db.batch([
      this.db
        .prepare('DELETE FROM catalog_publication_candidate WHERE generation = ?')
        .bind(generation),
      this.db
        .prepare('DELETE FROM catalog_published_product WHERE first_generation = ?')
        .bind(generation),
      this.db
        .prepare(
          `UPDATE catalog_publication_generation
              SET status = 'abandoned', completed_at = ?, detail = ?
            WHERE generation = ? AND status = 'building'`,
        )
        .bind(options.at, options.detail, generation),
    ]);
  }

  /* ─────────────────────────── retention ─────────────────────────── */

  /**
   * Deletes history older than the generations kept for rollback, with a hard
   * cap on how much one call may remove.
   *
   * The live generation is never touched, and neither is any generation a
   * published row still needs, because deleting those would break the foreign
   * keys the interval table depends on.
   */
  async prune(options: PruneOptions): Promise<PruneOutcome> {
    if (options.keep < 1) {
      throw new RangeError('keep must be at least 1; keeping none removes rollback');
    }
    const live = await this.liveGeneration();
    if (live === null) {
      return {
        oldestKept: null,
        candidatesDeleted: 0,
        publishedDeleted: 0,
        generationsDeleted: 0,
        truncated: false,
      };
    }

    const kept = await this.db
      .prepare(
        `SELECT generation FROM catalog_publication_generation
          WHERE generation <= ? ORDER BY generation DESC LIMIT ?`,
      )
      .bind(live, options.keep)
      .all<{ generation: number }>();
    const oldestKept = kept.results.length
      ? exactInteger(kept.results[kept.results.length - 1].generation, 'oldestKept')
      : live;

    let budget = options.maxDeletes;
    const spend = async (statement: D1PreparedStatement): Promise<number> => {
      if (budget <= 0) return 0;
      const out = await statement.run();
      const changes = Number(out.meta?.changes ?? 0);
      budget -= changes;
      return changes;
    };

    // Order matters: candidates and published rows reference the ledger.
    const candidatesDeleted = await spend(
      this.db
        .prepare(
          `DELETE FROM catalog_publication_candidate
            WHERE generation < ?
              AND rowid IN (SELECT rowid FROM catalog_publication_candidate
                             WHERE generation < ? LIMIT ?)`,
        )
        .bind(oldestKept, oldestKept, budget),
    );

    // Only rows that CLOSED before the oldest kept generation. A row still
    // open, or closed inside the kept window, is part of a catalogue someone
    // can still roll back to.
    const publishedDeleted = await spend(
      this.db
        .prepare(
          `DELETE FROM catalog_published_product
            WHERE last_generation IS NOT NULL
              AND last_generation < ?
              AND rowid IN (SELECT rowid FROM catalog_published_product
                             WHERE last_generation IS NOT NULL AND last_generation < ?
                             LIMIT ?)`,
        )
        .bind(oldestKept, oldestKept, Math.max(budget, 0)),
    );

    const generationsDeleted = await spend(
      this.db
        .prepare(
          `DELETE FROM catalog_publication_generation
            WHERE generation < ?
              AND generation NOT IN (SELECT first_generation FROM catalog_published_product)
              AND generation NOT IN (SELECT last_generation FROM catalog_published_product
                                      WHERE last_generation IS NOT NULL)
              AND generation NOT IN (SELECT generation FROM catalog_publication_candidate)
              AND generation <> COALESCE(
                    (SELECT live_generation FROM catalog_publication_pointer WHERE id = 1), -1)`,
        )
        .bind(oldestKept),
    );

    return {
      oldestKept,
      candidatesDeleted,
      publishedDeleted,
      generationsDeleted,
      truncated: budget <= 0,
    };
  }

  /* ──────────────────────────── internals ──────────────────────────── */

  private async nextGenerationNumber(): Promise<number> {
    const row = await this.db
      .prepare('SELECT COALESCE(MAX(generation), 0) AS n FROM catalog_publication_generation')
      .first<{ n: number }>();
    return exactInteger(row?.n ?? 0, 'maxGeneration') + 1;
  }

  private async countEligible(generation: number): Promise<number> {
    const row = await this.db
      .prepare(
        'SELECT COUNT(*) AS n FROM catalog_publication_candidate WHERE generation = ? AND eligible = 1',
      )
      .bind(generation)
      .first<{ n: number }>();
    return exactInteger(row?.n ?? 0, 'eligibleCount');
  }

  /**
   * What this generation changes relative to the live one.
   *
   * THE WHOLE POINT IS WHAT IS MISSING FROM THE RESULT: a product whose
   * published row already says what the candidate says appears in neither
   * list, so an unchanged catalogue costs no writes at all. That is why
   * publication can run twice a day on the free tier.
   */
  private async diff(generation: number): Promise<{
    toOpen: readonly PublicationCandidate[];
    toClose: readonly string[];
    /** Live rows whose content is unchanged but whose freshness moved. */
    toRefresh: readonly { productId: string; dataVerifiedAt: string }[];
    unchanged: number;
  }> {
    const candidates = await this.db
      .prepare(
        `SELECT product_id, slug, title, brand, category_slug, data_verified_at,
                search_text, from_price_minor, from_currency, offer_count,
                eligible, reason_code
           FROM catalog_publication_candidate
          WHERE generation = ? AND eligible = 1`,
      )
      .bind(generation)
      .all<Record<string, unknown>>();

    /*
     * EVERY open row, with no `first_generation <= live` filter.
     *
     * The filter was the obvious thing to write and it was wrong. The set of
     * open rows is what `published_product_open` and `published_slug_open`
     * govern, and those indexes know nothing about the pointer. So if the two
     * ever disagree — a generation that opened rows and died before the
     * pointer moved, a pointer moved by someone else — a filtered diff
     * concludes a product is unpublished, tries to open a second row for it,
     * and publication dies on `UNIQUE constraint failed` instead of refusing
     * cleanly. Reading what the index reads cannot drift from it.
     */
    const open = await this.db
      .prepare(
        `SELECT product_id, slug, title, brand, category_slug, data_verified_at,
                search_text, from_price_minor, from_currency, offer_count
           FROM catalog_published_product
          WHERE last_generation IS NULL`,
      )
      .all<Record<string, unknown>>();

    const published = new Map(open.results.map((r) => [String(r.product_id), r]));

    const toOpen: PublicationCandidate[] = [];
    const toClose: string[] = [];
    const toRefresh: { productId: string; dataVerifiedAt: string }[] = [];
    let unchanged = 0;

    for (const row of candidates.results) {
      const candidate = toCandidate(row);
      const existing = published.get(candidate.productId);
      published.delete(candidate.productId);
      if (!existing) {
        toOpen.push(candidate);
      } else if (differs(existing, candidate)) {
        // A content change closes the old row and opens a new one, so the
        // superseded content survives for rollback.
        toClose.push(candidate.productId);
        toOpen.push(candidate);
      } else {
        unchanged += 1;
        if (String(existing.data_verified_at) !== candidate.dataVerifiedAt) {
          toRefresh.push({
            productId: candidate.productId,
            dataVerifiedAt: candidate.dataVerifiedAt,
          });
        }
      }
    }

    // Whatever is left was published and is not eligible now.
    for (const productId of published.keys()) toClose.push(productId);

    return { toOpen, toClose, toRefresh, unchanged };
  }

  private openStatements(
    generation: number,
    at: string,
    rows: readonly PublicationCandidate[],
  ): D1PreparedStatement[] {
    const statements: D1PreparedStatement[] = [];
    for (const group of chunk(rows, Math.floor(100 / PUBLISHED_COLUMNS))) {
      const values = group.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
      const bound: unknown[] = [];
      for (const c of group) {
        bound.push(
          c.productId,
          generation,
          null,
          at,
          c.slug,
          c.title,
          c.brand,
          c.categorySlug,
          c.dataVerifiedAt,
          c.searchText,
          c.fromPrice ? c.fromPrice.amountMinor : null,
          c.fromPrice ? c.fromPrice.currency : null,
        );
      }
      statements.push(
        this.db
          .prepare(
            /*
             * DO NOTHING on the PRIMARY KEY ONLY, not `INSERT OR IGNORE`.
             *
             * Re-running the open phase must insert nothing the second time —
             * that is the idempotence this relies on. But OR IGNORE swallows
             * EVERY constraint violation, including the partial unique index
             * that guarantees one open row per product. If that index were
             * ever hit, OR IGNORE would quietly drop the product from the
             * catalogue; naming the conflict target makes it raise instead.
             */
            `INSERT INTO catalog_published_product
               (product_id, first_generation, last_generation, published_at,
                slug, title, brand, category_slug, data_verified_at, search_text,
                from_price_minor, from_currency)
             VALUES ${values}
             ON CONFLICT (product_id, first_generation) DO NOTHING`,
          )
          .bind(...bound),
      );
    }
    // offer_count is set separately rather than bound above, because binding it
    // would push a row past the parameter budget this chunking assumes.
    for (const group of chunk(rows, 50)) {
      for (const c of group) {
        statements.push(
          this.db
            .prepare(
              `UPDATE catalog_published_product SET offer_count = ?
                WHERE product_id = ? AND first_generation = ?`,
            )
            .bind(c.offerCount, c.productId, generation),
        );
      }
    }
    return statements;
  }

  private async flush(statements: readonly D1PreparedStatement[]): Promise<void> {
    for (let i = 0; i < statements.length; i += BATCH) {
      await this.db.batch(statements.slice(i, i + BATCH));
    }
  }
}

/* ──────────────────────────── helpers ──────────────────────────── */

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  const step = Math.max(1, size);
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}

const text = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

function toGeneration(row: Record<string, unknown>): Generation {
  return {
    generation: exactInteger(row.generation, 'generation'),
    status: String(row.status) as GenerationStatus,
    startedAt: String(row.started_at),
    completedAt: text(row.completed_at),
    sourceRunId: text(row.source_run_id),
    productCount:
      row.product_count === null || row.product_count === undefined
        ? null
        : exactInteger(row.product_count, 'product_count'),
    decidedBy: String(row.decided_by),
    detail: text(row.detail),
  };
}

function toCandidate(row: Record<string, unknown>): PublicationCandidate {
  const minor = row.from_price_minor;
  return {
    productId: String(row.product_id),
    slug: String(row.slug),
    title: String(row.title),
    brand: text(row.brand),
    categorySlug: text(row.category_slug),
    dataVerifiedAt: String(row.data_verified_at),
    searchText: String(row.search_text),
    fromPrice:
      minor === null || minor === undefined
        ? null
        : {
            amountMinor: exactInteger(minor, 'from_price_minor'),
            currency: String(row.from_currency),
          },
    offerCount: exactInteger(row.offer_count ?? 0, 'offer_count'),
    eligible: fromInt(row.eligible ?? 1),
    reasonCode: String(row.reason_code ?? 'eligible'),
  };
}

/**
 * Whether a published row disagrees with the candidate.
 *
 * Compared field by field rather than by a hash of the row, because a hash
 * would also change when a column is added and would silently republish the
 * entire catalogue on the next deploy.
 */
function differs(existing: Record<string, unknown>, candidate: PublicationCandidate): boolean {
  /*
   * data_verified_at IS DELIBERATELY NOT COMPARED.
   *
   * It moves every single cycle — it is the newest `last_seen_at` among the
   * product's offers, and re-reading a feed updates that even when nothing
   * about the product changed. Treating it as content therefore closed and
   * reopened EVERY published row on EVERY cycle, which destroys the one
   * property the whole interval design exists for. Measured: cycle 3 of the
   * end-to-end test reported 13 rows opened where 1 product was new.
   *
   * So freshness is an UPDATE to the live row, applied after the commit, and
   * content changes are what version it. Rollback does not need a history of
   * freshness; it needs the catalogue that was served.
   */
  const minor = existing.from_price_minor;
  return (
    String(existing.slug) !== candidate.slug ||
    String(existing.title) !== candidate.title ||
    text(existing.brand) !== candidate.brand ||
    text(existing.category_slug) !== candidate.categorySlug ||
    String(existing.search_text) !== candidate.searchText ||
    (minor === null || minor === undefined ? null : exactInteger(minor, 'from_price_minor')) !==
      (candidate.fromPrice ? candidate.fromPrice.amountMinor : null) ||
    text(existing.from_currency) !== (candidate.fromPrice ? candidate.fromPrice.currency : null) ||
    exactInteger(existing.offer_count ?? 0, 'offer_count') !== candidate.offerCount
  );
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed/i.test(message);
}
