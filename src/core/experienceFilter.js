'use strict';

const EARLY_CAREER_KEYWORDS = [
  'fresher',
  'freshers',
  'new grad',
  'new graduate',
  'entry level',
  'entry-level',
  'intern',
  'internship',
  'trainee',
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExperienceRange(job) {
  const text = normalize(
    `${job.title || ''} ${job.experience || ''} ${job.description || ''}`
  );

  // Examples:
  // 2-3 years
  // 3 - 5 yrs
  // 5+ years
  // 8+ yrs
  const range = text.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (range) {
    return {
      min: Number(range[1]),
      max: Number(range[2]),
      stated: true,
    };
  }

  const plus = text.match(
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i
  );

  if (plus) {
    return {
      min: Number(plus[1]),
      max: null,
      stated: true,
    };
  }

  const single = text.match(
    /(?:minimum|min|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (single) {
    return {
      min: Number(single[1]),
      max: null,
      stated: true,
    };
  }

  return {
    min: null,
    max: null,
    stated: false,
  };
}

function isEarlyCareer(job) {
  const title = normalize(job.title);

  return EARLY_CAREER_KEYWORDS.some((keyword) =>
    title.includes(keyword)
  );
}

function passesExperienceFilter(job) {
  if (!job || !job.title) {
    return false;
  }

  if (isEarlyCareer(job)) {
    return false;
  }

  const experience = extractExperienceRange(job);

  // No stated experience:
  // keep it and let later AI evaluation judge it.
  if (!experience.stated) {
    return true;
  }

  // Explicitly below 2 years.
  if (
    experience.max !== null &&
    experience.max < 2
  ) {
    return false;
  }

  // 1+ / 1-3 / 1-5 etc.:
  // keep because the upper range may still fit.
  if (
    experience.min !== null &&
    experience.min >= 2
  ) {
    return true;
  }

  if (
    experience.min !== null &&
    experience.min < 2 &&
    experience.max !== null &&
    experience.max >= 2
  ) {
    return true;
  }

  // Unknown/ambiguous: keep.
  return true;
}

function filterByExperience(jobs) {
  return jobs.filter(passesExperienceFilter);
}

module.exports = {
  extractExperienceRange,
  isEarlyCareer,
  passesExperienceFilter,
  filterByExperience,
};
