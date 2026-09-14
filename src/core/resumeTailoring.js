'use strict';

/*
 * STEP 15 — RESUME TAILORING ADVICE
 *
 * Generates safe, evidence-based resume tailoring suggestions.
 * It does NOT invent experience or automatically modify the resume.
 */

const { analyzeResumeGap } = require('./resumeGapAnalysis');

function unique(values) {
  return [...new Set(values)];
}

function buildSuggestions(job, gap) {
  const suggestions = [];

  const matched = gap.matchedSkills || [];
  const missing = gap.missingSkills || [];

  if (matched.length > 0) {
    suggestions.push(
      `Emphasize existing skills relevant to this role: ${matched.slice(0, 6).join(', ')}.`
    );
  }

  if (
    matched.some(skill =>
      ['power bi', 'dax', 'power query'].includes(
        String(skill).toLowerCase()
      )
    )
  ) {
    suggestions.push(
      'Prioritize Power BI/DAX/Power Query experience near the top of the resume for this role.'
    );
  }

  if (
    matched.some(skill =>
      ['azure', 'azure data factory', 'azure synapse'].includes(
        String(skill).toLowerCase()
      )
    )
  ) {
    suggestions.push(
      'Highlight Azure data engineering, ETL, pipelines, ADF, and Synapse work where it is genuinely supported by your experience.'
    );
  }

  if (
    matched.some(skill =>
      ['sql', 'etl', 'data engineering', 'data pipelines'].includes(
        String(skill).toLowerCase()
      )
    )
  ) {
    suggestions.push(
      'Make SQL, ETL, data pipelines, and data-engineering responsibilities prominent in relevant experience/project bullets.'
    );
  }

  if (missing.length > 0) {
    suggestions.push(
      `Do not claim missing technologies (${missing.slice(0, 6).join(', ')}) unless you have actual project or professional experience with them.`
    );
  }

  if (gap.gapLevel === 'None') {
    suggestions.push(
      'No obvious technology gap was detected from the available job description.'
    );
  }

  if (gap.gapLevel === 'Significant') {
    suggestions.push(
      'Review this role carefully before tailoring; several required technologies appear outside the current resume profile.'
    );
  }

  return unique(suggestions);
}

function generateResumeTailoring(job) {
  const analyzed = analyzeResumeGap(job);
  const gap = analyzed.resumeGap;

  return {
    ...analyzed,

    resumeTailoring: {
      suggestions: buildSuggestions(job, gap),
      safeToTailor: gap.gapLevel !== 'Significant',
    },
  };
}

function generateResumeTailoringForJobs(jobs) {
  return jobs.map(generateResumeTailoring);
}

module.exports = {
  generateResumeTailoring,
  generateResumeTailoringForJobs,
};
