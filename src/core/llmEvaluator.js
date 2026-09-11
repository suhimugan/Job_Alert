'use strict';

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Candidate profile
// ─────────────────────────────────────────────────────────────────────────────

const PROFILE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'resume_profile.json'
);

let candidateProfile;

try {
  candidateProfile = JSON.parse(
    fs.readFileSync(PROFILE_PATH, 'utf8')
  );
} catch (error) {
  console.warn(
    '[LLM] Could not load resume_profile.json — using fallback profile.'
  );

  candidateProfile = {
    name: 'Candidate',
    education: 'MTech in Data Science, BTech in Information Technology',

    coreStack: [
      'Power BI',
      'DAX',
      'Power Query',
      'SQL',
      'Microsoft Excel',
      'Azure',
      'Azure Data Factory',
      'Azure Synapse Analytics',
      'Data Engineering',
      'Data Analysis',
      'Business Intelligence',
      'ETL',
      'Data Visualization',
    ],

    interests: [
      'Business Intelligence',
      'Power BI',
      'Data Analytics',
      'Azure Data Engineering',
      'Data Engineering',
      'Data Visualization',
      'ETL',
      'Data Pipelines',
    ],

    targetRoles: [
      'BI Analyst',
      'Business Intelligence Analyst',
      'Power BI Analyst',
      'Power BI Developer',
      'Power BI Consultant',
      'Data Analyst',
      'Azure Data Engineer',
      'Data Engineer',
      'BI Developer',
      'Business Intelligence Developer',
    ],

    targetLocations: [
      'India',
      'Remote',
      'Work From Home',
    ],

    experienceLevel: '2-3 years / Mid-level / 2+ years',
  };
}

const PROFILE_SUMMARY = `
Candidate:
${candidateProfile.name}

Education:
${candidateProfile.education || 'Not specified'}

Core Skills:
${(candidateProfile.coreStack || []).join(', ')}

Interests:
${(candidateProfile.interests || []).join(', ')}

Target Roles:
${(candidateProfile.targetRoles || []).join(', ')}

Target Locations:
${(candidateProfile.targetLocations || []).join(', ')}

Target Experience:
${candidateProfile.experienceLevel || '2-3 years / Mid-level / 2+ years'}
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function cleanText(value, maxLength) {
  if (!value) return '';

  return String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate one job
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateSingleJob(ai, job) {
  const prompt = `
You are an expert technical recruiter and job-matching system.

Your job is to evaluate whether the following job is a strong match for the candidate.

CANDIDATE PROFILE
─────────────────
${PROFILE_SUMMARY}

JOB LISTING
───────────
Title: ${job.title || 'Unknown'}
Company: ${job.company || 'Unknown'}
Location: ${job.location || 'Not specified'}
Job Type: ${job.type || 'Unknown'}
Source: ${job.source || 'Unknown'}
Posted: ${job.postedAt || 'Unknown'}

Description:
${(job.description || 'No description available').slice(0, 2500)}

MATCHING RULES
──────────────
Score the job from 0 to 100.

IMPORTANT PRIORITIES:

1. Target roles are:
   - BI Analyst
   - Business Intelligence Analyst
   - Power BI Analyst
   - Power BI Developer
   - Power BI Consultant
   - Data Analyst
   - Azure Data Engineer
   - Data Engineer
   - BI Developer
   - Business Intelligence Developer

2. Strong positive signals:
   - Power BI
   - DAX
   - Power Query
   - SQL
   - Azure
   - Azure Data Factory
   - Azure Synapse
   - ETL / ELT
   - Data pipelines
   - Business Intelligence
   - Data Analytics
   - Data Visualization

3. EXPERIENCE FIT IS VERY IMPORTANT:
   - 2-3 years = ideal
   - 2+ years = strong
   - 3-4 years = acceptable
   - 0-1 years = poor fit
   - 0-2 years = poor fit
   - Fresher / Internship / Graduate / Trainee = poor fit
   - 5+ years = poor fit
   - 6+ years = very poor fit

4. Penalize jobs that are primarily:
   - Sales
   - Marketing
   - HR
   - Finance
   - Customer Support
   - Project Management
   - Product Management
   - Mechanical/Civil/Electrical engineering
   - unrelated software engineering

5. Location:
   - India = strong positive
   - Remote / Work From Home = strong positive
   - Other locations = lower score unless the company/job is exceptionally relevant

6. Do NOT reward a job simply because it contains generic words such as:
   "data", "technology", "analytics", or "SQL".
   The actual role and responsibilities must be relevant.

7. A Power BI / BI / Data Analyst role with 2-3 years experience should generally score
   significantly higher than an unrelated data/software role.

8. A job requiring 5+ years should generally score below 50 even if the technical stack is excellent.

9. A fresher/internship/trainee role should generally score below 40.

10. Be conservative. Only give 80+ when the role is genuinely a strong match.

SCORING GUIDANCE
────────────────
90-100 = Excellent match
80-89  = Strong match
70-79  = Good match
60-69  = Moderate match
40-59  = Weak match
0-39   = Poor match

Return ONLY valid JSON.

Use exactly this schema:

{
  "matchScore": 85,
  "reason": "One concise sentence explaining the score.",
  "coldPitch": "Two short sentences the candidate could send to a recruiter."
}
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text =
      typeof response.text === 'function'
        ? response.text()
        : response.text;

    const result = JSON.parse(text);

    return {
      ...job,

      matchScore: clampScore(result.matchScore),

      aiReason: cleanText(
        result.reason ||
          'AI evaluation completed.',
        250
      ),

      coldPitch: cleanText(
        result.coldPitch || '',
        350
      ),
    };
  } catch (error) {
    console.warn(
      `[LLM] Failed to evaluate "${job.title}" @ ${job.company}: ${
        error.message
      }`
    );

    // Graceful degradation:
    // If Gemini fails, keep the original job.
    return job;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluate all jobs
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateJobs(jobs) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn(
      '[LLM] GEMINI_API_KEY not set — skipping LLM evaluation.'
    );

    return jobs;
  }

  if (!Array.isArray(jobs) || jobs.length === 0) {
    console.log('[LLM] No jobs to evaluate.');

    return jobs || [];
  }

  const ai = new GoogleGenAI({
    apiKey,
  });

  const evaluated = [];

  console.log(
    `\n🧠 [LLM] Evaluating ${jobs.length} jobs against candidate profile...`
  );

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    console.log(
      `[LLM] ${i + 1}/${jobs.length}: "${job.title}" @ ${
        job.company || 'Unknown'
      }`
    );

    const result = await evaluateSingleJob(ai, job);

    evaluated.push(result);

    if (result.matchScore != null) {
      console.log(
        `[LLM]   → Score: ${result.matchScore}% | ${
          result.aiReason || 'No reason returned'
        }`
      );
    }

    // Small delay between requests.
    if (i < jobs.length - 1) {
      await sleep(500);
    }
  }

  const scored = evaluated.filter(
    (job) => job.matchScore != null
  );

  console.log(
    `\n🧠 [LLM] Scored ${scored.length}/${jobs.length} jobs.`
  );

  if (scored.length > 0) {
    const average = Math.round(
      scored.reduce(
        (sum, job) => sum + job.matchScore,
        0
      ) / scored.length
    );

    const excellent = scored.filter(
      (job) => job.matchScore >= 90
    ).length;

    const strong = scored.filter(
      (job) => job.matchScore >= 80
    ).length;

    console.log(
      `[LLM] Average score: ${average}%`
    );

    console.log(
      `[LLM] Excellent matches (90+): ${excellent}`
    );

    console.log(
      `[LLM] Strong matches (80+): ${strong}`
    );
  }

  return evaluated;
}

module.exports = {
  evaluateJobs,
};