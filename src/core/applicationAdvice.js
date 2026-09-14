'use strict';

/*
 * STEP 16 — APPLICATION ADVICE
 *
 * Generates safe, job-specific application guidance.
 * Never invents experience or skills.
 */

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function generateApplicationAdvice(job) {
  const category = normalize(
    job.aiCategory || job.jobCategory || ''
  );

  const score =
    typeof job.matchScore === 'number'
      ? job.matchScore
      : typeof job.fallbackScore === 'number'
        ? job.fallbackScore
        : null;

  const matchedSkills = unique(
    job.fallbackMatchedSkills ||
    job.resumeGap?.matchedSkills ||
    []
  );

  const missingSkills = unique(
    job.resumeGap?.missingSkills ||
    []
  );

  const title = job.title || 'this role';
  const company = job.company || 'the company';

  const strengths = [];

  if (
    matchedSkills.some(skill =>
      normalize(skill).includes('power bi')
    )
  ) {
    strengths.push('Power BI');
  }

  if (
    matchedSkills.some(skill =>
      ['dax', 'power query'].includes(normalize(skill))
    )
  ) {
    strengths.push('DAX / Power Query');
  }

  if (
    matchedSkills.some(skill =>
      ['sql', 'etl', 'data engineering', 'data pipelines']
        .includes(normalize(skill))
    )
  ) {
    strengths.push('SQL / ETL / data engineering');
  }

  if (
    matchedSkills.some(skill =>
      ['azure', 'azure data factory', 'azure synapse']
        .includes(normalize(skill))
    )
  ) {
    strengths.push('Azure data engineering');
  }

  if (strengths.length === 0 && matchedSkills.length > 0) {
    strengths.push(...matchedSkills.slice(0, 4));
  }

  const priority =
    category.includes('excellent') || (score !== null && score >= 85)
      ? 'High'
      : category.includes('strong') || (score !== null && score >= 70)
        ? 'High'
        : category.includes('good') || (score !== null && score >= 55)
          ? 'Medium'
          : 'Low';

  const applicationMessage =
    `Hi, I’m interested in the ${title} opportunity at ${company}. ` +
    `My background in ${strengths.length > 0 ? strengths.join(', ') : 'data and business intelligence'} ` +
    `aligns well with the requirements of this role. ` +
    `I would be glad to discuss how my experience can contribute to the team.`;

  const suggestions = [];

  if (strengths.length > 0) {
    suggestions.push(
      `Lead with your experience in ${strengths.join(', ')}.`
    );
  }

  if (job.isWalkIn) {
    suggestions.push(
      'This appears to be a walk-in role; prioritize the application and verify the interview date, venue, and required documents.'
    );
  }

  if (
    normalize(job.title).includes('immediate') ||
    normalize(job.description).includes('immediate join')
  ) {
    suggestions.push(
      'The posting indicates urgency/immediate joining; mention your availability only if accurate.'
    );
  }

  if (missingSkills.length > 0) {
    suggestions.push(
      `Do not claim experience with ${missingSkills.slice(0, 5).join(', ')} unless you genuinely have it.`
    );
  }

  return {
    ...job,

    applicationAdvice: {
      priority,
      strengths,
      suggestions: unique(suggestions),
      applicationMessage,
      missingSkills,
    },
  };
}

function generateApplicationAdviceForJobs(jobs) {
  return jobs.map(generateApplicationAdvice);
}

module.exports = {
  generateApplicationAdvice,
  generateApplicationAdviceForJobs,
};
