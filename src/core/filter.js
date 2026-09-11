'use strict';

// ─── Target Role Keywords ────────────────────────────────────────────────────

const ALLOW_KEYWORDS = [
  'bi analyst',
  'business intelligence',
  'power bi',
  'powerbi',
  'power bi developer',
  'power bi analyst',
  'bi developer',
  'bi consultant',
  'business intelligence developer',
  'business intelligence analyst',
  'data analyst',
  'data analytics',
  'data engineer',
  'azure data engineer',
  'azure data engineering',
  'dax',
  'power query',
  'azure data factory',
  'azure synapse',
];

// ─── Blocklist ───────────────────────────────────────────────────────────────

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

// ─── Experience Killers ──────────────────────────────────────────────────────

const OVER_EXPERIENCED = [
  '10+ years',
  '10 years experience',
  '10 years of experience',
  '9+ years',
  '9 years experience',
  '9 years of experience',
  '8+ years',
  '8 years experience',
  '8 years of experience',
  '7+ years',
  '7 years experience',
  '7 years of experience',
  '6+ years',
  '6 years experience',
  '6 years of experience',
  '5+ years',
  '5 years experience',
  '5 years of experience',
  'minimum 5 years',
  'at least 5 years',
];

// ─── Internship / Fresher / New-Grad Blockers ────────────────────────────────

const EARLY_CAREER_KEYWORDS = [
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
  '0-1 years',
  '0–1 years',
  '0 to 1 years',
  '0-2 years',
  '0–2 years',
  '0 to 2 years',
  '1 year experience',
  '1 year of experience',
];

// ─── Walk-in / Urgent Hiring Keywords ────────────────────────────────────────

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

// ─── Relevance Check ─────────────────────────────────────────────────────────

function isRelevant(job) {
  const titleOnly = (job.title || '').toLowerCase().trim();

  const fullText =
    `${job.title || ''} ${job.description || ''}`.toLowerCase();

  // Title must contain at least one target role/skill.
  const hasTargetRole = ALLOW_KEYWORDS.some((keyword) =>
    titleOnly.includes(keyword)
  );

  if (!hasTargetRole) {
    return false;
  }

  // Reject clearly unrelated roles.
  const isBlocked = BLOCK_KEYWORDS.some((keyword) =>
    titleOnly.includes(keyword)
  );

  if (isBlocked) {
    return false;
  }

  // Reject internships, fresher and new-grad roles.
  const isEarlyCareer = EARLY_CAREER_KEYWORDS.some((keyword) =>
    fullText.includes(keyword)
  );

  if (isEarlyCareer) {
    return false;
  }

  // Reject clearly senior roles requiring 5+ years.
  const isTooSenior = OVER_EXPERIENCED.some((keyword) =>
    fullText.includes(keyword)
  );

  if (isTooSenior) {
    return false;
  }

  return true;
}

// ─── Detect Job Type ─────────────────────────────────────────────────────────

function detectJobType(job) {
  const text =
    `${job.title || ''} ${job.description || ''}`.toLowerCase();

  if (
    text.includes('intern') ||
    text.includes('internship') ||
    text.includes('trainee')
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

// ─── Filter and Enrich Jobs ──────────────────────────────────────────────────

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
      const fullText =
        `${job.title || ''} ${job.description || ''}`.toLowerCase();

      return {
        ...job,

        type:
          job.type ||
          detectJobType(job),

        isWalkIn:
          WALK_IN_KEYWORDS.some((keyword) =>
            fullText.includes(keyword)
          ),
      };
    });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  filterJobs,
  isRelevant,
  detectJobType,
};