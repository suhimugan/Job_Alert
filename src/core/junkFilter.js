'use strict';

const JUNK_TITLE_KEYWORDS = [
  'course',
  'courses',
  'training',
  'certification',
  'tutorial',
  'bootcamp',
  'salary guide',
  'salary comparison',
  'salary checker',
  'company reviews',
  'job reviews',
  'interview questions',
  'interview preparation',
  'how to become',
  'career guide',
  'career advice',
  'resume tips',
];

const JUNK_URL_KEYWORDS = [
  '/blog/',
  '/blogs/',
  '/article/',
  '/articles/',
  '/course/',
  '/courses/',
  '/training/',
  '/salary/',
  '/reviews/',
  '/interview-questions/',
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkJob(job) {
  if (!job || !job.title || !job.url) {
    return true;
  }

  const title = normalize(job.title);
  const description = normalize(job.description);
  const url = normalize(job.url);

  // Reject obvious non-job titles.
  if (
    JUNK_TITLE_KEYWORDS.some((keyword) =>
      title.includes(keyword)
    )
  ) {
    return true;
  }

  // Reject obvious non-job URLs.
  if (
    JUNK_URL_KEYWORDS.some((keyword) =>
      url.includes(keyword)
    )
  ) {
    return true;
  }


  return false;
}

function filterJunkJobs(jobs) {
  return jobs.filter((job) => !isJunkJob(job));
}

module.exports = {
  isJunkJob,
  filterJunkJobs,
};
