'use strict';

/*
 * STEP 12 — MATCH SCORING
 *
 * Deterministic fallback scoring used when the LLM is unavailable.
 *
 * This does NOT replace AI scoring.
 * It gives every job a useful baseline score so the pipeline
 * can still rank and categorize jobs during provider outages.
 */

const PROFILE = {
  skills: [
    'power bi',
    'powerbi',
    'dax',
    'power query',
    'sql',
    'microsoft excel',
    'excel',
    'azure',
    'azure data factory',
    'adf',
    'azure synapse',
    'synapse',
    'data engineering',
    'data analysis',
    'business intelligence',
    'etl',
    'data visualization',
    'data pipelines',
  ],

  targetRoles: [
    'bi analyst',
    'business intelligence analyst',
    'power bi analyst',
    'power bi developer',
    'power bi consultant',
    'data analyst',
    'data engineer',
    'azure data engineer',
    'azure data engineering',
    'bi developer',
    'business intelligence developer',
    'analytics engineer',
  ],

  locations: [
    'india',
    'remote',
    'work from home',
    'wfh',
  ],
};

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function contains(text, value) {
  return text.includes(normalize(value));
}

function unique(values) {
  return [...new Set(values)];
}

/**
 * Score the title separately because title relevance
 * is much stronger than a random keyword in the description.
 */
function scoreTitle(job) {
  const title = normalize(job.title);

  if (!title) return 0;

  let score = 0;

  for (const role of PROFILE.targetRoles) {
    if (contains(title, role)) {
      score += 35;
      break;
    }
  }

  // Strong Power BI signal
  if (contains(title, 'power bi') || contains(title, 'powerbi')) {
    score += 15;
  }

  // Strong BI signal
  if (
    contains(title, 'business intelligence') ||
    contains(title, 'bi developer') ||
    contains(title, 'bi analyst')
  ) {
    score += 10;
  }

  // Data engineering signal
  if (
    contains(title, 'data engineer') ||
    contains(title, 'azure data engineer')
  ) {
    score += 10;
  }

  // Analyst signal
  if (contains(title, 'data analyst')) {
    score += 8;
  }

  return Math.min(score, 60);
}

function scoreSkills(job) {
  const text = normalize(
    `${job.title || ''} ${job.description || ''} ${job.skills || ''}`
  );

  const matchedSkills = PROFILE.skills.filter(skill =>
    contains(text, skill)
  );

  /*
   * Up to 25 points.
   * More matching skills = stronger technical alignment.
   */
  const skillScore = Math.min(
    matchedSkills.length * 3,
    25
  );

  return {
    score: skillScore,
    matchedSkills,
  };
}

function scoreExperience(job) {
  const text = normalize(
    `${job.title || ''} ${job.experience || ''} ${job.description || ''}`
  );

  // Explicit fresher / internship signals
  if (
    /\b(fresher|freshers|intern|internship|trainee|new grad|new graduate)\b/i.test(
      text
    )
  ) {
    return 0;
  }

  // 2+ years is acceptable.
  const range = text.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);

    if (max < 2) return 0;
    if (min >= 2) return 15;

    return 10;
  }

  const plus = text.match(
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i
  );

  if (plus) {
    return Number(plus[1]) >= 2 ? 15 : 5;
  }

  /*
   * No experience stated:
   * do not punish the job heavily.
   * The LLM can make the final decision later.
   */
  return 8;
}

function scoreLocation(job) {
  const location = normalize(job.location);

  if (!location) return 5;

  if (
    location.includes('remote') ||
    location.includes('work from home') ||
    location.includes('wfh')
  ) {
    return 10;
  }

  if (
    location.includes('india') ||
    location.includes('bangalore') ||
    location.includes('bengaluru') ||
    location.includes('hyderabad') ||
    location.includes('chennai') ||
    location.includes('mumbai') ||
    location.includes('pune') ||
    location.includes('delhi') ||
    location.includes('gurugram') ||
    location.includes('gurgaon') ||
    location.includes('noida') ||
    location.includes('kochi') ||
    location.includes('trivandrum')
  ) {
    return 10;
  }

  return 3;
}

function calculateMatchScore(job) {
  const titleScore = scoreTitle(job);
  const skillResult = scoreSkills(job);
  const experienceScore = scoreExperience(job);
  const locationScore = scoreLocation(job);

  const rawScore =
    titleScore +
    skillResult.score +
    experienceScore +
    locationScore;

  const score = Math.max(
    0,
    Math.min(100, rawScore)
  );

  return {
    score,
    matchedSkills: unique(skillResult.matchedSkills),
    breakdown: {
      title: titleScore,
      skills: skillResult.score,
      experience: experienceScore,
      location: locationScore,
    },
  };
}

function applyFallbackMatchScore(job) {
  const result = calculateMatchScore(job);

  return {
    ...job,

    fallbackScore: result.score,
    fallbackMatchedSkills: result.matchedSkills,
    fallbackScoreBreakdown: result.breakdown,
  };
}

function scoreJobs(jobs) {
  return jobs.map(applyFallbackMatchScore);
}

module.exports = {
  calculateMatchScore,
  applyFallbackMatchScore,
  scoreJobs,
};
