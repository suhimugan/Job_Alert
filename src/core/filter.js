'use strict';

// ── Target Role / Skill Keywords ─────────────────────────────────────────────

const ALLOW_KEYWORDS = [
  'bi analyst',
  'business intelligence',
  'business intelligence analyst',
  'business intelligence developer',
  'business intelligence engineer',
  'power bi',
  'powerbi',
  'power bi developer',
  'power bi analyst',
  'power bi consultant',
  'bi developer',
  'bi consultant',
  'data analyst',
  'data analytics',
  'data engineer',
  'data engineering',
  'azure data engineer',
  'azure data engineering',
  'azure data factory',
  'azure synapse',
  'analytics engineer',
  'dax',
  'power query',
  'etl',
];

// ── Clearly Unrelated Roles ──────────────────────────────────────────────────

const BLOCK_KEYWORDS = [
  'sales executive',
  'sales manager',
  'sales representative',
  'sales associate',
  'marketing manager',
  'digital marketing',
  'financial analyst',
  'hr executive',
  'human resources',
  'legal counsel',
  'operations manager',
  'project manager',
  'product manager',
  'content writer',
  'graphic designer',
  'ui/ux designer',
  'customer success',
  'customer support',
  'account manager',
  'account executive',
  'recruiter',
  'talent acquisition',
  'mechanical engineer',
  'civil engineer',
  'electrical engineer',
  'hardware engineer',
  'supply chain',
  'logistics coordinator',
];

// ── Early Career / Internship Blockers ───────────────────────────────────────
//
// These are checked primarily against the title.
// We do NOT reject a job merely because its description mentions
// internship/trainee/etc. as part of general company text.

const EARLY_CAREER_TITLE_KEYWORDS = [
  'intern',
  'internship',
  'trainee',
  'fresher',
  'freshers',
  'new grad',
  'new graduate',
  'graduate trainee',
  'campus hiring',
  'campus hire',
  'entry level',
  'entry-level',
];

// ── Walk-in / Urgent Hiring Keywords ─────────────────────────────────────────

const WALK_IN_KEYWORDS = [
  'walk-in',
  'walk in',
  'walk-in interview',
  'walk in interview',
  'walk-in drive',
  'walk in drive',
  'hiring drive',
  'hiring drives',
  'job drive',
  'open interview',
  'open interviews',
  'immediate joining',
  'urgent hiring',
  'mass hiring',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text, keywords) {
  return keywords.some((keyword) =>
    text.includes(normalizeText(keyword))
  );
}

// ── Relevance Check ──────────────────────────────────────────────────────────

function isRelevant(job) {
  const title = normalizeText(job.title);
  const description = normalizeText(job.description);

  if (!title) {
    return false;
  }

  // Title is the strongest signal.
  const titleHasTarget = containsAny(title, ALLOW_KEYWORDS);

  // Description is a secondary discovery signal.
  // Require multiple strong technical signals when the title itself
  // does not clearly identify the target role.
  const descriptionMatches = ALLOW_KEYWORDS.filter((keyword) =>
    description.includes(normalizeText(keyword))
  );

  const descriptionHasTarget =
    descriptionMatches.length >= 2;

  if (!titleHasTarget && !descriptionHasTarget) {
    return false;
  }

  // Reject clearly unrelated titles.
  if (containsAny(title, BLOCK_KEYWORDS)) {
    return false;
  }

  // Reject roles explicitly advertised as internship/fresher/new-grad
  // when the title itself identifies them that way.
  if (containsAny(title, EARLY_CAREER_TITLE_KEYWORDS)) {
    return false;
  }

  // IMPORTANT:
  // Do NOT reject 5+, 6+, 7+, 8+, 9+, 10+ year roles here.
  // Seniority and actual fit will be evaluated later by Gemini.

  return true;
}

// ── Detect Job Type ───────────────────────────────────────────────────────────

function detectJobType(job) {
  const title = normalizeText(job.title);
  const text = normalizeText(
    `${job.title || ''} ${job.description || ''}`
  );

  if (
    containsAny(title, [
      'intern',
      'internship',
      'trainee',
      'fresher',
      'new grad',
    ])
  ) {
    return 'internship';
  }

  if (
    text.includes('contract') ||
    text.includes('freelance') ||
    text.includes('part-time')
  ) {
    return 'contract';
  }

  return 'fulltime';
}

// ── Filter and Enrich Jobs ────────────────────────────────────────────────────

function filterJobs(jobs) {
  return jobs
    .filter(
      (job) =>
        job &&
        job.title &&
        job.url
    )
    .filter(isRelevant)
    .map((job) => {
      const fullText = normalizeText(
        `${job.title || ''} ${job.description || ''}`
      );

      return {
        ...job,

        type:
          job.type ||
          detectJobType(job),

        isWalkIn:
          Boolean(job.isWalkIn) ||
          containsAny(
            normalizeText(job.title),
            WALK_IN_KEYWORDS
          ),
      };
    });
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  filterJobs,
  isRelevant,
  detectJobType,
};

