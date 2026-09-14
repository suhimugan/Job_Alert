'use strict';

/*
 * STEP 13 — JOB CATEGORIES
 *
 * AI score takes priority.
 * Fallback score is used only when AI is unavailable.
 */

function getScore(job) {
  // AI score — matchScore is the field used by llmEvaluator/main.js.
  if (
    typeof job.matchScore === 'number' &&
    Number.isFinite(job.matchScore)
  ) {
    return {
      score: job.matchScore,
      source: 'AI',
    };
  }

  // Backward-compatible AI score fields.
  if (
    typeof job.aiScore === 'number' &&
    Number.isFinite(job.aiScore)
  ) {
    return {
      score: job.aiScore,
      source: 'AI',
    };
  }

  if (
    typeof job.score === 'number' &&
    Number.isFinite(job.score)
  ) {
    return {
      score: job.score,
      source: 'AI',
    };
  }

  // Deterministic fallback score.
  if (
    typeof job.fallbackScore === 'number' &&
    Number.isFinite(job.fallbackScore)
  ) {
    return {
      score: job.fallbackScore,
      source: 'Fallback',
    };
  }

  return {
    score: null,
    source: 'None',
  };
}

function getJobCategory(job) {
  const { score, source } = getScore(job);

  if (score === null) {
    return {
      category: 'Not AI scored',
      shortCategory: 'NOT SCORED',
      score: null,
      source,
      priority: 0,
    };
  }

  if (score >= 85) {
    return {
      category: source === 'AI'
        ? 'Excellent'
        : 'Excellent (fallback)',
      shortCategory: 'EXCELLENT',
      score,
      source,
      priority: 5,
    };
  }

  if (score >= 70) {
    return {
      category: source === 'AI'
        ? 'Strong'
        : 'Strong (fallback)',
      shortCategory: 'STRONG',
      score,
      source,
      priority: 4,
    };
  }

  if (score >= 55) {
    return {
      category: source === 'AI'
        ? 'Good'
        : 'Good (fallback)',
      shortCategory: 'GOOD',
      score,
      source,
      priority: 3,
    };
  }

  if (score >= 40) {
    return {
      category: source === 'AI'
        ? 'Possible'
        : 'Possible (fallback)',
      shortCategory: 'POSSIBLE',
      score,
      source,
      priority: 2,
    };
  }

  return {
    category: source === 'AI'
      ? 'Weak'
      : 'Weak (fallback)',
    shortCategory: 'WEAK',
    score,
    source,
    priority: 1,
  };
}

function categorizeJobs(jobs) {
  return jobs.map(job => {
    const result = getJobCategory(job);

    return {
      ...job,
      jobCategory: result.category,
      categoryPriority: result.priority,
      categoryScore: result.score,
      categorySource: result.source,
    };
  });
}

function sortByCategory(jobs) {
  return [...jobs].sort((a, b) => {
    const categoryA = getJobCategory(a);
    const categoryB = getJobCategory(b);

    if (categoryB.priority !== categoryA.priority) {
      return categoryB.priority - categoryA.priority;
    }

    return (
      (categoryB.score ?? -1) -
      (categoryA.score ?? -1)
    );
  });
}

module.exports = {
  getJobCategory,
  categorizeJobs,
  sortByCategory,
};
