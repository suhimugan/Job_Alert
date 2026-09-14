'use strict';

/*
 * STEP 17 — FINAL JOB RANKING
 *
 * Final ranking combines:
 * - AI/fallback match score
 * - candidate score
 * - category
 * - resume gap
 * - walk-in / urgency
 * - source quality
 *
 * This does NOT limit the number of jobs.
 */

function getMatchScore(job) {
  if (
    typeof job.matchScore === 'number' &&
    Number.isFinite(job.matchScore)
  ) {
    return {
      score: job.matchScore,
      source: 'AI',
    };
  }

  if (
    typeof job.fallbackScore === 'number' &&
    Number.isFinite(job.fallbackScore)
  ) {
    return {
      score: job.fallbackScore,
      source: 'Fallback',
    };
  }

  if (
    typeof job.categoryScore === 'number' &&
    Number.isFinite(job.categoryScore)
  ) {
    return {
      score: job.categoryScore,
      source: job.categorySource || 'Fallback',
    };
  }

  return {
    score: 0,
    source: 'None',
  };
}

function categoryBonus(job) {
  const category = String(
    job.aiCategory ||
    job.jobCategory ||
    ''
  ).toLowerCase();

  if (category.includes('excellent')) return 12;
  if (category.includes('strong')) return 9;
  if (category.includes('good')) return 6;
  if (category.includes('possible')) return 3;

  return 0;
}

function candidateBonus(job) {
  const score = Number(job.candidateScore);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.min(10, Math.max(0, score / 10));
}

function urgencyBonus(job) {
  if (job.isWalkIn) {
    return 8;
  }

  const text = String(
    `${job.title || ''} ${job.description || ''}`
  ).toLowerCase();

  if (
    text.includes('immediate joining') ||
    text.includes('immediate joiner') ||
    text.includes('immediate join')
  ) {
    return 5;
  }

  if (
    text.includes('urgent hiring') ||
    text.includes('urgent requirement')
  ) {
    return 3;
  }

  return 0;
}

function gapPenalty(job) {
  const level = String(
    job.resumeGap?.gapLevel || ''
  ).toLowerCase();

  if (level === 'significant') return 8;
  if (level === 'moderate') return 4;
  if (level === 'minor') return 1;

  return 0;
}

function sourceBonus(job) {
  const source = String(job.source || '').toLowerCase();

  if (
    source.includes('naukri') ||
    source.includes('linkedin')
  ) {
    return 3;
  }

  if (
    source.includes('remoteok') ||
    source.includes('weworkremotely') ||
    source.includes('remotive')
  ) {
    return 2;
  }

  return 1;
}

function calculateFinalRankScore(job) {
  const match = getMatchScore(job);

  const raw =
    match.score +
    categoryBonus(job) +
    candidateBonus(job) +
    urgencyBonus(job) +
    sourceBonus(job) -
    gapPenalty(job);

  return Math.max(
    0,
    Math.min(120, Math.round(raw))
  );
}

function rankJob(job) {
  const match = getMatchScore(job);

  return {
    ...job,

    finalRankScore: calculateFinalRankScore(job),

    finalRankBreakdown: {
      matchScore: match.score,
      scoreSource: match.source,
      categoryBonus: categoryBonus(job),
      candidateBonus: candidateBonus(job),
      urgencyBonus: urgencyBonus(job),
      sourceBonus: sourceBonus(job),
      gapPenalty: gapPenalty(job),
    },
  };
}

function rankJobs(jobs) {
  return jobs
    .map(rankJob)
    .sort((a, b) => {
      if (b.finalRankScore !== a.finalRankScore) {
        return b.finalRankScore - a.finalRankScore;
      }

      const bMatch = getMatchScore(b).score;
      const aMatch = getMatchScore(a).score;

      if (bMatch !== aMatch) {
        return bMatch - aMatch;
      }

      const bCandidate =
        Number(b.candidateScore) || 0;

      const aCandidate =
        Number(a.candidateScore) || 0;

      return bCandidate - aCandidate;
    });
}

module.exports = {
  getMatchScore,
  calculateFinalRankScore,
  rankJob,
  rankJobs,
};
