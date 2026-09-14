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
const { rankCandidates } = require('./core/candidateRanker');
const { calculateMatchScore } = require('./core/matchScoring');
const {
  getJobCategory,
  categorizeJobs,
} = require('./core/jobCategories');
const EmailNotifier = require('./notifiers/email');
const {
  analyzeResumeGaps,
} = require('./core/resumeGapAnalysis');

const {
  generateResumeTailoringForJobs,
} = require('./core/resumeTailoring');

const {
  generateApplicationAdviceForJobs,
} = require('./core/applicationAdvice');

const {
  rankJobs,
} = require('./core/jobRanker');

// --- Configuration ----------------------------------------------------------

const USE_SERPAPI = process.env.USE_SERPAPI === 'true';

const DRY_RUN =
  process.env.DRY_RUN === 'true' ||
  process.argv.includes('--dry-run');

const USE_LLM = process.env.USE_LLM === 'true';

const SEED_MODE =
  process.env.SEED_MODE === 'true' ||
  process.argv.includes('--seed');

// IMPORTANT:
// This limits ONLY the number of jobs sent to AI.
// It does NOT limit the number of jobs shown in the email.
const AI_CANDIDATE_LIMIT = 25;

// --- Job Categories ----------------------------------------------------------
//
// Step 13 categories are handled by src/core/jobCategories.js.
// AI score takes priority.
// Fallback score is used only when AI is unavailable.

function getAICategory(score) {
  return getJobCategory({
    aiScore: score,
  }).category;
}
// --- Apply AI Metadata -------------------------------------------------------

function enrichAIResult(job) {
  const hasAIScore =
    job.matchScore != null &&
    Number.isFinite(Number(job.matchScore));

  const matchScore =
    hasAIScore
      ? Number(job.matchScore)
      : null;

  const fallback =
    hasAIScore
      ? null
      : calculateMatchScore(job);

  const categoryResult =
    getJobCategory(
      hasAIScore
        ? { aiScore: matchScore }
        : { fallbackScore: fallback.score }
    );

  return {
    ...job,

    matchScore,

    fallbackScore:
      hasAIScore
        ? null
        : fallback.score,

    fallbackMatchedSkills:
      hasAIScore
        ? []
        : fallback.matchedSkills,

    fallbackScoreBreakdown:
      hasAIScore
        ? null
        : fallback.breakdown,

    aiCategory:
      categoryResult.category,

    aiPriority:
      categoryResult.priority,

    scoreSource:
      categoryResult.source,

    aiEvaluated:
      hasAIScore,

    aiProvider:
      job.aiProvider ||
      'none',

    candidateScore:
      job.candidateScore ?? null,

    candidateGroups:
      Array.isArray(job.candidateGroups)
        ? job.candidateGroups
        : [],

    candidatePrimaryGroups:
      Array.isArray(job.candidatePrimaryGroups)
        ? job.candidatePrimaryGroups
        : [],

    candidateReasons:
      Array.isArray(job.candidateReasons)
        ? job.candidateReasons
        : [],

    candidateExperience:
      job.candidateExperience ||
      '',

    candidateSkillMatches:
      job.candidateSkillMatches ?? 0,

    aiReason:
      job.aiReason ||
      '',

    aiStrengths:
      Array.isArray(job.aiStrengths)
        ? job.aiStrengths
        : [],

    aiGaps:
      Array.isArray(job.aiGaps)
        ? job.aiGaps
        : [],

    coldPitch:
      job.coldPitch ||
      '',

    isWalkIn:
      Boolean(job.isWalkIn),
  };
}

// --- Job Sorting -------------------------------------------------------------
//
// Final email ordering:
//
// 1. AI scored jobs
// 2. AI category / score
// 3. Candidate score
// 4. India
// 5. Remote
// 6. Walk-in / urgent
// 7. Full-time
//
// Jobs without AI scores remain visible and are placed after AI-scored jobs.

function sortJobs(jobs) {
  return jobs.sort((a, b) => {
    const aScore =
      a.matchScore == null
        ? -1
        : Number(a.matchScore);

    const bScore =
      b.matchScore == null
        ? -1
        : Number(b.matchScore);

    // 1. AI score
    if (bScore !== aScore) {
      return bScore - aScore;
    }

    // 2. Candidate score
    const aCandidate =
      a.candidateScore == null
        ? -1
        : Number(a.candidateScore);

    const bCandidate =
      b.candidateScore == null
        ? -1
        : Number(b.candidateScore);

    if (bCandidate !== aCandidate) {
      return bCandidate - aCandidate;
    }

    // 3. India before remote/other accepted geography.
    const geoScore = (job) => {
      const loc = (
        job.location || ''
      )
        .toLowerCase()
        .trim();

      if (isIndia(loc)) {
        return 0;
      }

      if (passesGeoFilter(job)) {
        return 1;
      }

      return 2;
    };

    const geoDifference =
      geoScore(a) - geoScore(b);

    if (geoDifference !== 0) {
      return geoDifference;
    }

    // 4. Walk-in / urgent
    if (a.isWalkIn !== b.isWalkIn) {
      return a.isWalkIn ? -1 : 1;
    }

    // 5. Full-time
    return (
      (a.type === 'fulltime' ? 0 : 1) -
      (b.type === 'fulltime' ? 0 : 1)
    );
  });
}

 // --- Print AI / Match Summary -----------------------------------------------

function printAISummary(jobs) {
  const counts = {
    Excellent: 0,
    Strong: 0,
    Good: 0,
    Possible: 0,
    Weak: 0,
    'Not AI scored': 0,
  };

  let aiScored = 0;
  let fallbackScored = 0;

  for (const job of jobs) {
    const result = getJobCategory(job);

    if (result.category.includes('(fallback)')) {
      fallbackScored++;
    } else if (result.category !== 'Not AI scored') {
      aiScored++;
    }

    const baseCategory =
      result.category.replace(' (fallback)', '');

    if (counts[baseCategory] !== undefined) {
      counts[baseCategory]++;
    }
  }

  console.log('\n?? AI / MATCH CATEGORY SUMMARY');

  console.log(
    '   Excellent:       ' + counts.Excellent
  );

  console.log(
    '   Strong:          ' + counts.Strong
  );

  console.log(
    '   Good:            ' + counts.Good
  );

  console.log(
    '   Possible:        ' + counts.Possible
  );

  console.log(
    '   Weak:            ' + counts.Weak
  );

  console.log(
    '   Not scored:      ' + counts['Not AI scored']
  );

  console.log(
    '   AI scored:       ' + aiScored
  );

  console.log(
    '   Fallback scored: ' + fallbackScored
  );

  return counts;
}

// --- Print AI Candidate Results ----------------------------------------------

function printCandidateResults(jobs) {
  console.log(
    '\n?? AI CANDIDATE RESULTS'
  );

  jobs.forEach((job, index) => {
    // Candidate ranking happens before full AI/fallback enrichment.
    // Use candidateScore so the candidate list still shows a useful
    // score when AI providers are unavailable.

    const hasAiOrFallbackScore =
      job.matchScore != null ||
      job.aiScore != null ||
      job.fallbackScore != null;

    const displayJob =
      hasAiOrFallbackScore
        ? job
        : {
            ...job,
            fallbackScore:
              job.candidateScore,
          };

    const categoryResult =
      getJobCategory(
        displayJob
      );

    const score =
      categoryResult.score == null
        ? (
            job.candidateScore != null
              ? `${job.candidateScore}%`
              : 'N/A'
          )
        : `${categoryResult.score}%`;

    let source = 'N/A';

    if (
      categoryResult.source === 'AI'
    ) {
      source = 'AI';
    }
    else if (
      categoryResult.source === 'Fallback'
    ) {
      source = 'Fallback';
    }
    else if (
      job.candidateScore != null
    ) {
      source = 'Candidate';
    }

    console.log(
      `   ${index + 1}. [${source} ${score}] [${categoryResult.category}] ` +
      `${job.title} @ ${job.company || 'Unknown'}`
    );
  });
}

// --- Main -------------------------------------------------------------------


async function main() {
  console.log('\n' + '-'.repeat(60));

  console.log(
    '  ?? JOB ALERT BOT ? Starting Run'
  );

  console.log(
    '  Time: ' +
      new Date().toLocaleString(
        'en-IN',
        {
          timeZone: 'Asia/Kolkata',
        }
      ) +
      ' IST'
  );

  console.log(
    '  Mode: ' +
      (USE_SERPAPI
        ? 'FULL (SerpAPI enabled)'
        : 'FREE sources only')
  );

  console.log(
    '  Dry Run: ' +
      (DRY_RUN
        ? 'YES (no messages sent)'
        : 'NO')
  );

  if (SEED_MODE) {
    console.log(
      '  ?? SEED MODE: Cataloguing existing jobs ? NO notifications.'
    );
  }

  console.log(
    '  LLM Eval: ' +
      (USE_LLM ? 'YES' : 'OFF')
  );

  console.log(
    '  AI Candidate Limit: ' +
      AI_CANDIDATE_LIMIT +
      ' (email is NOT capped)'
  );

  console.log(
    '-'.repeat(60) + '\n'
  );

  // -- 1. Scrape ------------------------------------------------------------

  console.log(
    '?? Step 1: Scraping jobs...'
  );

  const rawJobs =
    await runAllScrapers({
      useSerpapi: USE_SERPAPI,
    });

  console.log(
    `?? Raw jobs collected: ${rawJobs.length}`
  );
    // -- Run statistics -------------------------------------------------------

  const runStats = {
    rawJobs: rawJobs.length,
    roleRelevant: 0,
    indiaRemote: 0,
    global: 0,
    preAiUnique: 0,
    aiCandidates: 0,
    aiScored: 0,
    fallbackScored: 0,
    sameRunUnique: 0,
    newJobs: 0,
    newGlobalJobs: 0,
    emailedJobs: 0,
    emailedGlobalJobs: 0,
  };

  // -- 2. Role relevance filter ---------------------------------------------

  const csJobs =
    filterJobs(rawJobs);
  
  runStats.roleRelevant = csJobs.length;

  console.log(
    `?? Step 2: After role filter: ${csJobs.length} relevant jobs`
  );

  // -- 3. Geography ---------------------------------------------------------

  const geoFiltered =
    csJobs.filter(
      passesGeoFilter
    );

  const globalJobs =
    csJobs.filter(
      passesGlobalFilter
    );
  runStats.indiaRemote = geoFiltered.length;
  runStats.global = globalJobs.length;
  console.log(
    `?? Step 3: India/Remote jobs: ${geoFiltered.length}`
  );

  console.log(
    `?? Global secondary jobs: ${globalJobs.length}`
  );

  // -- 3.4 Pre-AI deduplication ---------------------------------------------

  const preAiUniqueMap =
    new Map();

  for (const job of geoFiltered) {
    const id =
      Database.hash(job);

    if (
      !preAiUniqueMap.has(id)
    ) {
      preAiUniqueMap.set(
        id,
        job
      );
    }
  }

  const preAiUniqueJobs =
    [...preAiUniqueMap.values()];
  runStats.preAiUnique = preAiUniqueJobs.length;
  console.log(
    `Step 3.4: Pre-AI deduplication: ${preAiUniqueJobs.length}/${geoFiltered.length} unique jobs`
  );

  // -- 3.5 Pre-AI candidate ranking -----------------------------------------

  const rankedCandidates =
    rankCandidates(
      preAiUniqueJobs,
      AI_CANDIDATE_LIMIT
    );
  runStats.aiCandidates = rankedCandidates.length;
  console.log(
    `Step 3.5: Pre-AI ranking: ${rankedCandidates.length}/${preAiUniqueJobs.length} candidates selected`
  );

  rankedCandidates.forEach(
    (job, index) => {
      console.log(
        `   ${index + 1}. ` +
        `[Candidate ${job.candidateScore}] ` +
        `${job.title} @ ` +
        `${job.company || 'Unknown'}`
      );
    }
  );

  // -- 3.6 AI evaluation ----------------------------------------------------

  let evaluatedJobs =
    preAiUniqueJobs.map(
      enrichAIResult
    );

  if (
    USE_LLM &&
    !SEED_MODE &&
    rankedCandidates.length > 0
  ) {
    console.log(
      `\nStep 3.6: Running AI evaluation on ${rankedCandidates.length} candidates...`
    );

    const aiEvaluatedJobs =
      await evaluateJobs(
        rankedCandidates
      );

    const scored =
      aiEvaluatedJobs.filter(
        (job) =>
          job.matchScore != null
      );
    runStats.aiScored = scored.length;
    console.log(
      `AI scored ${scored.length}/${aiEvaluatedJobs.length} jobs`
    );

    // Merge AI results into the COMPLETE pool.

    const aiMap =
      new Map();

    for (
      const job of aiEvaluatedJobs
    ) {
      aiMap.set(
        Database.hash(job),
        enrichAIResult(job)
      );
    }

    evaluatedJobs =
      preAiUniqueJobs.map(
        (job) => {
          const aiJob =
            aiMap.get(
              Database.hash(job)
            );

          if (aiJob) {
            return enrichAIResult({
              ...job,
              ...aiJob,
            });
          }

          return enrichAIResult({
            ...job,

            matchScore: null,

            priority:
              'Not AI scored',

            aiCategory:
              'Not AI scored',

            experienceFit:
              'Not evaluated',

            aiReason:
              '',

            aiStrengths:
              [],

            aiGaps:
              [],

            coldPitch:
              '',

            aiProvider:
              'none',
          });
        }
      );

    console.log(
      `AI results merged into full pool: ${evaluatedJobs.length} jobs`
    );

    printAISummary(
      evaluatedJobs
    );

    printCandidateResults(
      aiEvaluatedJobs
    );
  }

  // -- 4. Deduplicate current run + database --------------------------------
  runStats.fallbackScored =
    evaluatedJobs.filter(
      (job) =>
        !job.aiEvaluated &&
        job.fallbackScore != null
    ).length;
  
  console.log(
    '??? Step 4: Deduplicating jobs...'
  );

  const db =
    new Database();

  db.cleanup();

  // Same-run India/Remote duplicates.

  const uniqueJobsMap =
    new Map();

  for (
    const job of evaluatedJobs
  ) {
    const id =
      Database.hash(job);

    if (
      !uniqueJobsMap.has(id)
    ) {
      uniqueJobsMap.set(
        id,
        job
      );
    }
  }

  const uniqueEvaluatedJobs =
    [...uniqueJobsMap.values()];

  // Same-run global duplicates.

  const uniqueGlobalMap =
    new Map();

  for (
    const job of globalJobs
  ) {
    const id =
      Database.hash(job);

    if (
      !uniqueGlobalMap.has(id)
    ) {
      uniqueGlobalMap.set(
        id,
        job
      );
    }
  }

  const uniqueGlobalJobs =
    [...uniqueGlobalMap.values()];

  console.log(
    `?? Same-run duplicates removed: ${
      evaluatedJobs.length -
      uniqueEvaluatedJobs.length
    } India/Remote, ${
      globalJobs.length -
      uniqueGlobalJobs.length
    } global`
  );

  // Remove jobs already seen in previous runs.

  let newJobs =
    uniqueEvaluatedJobs.filter(
      (job) =>
        db.isNew(job)
    );

  let newGlobalJobs =
    uniqueGlobalJobs.filter(
      (job) =>
        db.isNew(job)
    );

  console.log(
    `? New India/Remote jobs: ${newJobs.length}`
  );

  console.log(
    `?? New global jobs: ${newGlobalJobs.length}`
  );
  runStats.sameRunUnique =
    uniqueEvaluatedJobs.length;

  runStats.newJobs =
    newJobs.length;

  runStats.newGlobalJobs =
    newGlobalJobs.length;
  
  // -- 4.1 Resume Gap Analysis ---------------------------------------------

  console.log(
    '\n?? Step 14: Resume gap analysis...'
  );

  newJobs =
    analyzeResumeGaps(newJobs);

  newGlobalJobs =
    analyzeResumeGaps(newGlobalJobs);

  console.log(
    `   Resume gaps analysed: ${
      newJobs.length + newGlobalJobs.length
    } jobs`
  );

  // -- 4.2 Resume Tailoring Advice ------------------------------------------

  console.log(
    '?? Step 15: Resume tailoring advice...'
  );

  newJobs =
    generateResumeTailoringForJobs(newJobs);

  newGlobalJobs =
    generateResumeTailoringForJobs(newGlobalJobs);

  console.log(
    `   Resume tailoring generated: ${
      newJobs.length + newGlobalJobs.length
    } jobs`
  );

  // -- 4.3 Application Advice ----------------------------------------------

  console.log(
    '?? Step 16: Application advice...'
  );

  newJobs =
    generateApplicationAdviceForJobs(newJobs);

  newGlobalJobs =
    generateApplicationAdviceForJobs(newGlobalJobs);

  console.log(
    `   Application advice generated: ${
      newJobs.length + newGlobalJobs.length
    } jobs`
  );

  // -- 4.4 Final Job Ranking ------------------------------------------------

  console.log(
    '?? Step 17: Final job ranking...'
  );

  newJobs =
    rankJobs(newJobs);

  newGlobalJobs =
    rankJobs(newGlobalJobs);

  console.log(
    `   Final ranking complete: ${
      newJobs.length + newGlobalJobs.length
    } jobs`
  );

  if (newJobs.length > 0) {
    console.log('\n?? TOP INDIA / REMOTE JOBS');

    newJobs
      .slice(0, 10)
      .forEach((job, index) => {
        const score =
          job.matchScore != null
            ? `${job.matchScore}% AI`
            : job.fallbackScore != null
              ? `${job.fallbackScore}% fallback`
              : 'N/A';

        const category =
          job.jobCategory ||
          (
            job.fallbackScore != null
              ? (
                  job.fallbackScore >= 85
                    ? 'Excellent (fallback)'
                    : job.fallbackScore >= 70
                      ? 'Strong (fallback)'
                      : job.fallbackScore >= 55
                        ? 'Good (fallback)'
                        : job.fallbackScore >= 40
                          ? 'Possible (fallback)'
                          : 'Weak (fallback)'
                )
              : job.matchScore != null
                ? (
                    job.matchScore >= 85
                      ? 'Excellent'
                      : job.matchScore >= 70
                        ? 'Strong'
                        : job.matchScore >= 55
                          ? 'Good'
                          : job.matchScore >= 40
                            ? 'Possible'
                            : 'Weak'
                  )
                : 'Not scored'
          );

        console.log(
          `   ${index + 1}. [${score}] ` +
          `[${category}] ` +
          `[Rank ${job.finalRankScore}] ` +
          `${job.title} @ ${job.company || 'Unknown'}`
        );
      });
  }
  runStats.newJobs = newJobs.length;
  runStats.newGlobalJobs = newGlobalJobs.length;

  console.log('\n?? RUN STATISTICS');
  console.log(
    `   Raw jobs discovered:     ${runStats.rawJobs}`
  );
  console.log(
    `   Role relevant:           ${runStats.roleRelevant}`
  );
  console.log(
    `   India / Remote:          ${runStats.indiaRemote}`
  );
  console.log(
    `   Global secondary:        ${runStats.global}`
  );
  console.log(
    `   Pre-AI unique:           ${runStats.preAiUnique}`
  );
  console.log(
    `   AI candidates:            ${runStats.aiCandidates}`
  );
  console.log(
    `   AI scored:                ${runStats.aiScored}`
  );
  console.log(
    `   Fallback scored:          ${runStats.fallbackScored}`
  );
  console.log(
    `   New India / Remote:       ${runStats.newJobs}`
  );
  console.log(
    `   New global:               ${runStats.newGlobalJobs}`
  );
  // -- No new jobs ----------------------------------------------------------

  if (
    newJobs.length === 0 &&
    newGlobalJobs.length === 0
  ) {
    console.log(
      '\n?? No new jobs found.'
    );

    if (DRY_RUN) {
      console.log(
        '?? [DRY RUN] No-jobs email NOT sent.'
      );

      console.log(
        '?? [DRY RUN] Database NOT updated.'
      );
    } else {
      const emailNotifier = new EmailNotifier();

      try {
        const sent =
          await emailNotifier.send(
            [],
            []
          );

        if (sent) {
          console.log(
            '?? No-jobs notification email sent.'
          );
        } else {
          console.log(
            '?? No-jobs email not sent — email notifier is disabled.'
          );
        }
      } catch (error) {
        console.error(
          '? No-jobs email failed:',
          error.message
        );
      }

      db.save();
    }

    return;
  }

  // -- 5. Seed mode ---------------------------------------------------------

  if (SEED_MODE) {
    console.log(
      `\n?? SEED MODE: Cataloguing ${
        newJobs.length +
        newGlobalJobs.length
      } jobs...`
    );

    for (
      const job of newJobs
    ) {
      db.markSeen(job);
    }

    for (
      const job of newGlobalJobs
    ) {
      db.markSeen(job);
    }

    db.save();

    const stats =
      db.stats();

    console.log(
      `\n?? Seed complete. Database now contains ${stats.total} jobs.`
    );

    return;
  }

  // -- 5.1 Notification selection ------------------------------------------
  //
  // IMPORTANT:
  //
  // There is NO artificial email cap.
  //
  // Every new India/Remote job is included.
  //
  // Every new global job is included.
  //
  // AI candidate limit affects ONLY AI evaluation.

  const toNotify =
    [...newJobs];

  const globalToNotify =
    [...newGlobalJobs];

  console.log(
    `?? Jobs selected for email: ${toNotify.length} India/Remote + ${globalToNotify.length} global`
  );

  // -- Email category breakdown ---------------------------------------------

  printAISummary(
    toNotify
  );

  // -- 6. Send notifications -----------------------------------------------

  console.log(
    '?? Step 6: Sending notifications...'
  );

  if (!DRY_RUN) {
    const email =
      new EmailNotifier();

    const results =
      await Promise.allSettled([
        email.send(
          toNotify,
          globalToNotify,
          {
            ...runStats,
            emailedJobs: toNotify.length,
            emailedGlobalJobs: globalToNotify.length,
          }
        ),
      ]);

    const successful =
      results.filter(
        (result) =>
          result.status ===
            'fulfilled' &&
          result.value === true
      );

    const failures =
      results
        .filter(
          (result) =>
            result.status ===
            'rejected'
        )
        .map(
          (result) =>
            result.reason?.message ||
            'Unknown email error'
        );

    console.log(
      `?? Successful email notifications: ${successful.length}/1`
    );

    if (
      failures.length > 0
    ) {
      console.error(
        `? Email notification failed: ${failures.join(' | ')}`
      );
    }

    // If email failed, DO NOT mark jobs as seen.
    //
    // They will be retried next run.

    if (
      successful.length === 0
    ) {
      console.error(
        '?? Email notification was not sent.'
      );

      console.error(
        'Jobs will NOT be marked as seen and will retry next run.'
      );

      process.exit(1);
    }
  } else {
    console.log(
      '\n?? [DRY RUN] No notifications will be sent.'
    );

    console.log(
      `?? [DRY RUN] Main jobs that would be sent: ${toNotify.length}`
    );

    toNotify.forEach(
      (job, index) => {
        const walkInLabel =
          job.isWalkIn
            ? '?? WALK-IN/URGENT'
            : '';


        const scoreLabel =
          job.matchScore != null
            ? ` | AI: ${job.matchScore}%`
            : job.fallbackScore != null
              ? ` | Fallback: ${job.fallbackScore}%`
              : ' | AI: Not scored';
        const categoryLabel =
          ` | ${job.aiCategory || 'Not AI scored'}`;

        const candidateLabel =
          job.candidateScore != null
            ? ` | Candidate: ${job.candidateScore}`
            : '';

        console.log(
          `  ${index + 1}. ` +
          `${walkInLabel} ` +
          `[${job.type || 'unknown'}] ` +
          `${job.title} @ ` +
          `${job.company || 'Unknown'} | ` +
          `${job.location || 'No location'} | ` +
          `${job.source || 'Unknown source'}` +
          `${scoreLabel}` +
          `${categoryLabel}` +
          `${candidateLabel}`
        );
      }
    );

    console.log(
      `\n?? [DRY RUN] Global jobs that would be sent: ${globalToNotify.length}`
    );

    globalToNotify.forEach(
      (job, index) => {

        const scoreLabel =
          job.matchScore != null
            ? ` | AI: ${job.matchScore}%`
            : job.fallbackScore != null
              ? ` | Fallback: ${job.fallbackScore}%`
              : ' | AI: Not scored';
        const categoryLabel =
          ` | ${job.aiCategory || 'Not AI scored'}`;

        const candidateLabel =
          job.candidateScore != null
            ? ` | Candidate: ${job.candidateScore}`
            : '';

        console.log(
          `  ?? ${index + 1}. ` +
          `[${job.type || 'unknown'}] ` +
          `${job.title} @ ` +
          `${job.company || 'Unknown'} | ` +
          `${job.location || 'No location'} | ` +
          `${job.source || 'Unknown source'}` +
          `${scoreLabel}` +
          `${categoryLabel}` +
          `${candidateLabel}`
        );
      }
    );

    console.log('');
  }

  // -- 7. Update database --------------------------------------------------

  console.log(
    '??? Step 7: Updating database...'
  );

  if (!DRY_RUN) {
    for (
      const job of toNotify
    ) {
      db.markSeen(job);
    }

    for (
      const job of globalToNotify
    ) {
      db.markSeen(job);
    }

    db.save();

    console.log(
      '??? Database updated with notified jobs.'
    );
  } else {
    console.log(
      '?? [DRY RUN] Database NOT updated.'
    );
  }

  // -- 8. Final summary -----------------------------------------------------

  const stats =
    db.stats();

  console.log(
    '\n' + '='.repeat(60)
  );

  console.log(
    '  JOB ALERT BOT ? Run Complete'
  );

  console.log(
    '='.repeat(60)
  );

  console.log(
    `  Raw jobs:               ${rawJobs.length}`
  );

  console.log(
    `  Role-relevant jobs:     ${csJobs.length}`
  );

  console.log(
    `  India/Remote jobs:      ${geoFiltered.length}`
  );

  console.log(
    `  Pre-AI unique jobs:     ${preAiUniqueJobs.length}`
  );

  console.log(
    `  AI candidates:           ${rankedCandidates.length}`
  );

  const aiScoredCount =
    evaluatedJobs.filter(
      (job) =>
        job.matchScore != null
    ).length;

  console.log(
    `  AI successfully scored: ${aiScoredCount}`
  );

  console.log(
    `  New India/Remote:        ${toNotify.length}`
  );

  console.log(
    `  New Global:              ${globalToNotify.length}`
  );

  console.log(
    `  Database total:          ${stats.total}`
  );

  console.log(
    '='.repeat(60) + '\n'
  );
}

// --- Error Handling ---------------------------------------------------------

main().catch(
  (error) => {
    console.error(
      '\n?? Fatal error in main():',
      error
    );

    process.exit(1);
  }
);















