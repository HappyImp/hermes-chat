#!/usr/bin/env node
/**
 * Bridge script: runs `hermes cron list` CLI and outputs JSON to stdout.
 * Used by the Vite plugin middleware to serve real-time cron data.
 *
 * Usage: node scripts/cron-bridge.mjs
 * Output: { "jobs": CronJob[] }
 */

import { execSync } from 'node:child_process';

/**
 * Parse the text output of `hermes cron list` into structured CronJob objects.
 * Format per job:
 *   <id> [<state>]
 *     Name:      <name>
 *     Schedule:  <expr>
 *     Repeat:    ∞
 *     Last run:  <ISO timestamp>  (optional)
 *     Next run:  <ISO timestamp>
 *     Deliver:   <target>
 *     Skills:    <comma-separated>
 */
function parseCronListOutput(text) {
  const jobs = [];
  const blocks = text.split(/\n(?=\s+[0-9a-f]{12}\s+\[)/);

  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;

    // First line: "  798fa4631c59 [active]"
    const idMatch = lines[0].match(/([0-9a-f]{12})\s+\[(\w+)\]/);
    if (!idMatch) continue;

    const [, id, rawState] = idMatch;
    const enabled = rawState === 'active';
    const state = enabled ? 'scheduled' : 'paused';

    // Parse key-value lines
    const fields = {};
    for (let i = 1; i < lines.length; i++) {
      const kvMatch = lines[i].match(/^\s+(\w[\w\s]*?):\s+(.+)$/);
      if (kvMatch) {
        fields[kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }

    const name = fields['Name'] || 'unknown';
    const scheduleExpr = fields['Schedule'] || '';
    const lastRunRaw = fields['Last run'] || null;
    const nextRunRaw = fields['Next run'] || null;
    const skillsRaw = fields['Skills'] || '';

    // Determine schedule kind
    const scheduleKind = scheduleExpr.startsWith('every') ? 'interval' : 'cron';

    jobs.push({
      id,
      name,
      enabled,
      state,
      last_run_at: parseTimestamp(lastRunRaw),
      next_run_at: parseTimestamp(nextRunRaw),
      schedule: {
        kind: scheduleKind,
        expr: scheduleExpr,
        display: scheduleExpr,
      },
      last_status: null,
      skills: skillsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }

  return jobs;
}

/**
 * Parse a timestamp string into ISO format.
 * Handles: "2026-06-15T09:25:00+08:00", "2026-06-14T07:36:00.875866+08:00"
 * Returns null for null/empty/invalid input.
 */
function parseTimestamp(raw) {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// --- Main ---
try {
  const output = execSync('hermes cron list 2>/dev/null', {
    encoding: 'utf-8',
    timeout: 10_000,
  });
  const jobs = parseCronListOutput(output);
  process.stdout.write(JSON.stringify({ jobs }));
} catch (err) {
  // CLI failed — return empty so frontend falls back to defaults
  process.stdout.write(JSON.stringify({ jobs: [] }));
}
