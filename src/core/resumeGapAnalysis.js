'use strict';

/*
 * STEP 14 — RESUME GAP ANALYSIS
 *
 * Compares the job requirements against the user's resume profile.
 * This is advisory only — it must never invent experience.
 */

const fs = require('fs');
const path = require('path');

const PROFILE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'resume_profile.json'
);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadProfile() {
  try {
    return JSON.parse(
      fs.readFileSync(PROFILE_PATH, 'utf8')
    );
  } catch (err) {
    console.warn(
      '[GapAnalysis] Could not load resume profile:',
      err.message
    );

    return {
      coreStack: [],
      interests: [],
      targetRoles: [],
    };
  }
}

function unique(values) {
  return [...new Set(values)];
}

function buildProfileText(profile) {
  return normalize([
    ...(profile.coreStack || []),
    ...(profile.interests || []),
    ...(profile.targetRoles || []),
    profile.education || '',
    profile.experienceLevel || '',
  ].join(' '));
}

function extractRelevantSkills(job) {
  const profile = loadProfile();

  const knownSkills = unique([
    ...(profile.coreStack || []),
    ...(profile.interests || []),
  ]);

  const jobText = normalize(
    `${job.title || ''} ${job.description || ''} ${job.skills || ''}`
  );

  return knownSkills.filter(skill =>
    jobText.includes(normalize(skill))
  );
}

function extractMissingSkills(job) {
  const profile = loadProfile();
  const profileText = buildProfileText(profile);

  const skillCandidates = [
    'python',
    'pyspark',
    'spark',
    'databricks',
    'snowflake',
    'dbt',
    'airflow',
    'aws',
    'gcp',
    'microsoft fabric',
    'fabric',
    'azure data factory',
    'azure synapse',
    'azure data lake',
    'data lake',
    'power bi',
    'dax',
    'power query',
    'sql',
    'excel',
    'etl',
    'data pipelines',
    'data warehousing',
    'tableau',
    'power apps',
    'power automate',
    'machine learning',
    'generative ai',
    'rag',
    'llm',
  ];

  const jobText = normalize(
    `${job.title || ''} ${job.description || ''} ${job.skills || ''}`
  );

  return skillCandidates.filter(skill => {
    const required = jobText.includes(skill);
    const alreadyKnown = profileText.includes(skill);

    return required && !alreadyKnown;
  });
}

function determineGapLevel(missingSkills) {
  if (missingSkills.length === 0) {
    return 'None';
  }

  if (missingSkills.length >= 4) {
    return 'Significant';
  }

  if (missingSkills.length >= 2) {
    return 'Moderate';
  }

  return 'Minor';
}

function analyzeResumeGap(job) {
  const matchedSkills = extractRelevantSkills(job);
  const missingSkills = extractMissingSkills(job);

  return {
    ...job,

    resumeGap: {
      matchedSkills,
      missingSkills,
      gapLevel: determineGapLevel(missingSkills),
      matchedSkillCount: matchedSkills.length,
      missingSkillCount: missingSkills.length,
    },
  };
}

function analyzeResumeGaps(jobs) {
  return jobs.map(analyzeResumeGap);
}

module.exports = {
  analyzeResumeGap,
  analyzeResumeGaps,
};
