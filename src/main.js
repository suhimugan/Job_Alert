'use strict';
require('dotenv').config();

const { runAllScrapers } = require('./scrapers/index');
const { filterJobs } = require('./core/filter');
const {
  passesGeoFilter,
  passesGlobalFilter,
  isIndia,
} = require('./core/geoFilter');
const { evaluateJobs } = require('./core/llmEvaluator');
const Database = require('./core/database');
//"const TelegramNotifier = require('./notifiers/telegram');"
//"const DiscordNotifier = require('./notifiers/discord');"
const EmailNotifier = require('./notifiers/email');

// ─── Config ────────────────────────────────────────────────────────────────
//const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
//const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
//const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const USE_SERPAPI = process.env.USE_SERPAPI === 'true';
const DRY_RUN =
  process.env.DRY_RUN === 'true' ||
  process.argv.includes('--dry-run');

const USE_LLM = process.env.USE_LLM === 'true';

const SEED_MODE =
  process.env.SEED_MODE === 'true' ||
  process.argv.includes('--seed');

// Maximum number of jobs sent in one run
const MAX_JOBS_PER_RUN = 50;

// ─── Configuration Validation ───────────────────────────────────────────────

// ─── Sort Jobs ──────────────────────────────────────────────────────────────
function sortJobs(jobs) {
  return jobs.sort((a, b) => {
    // 1. Highest LLM match score first
    if (a.matchScore != null && b.matchScore != null) {
      const scoreDiff = b.matchScore - a.matchScore;

      if (scoreDiff !== 0) {
        return scoreDiff;
      }
    }

    // 2. Geography:
    // India → Remote → Global
    const geoScore = (job) => {
      const loc = (job.location || '').toLowerCase();

      if (isIndia(loc)) return 0;

      if (
        loc.includes('remote') ||
        loc.includes('wfh') ||
        loc.includes('work from home')
      ) {
        return 1;
      }

      return 2;
    };

    const geoDifference = geoScore(a) - geoScore(b);

    if (geoDifference !== 0) {
      return geoDifference;
    }

    // 3. Walk-in / urgent jobs first
    if (a.isWalkIn !== b.isWalkIn) {
      return a.isWalkIn ? -1 : 1;
    }

    // 4. Full-time before other job types
    return (
      (a.type === 'fulltime' ? 0 : 1) -
      (b.type === 'fulltime' ? 0 : 1)
    );
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🤖 JOB ALERT BOT — Starting Run');

  console.log(
    `  Time: ${new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
    })} IST`
  );

  console.log(
    `  Mode: ${
      USE_SERPAPI
        ? 'FULL (SerpAPI enabled)'
        : 'FREE sources only'
    }`
  );

  console.log(
    `  Dry Run: ${DRY_RUN ? 'YES (no messages sent)' : 'NO'}`
  );

  if (SEED_MODE) {
    console.log(
      '  🌱 SEED MODE: Cataloguing existing jobs — NO notifications.'
    );
  }

  console.log(
    `  LLM Eval: ${
      USE_LLM ? 'YES' : 'OFF'
    }`
  );

  console.log('═'.repeat(60) + '\n');

  // ── 0. Validate configuration ────────────────────────────────────────────
  //validateConfig();

  // ── 1. Scrape ─────────────────────────────────────────────────────────────
  console.log('🔎 Step 1: Scraping jobs...');

  const rawJobs = await runAllScrapers({
    useSerpapi: USE_SERPAPI,
  });

  console.log(`📥 Raw jobs collected: ${rawJobs.length}`);

  // ── 2. Filter by role relevance ──────────────────────────────────────────
  const csJobs = filterJobs(rawJobs);

  console.log(
    `📋 Step 2: After role filter: ${csJobs.length} relevant jobs`
  );

  // ── 3. Filter by geography ────────────────────────────────────────────────
const geoFiltered = csJobs.filter(passesGeoFilter);

const globalJobs = csJobs.filter(passesGlobalFilter);

console.log(
  `🌍 Step 3: India/Remote jobs: ${geoFiltered.length}`
);

console.log(
  `🌎 Global secondary jobs: ${globalJobs.length}`
);
  // ── 3.5. Optional AI / LLM evaluation ────────────────────────────────────
  let evaluatedJobs = geoFiltered;

  if (USE_LLM && !SEED_MODE) {
    console.log(
      `\n🧠 Step 3.5: Running AI evaluation on ${geoFiltered.length} jobs...`
    );

    evaluatedJobs = await evaluateJobs(geoFiltered);

    const scored = evaluatedJobs.filter(
      (job) => job.matchScore != null
    );

    console.log(
      `🧠 AI scored ${scored.length}/${evaluatedJobs.length} jobs`
    );
  }

   // ── 4. Deduplicate against database ──────────────────────────────────────
  console.log('🗄️ Step 4: Checking previously seen jobs...');

  const db = new Database();

  db.cleanup();

  // Main India/Remote jobs
  const newJobs = evaluatedJobs.filter((job) => db.isNew(job));

  // Global jobs are tracked separately
  const newGlobalJobs = globalJobs.filter((job) => db.isNew(job));

  console.log(`✨ New India/Remote jobs: ${newJobs.length}`);
  console.log(`🌎 New global jobs: ${newGlobalJobs.length}`);

  // Nothing new anywhere → stay silent
if (newJobs.length === 0 && newGlobalJobs.length === 0) {
  console.log('✅ No new jobs found. Staying silent.');

  if (!DRY_RUN) {
    db.save();
  } else {
    console.log('🧪 [DRY RUN] Database NOT updated.');
  }

  return;
}

  // ── 5. Seed mode ─────────────────────────────────────────────────────────
  if (SEED_MODE) {
    console.log(
      `\n🌱 SEED MODE: Cataloguing ${
        newJobs.length + newGlobalJobs.length
      } jobs...`
    );

    for (const job of newJobs) {
      db.markSeen(job);
    }

    for (const job of newGlobalJobs) {
      db.markSeen(job);
    }

    db.save();

    const stats = db.stats();

    console.log(
      `\n🌱 Seed complete. Database now contains ${stats.total} jobs.`
    );

    return;
  }

  // ── 5.1 Cap notifications ────────────────────────────────────────────────
  const toNotify = newJobs.slice(0, MAX_JOBS_PER_RUN);

  const deferred = Math.max(
    0,
    newJobs.length - toNotify.length
  );

  // Keep global opportunities separate and smaller
  const globalToNotify = newGlobalJobs.slice(0, 10);

  const globalDeferred = Math.max(
    0,
    newGlobalJobs.length - globalToNotify.length
  );

  console.log(
    `📨 Main alerts: ${toNotify.length} ` +
    `(capped at ${MAX_JOBS_PER_RUN})`
  );

  console.log(
    `🌎 Global alerts: ${globalToNotify.length} ` +
    `(capped at 10)`
  );

  if (deferred > 0) {
    console.log(
      `⏳ ${deferred} main jobs deferred to the next run.`
    );
  }

  if (globalDeferred > 0) {
    console.log(
      `⏳ ${globalDeferred} global jobs deferred to the next run.`
    );
  }

  // ── 6. Send notifications ────────────────────────────────────────────────
  console.log('📨 Step 6: Sending notifications...');

  if (!DRY_RUN) {
    const email = new EmailNotifier();

    const results = await Promise.allSettled([
      email.send(toNotify, globalToNotify),
    ]);

    const successful = results.filter(
      (result) =>
        result.status === 'fulfilled' &&
        result.value === true
    );

    const failures = results
      .filter((result) => result.status === 'rejected')
      .map(
        (result) =>
          result.reason?.message ||
          'Unknown email error'
      );

    console.log(
      `📨 Successful email notifications: ${successful.length}/1`
    );

    if (failures.length > 0) {
      console.error(
        `❌ Email notification failed: ${failures.join(' | ')}`
      );
    }

    if (successful.length === 0) {
      console.error(
        '💥 Email notification was not sent.'
      );

      console.error(
        'Jobs will NOT be marked as seen and will retry next run.'
      );

      process.exit(1);
    }
  } else {
    console.log(
      '\n🧪 [DRY RUN] No notifications will be sent.'
    );

    console.log(
      `🧪 [DRY RUN] Main jobs that would be sent: ${toNotify.length}`
    );

    toNotify.forEach((job, index) => {
      const walkInLabel = job.isWalkIn
        ? '🚨 WALK-IN/URGENT'
        : '';

      const scoreLabel =
        job.matchScore != null
          ? ` | Match: ${job.matchScore}`
          : '';

      console.log(
        `  ${index + 1}. ${walkInLabel} ` +
        `[${job.type}] ${job.title} @ ${job.company} | ` +
        `${job.location || 'No location'} | ` +
        `${job.source}${scoreLabel}`
      );
    });

    console.log(
      `\n🧪 [DRY RUN] Global jobs that would be sent: ${globalToNotify.length}`
    );

    globalToNotify.forEach((job, index) => {
      console.log(
        `  🌎 ${index + 1}. ` +
        `[${job.type}] ${job.title} @ ${job.company} | ` +
        `${job.location || 'No location'} | ` +
        `${job.source}`
      );
    });

    console.log('');
  }

  // ── 7. Updating database ─────────────────────────────────────────────────
  console.log('🗄️ Step 7: Updating database...');

  // Only mark jobs that were actually sent/processed.
if (!DRY_RUN) {
  for (const job of toNotify) {
    db.markSeen(job);
  }

  for (const job of globalToNotify) {
    db.markSeen(job);
  }

  db.save();
  console.log('🗄️ Database updated with notified jobs.');
} else {
  console.log('🧪 [DRY RUN] Database NOT updated.');
}

  db.save();

  // ── 8. Final summary ─────────────────────────────────────────────────────
  const stats = db.stats();

  console.log('\n' + '='.repeat(60));
  console.log('  JOB ALERT BOT — Run Complete');
  console.log('='.repeat(60));
  console.log(`  Main alerts sent:   ${toNotify.length}`);
  console.log(`  Global alerts sent: ${globalToNotify.length}`);
  console.log(`  Database total:     ${stats.total}`);
  console.log('='.repeat(60) + '\n');
}

main().catch((error) => {
  console.error('\n💥 Fatal error in main():', error);
  process.exit(1);
});
