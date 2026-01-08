import pool from "./pgPool";

let ensured = false;

function sanitizeTimezone(tz?: string | null) {
  if (!tz) return null;
  const trimmed = tz.trim();
  if (!trimmed) return null;
  return /^[A-Za-z0-9_\/+\-]+$/.test(trimmed) ? trimmed : null;
}

const detectedSystemTimezone = sanitizeTimezone(
  Intl.DateTimeFormat().resolvedOptions().timeZone
);

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function formatDateInTimezone(date: Date, tz: string) {
  if (!dateFormatterCache.has(tz)) {
    dateFormatterCache.set(
      tz,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    );
  }
  const formatter = dateFormatterCache.get(tz)!;
  return formatter.format(date);
}

const VISITOR_TIMEZONE =
  sanitizeTimezone(process.env.VISITOR_TZ) ||
  sanitizeTimezone(process.env.TZ) ||
  detectedSystemTimezone ||
  "UTC";

export async function ensureVisitorInfrastructure() {
  if (ensured) return;

  const baseTableSQL = `
    CREATE TABLE IF NOT EXISTS visitor_count (
      id BIGSERIAL PRIMARY KEY,
      total BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `;

  const statsTableSQL = `
    CREATE TABLE IF NOT EXISTS visitor_daily_stats (
      id BIGSERIAL PRIMARY KEY,
      day DATE UNIQUE NOT NULL,
      total BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `;

  const upsertSeedRowSQL = `
    INSERT INTO visitor_count (id, total)
    VALUES (1, 0)
    ON CONFLICT (id) DO NOTHING;
  `;

  const incrementFunctionSQL = `
    CREATE OR REPLACE FUNCTION increment_visitors(p_tz TEXT DEFAULT 'UTC')
    RETURNS BIGINT
    LANGUAGE plpgsql
    AS $$
    DECLARE
      updated_total BIGINT;
      current_day DATE;
    BEGIN
      current_day := (timezone(COALESCE(NULLIF(p_tz, ''), 'UTC'), now()))::date;

      UPDATE visitor_count
      SET total = total + 1
      WHERE id = (SELECT id FROM visitor_count ORDER BY id ASC LIMIT 1)
      RETURNING total INTO updated_total;

      IF NOT FOUND THEN
        INSERT INTO visitor_count (total)
        VALUES (1)
        RETURNING total INTO updated_total;
      END IF;

      INSERT INTO visitor_daily_stats(day, total, updated_at)
      VALUES (current_day, 1, NOW())
      ON CONFLICT (day) DO UPDATE
        SET total = visitor_daily_stats.total + 1,
            updated_at = NOW();

      RETURN updated_total;
    END;
    $$;
  `;

  await pool.query(baseTableSQL);
  await pool.query(statsTableSQL);
  await pool.query(upsertSeedRowSQL);
  await pool.query(incrementFunctionSQL);

  ensured = true;
}

export async function incrementVisitorCounter() {
  const result = await pool.query<{ total: string }>(
    "SELECT increment_visitors($1::text) AS total;",
    [VISITOR_TIMEZONE]
  );
  const total = result.rows[0]?.total ?? "0";
  return Number(total);
}

export async function getVisitorTotal() {
  const { rows } = await pool.query<{ total: string }>(
    "SELECT total FROM visitor_count ORDER BY id ASC LIMIT 1;"
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getVisitorStats(days = 30) {
  const normalizedDays = Math.max(
    1,
    Math.min(180, Number.isFinite(days) ? Number(days) : 30)
  );

  const { rows } = await pool.query<{ day: string; total: string }>(
    `
      SELECT day, total
      FROM visitor_daily_stats
      WHERE day >= (timezone($2::text, now()))::date - ($1::int - 1)
      ORDER BY day ASC;
    `,
    [normalizedDays, VISITOR_TIMEZONE]
  );

  const statsByDay = new Map<string, number>();
  for (const row of rows) {
    const rawDay = row.day;
    const parsed = rawDay ? new Date(rawDay) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      const key = formatDateInTimezone(parsed, VISITOR_TIMEZONE);
      statsByDay.set(key, Number(row.total ?? 0));
    }
  }

  const data: { day: string; total: number }[] = [];
  const todayKey = formatDateInTimezone(new Date(), VISITOR_TIMEZONE);
  const parts = todayKey.split("-").map((part) => Number(part));
  let anchor = new Date();
  if (
    parts.length === 3 &&
    parts.every((num) => Number.isFinite(num)) &&
    parts[1] >= 1 &&
    parts[1] <= 12 &&
    parts[2] >= 1 &&
    parts[2] <= 31
  ) {
    anchor = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  }

  for (let i = normalizedDays - 1; i >= 0; i -= 1) {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() - i);
    const key = formatDateInTimezone(d, VISITOR_TIMEZONE);
    data.push({
      day: key,
      total: statsByDay.get(key) ?? 0,
    });
  }

  return data;
}
