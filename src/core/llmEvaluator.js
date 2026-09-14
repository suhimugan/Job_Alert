'use strict';

const fs = require('fs');
const path = require('path');

const GROQ_URL =
  'https://api.groq.com/openai/v1/chat/completions';

const OPENROUTER_URL =
  'https://openrouter.ai/api/v1/chat/completions';

const GROQ_MODEL =
  'openai/gpt-oss-20b';

const OPENROUTER_MODEL =
  'openrouter/free';

const PROFILE_PATH =
  path.join(
    __dirname,
    '..',
    '..',
    'data',
    'resume_profile.json'
  );

// Provider circuit breakers.
// Once a provider is known to be unavailable for this run,
// don't keep sending requests to it.

let groqDisabled = false;
let openRouterDisabled = false;

function loadProfile() {
  return JSON.parse(
    fs.readFileSync(
      PROFILE_PATH,
      'utf8'
    )
  );
}

function normalize(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(
  job,
  profile
) {
  const description =
    normalize(
      job.description
    ).slice(0, 600);

  return [
    'You are a job-fit scorer.',

    'Evaluate the candidate against the job.',

    '',

    'Return ONLY one line in exactly this format:',

    'SCORE=85|FIT=Strong|REASON=Strong Power BI and SQL match.',

    '',

    'Rules:',
    '- SCORE must be 0 to 100.',
    '- FIT must be Excellent, Strong, Good, Possible, or Weak.',
    '- REASON must be one short sentence.',
    '- Judge actual skills and responsibilities, not title alone.',
    '- Candidate has 2+ years relevant experience.',
    '- Do not reject only because the title says Senior, Lead, or Principal.',
    '- Do not output JSON.',
    '- Do not explain your reasoning.',
    '- Do not repeat the prompt.',
    '- Do not output safety classifications.',
    '- Output exactly one SCORE/FIT/REASON line.',

    '',

    `Candidate education: ${
      profile.education
    }`,

    `Candidate skills: ${
      profile.coreStack.join(', ')
    }`,

    `Target roles: ${
      profile.targetRoles.join(', ')
    }`,

    '',

    `Job title: ${
      normalize(job.title)
    }`,

    `Company: ${
      normalize(job.company) ||
      'Unknown'
    }`,

    `Location: ${
      normalize(job.location) ||
      'Unknown'
    }`,

    `Experience: ${
      normalize(job.experience) ||
      'Not stated'
    }`,

    `Job description: ${
      description ||
      'Not available'
    }`,
  ].join('\n');
}

async function callProvider(
  url,
  apiKey,
  model,
  prompt,
  extraHeaders = {}
) {
  const response =
    await fetch(
      url,
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          'Content-Type':
            'application/json',

          ...extraHeaders,
        },

        body: JSON.stringify({
          model,

          temperature: 0,

          max_tokens: 120,

          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      }
    );

  const responseText =
    await response.text();

  if (!response.ok) {
    const error =
      new Error(
        `${response.status}: ${responseText.slice(
          0,
          500
        )}`
      );

    error.status =
      response.status;

    error.responseText =
      responseText;

    throw error;
  }

  let data;

  try {
    data =
      JSON.parse(
        responseText
      );
  } catch {
    throw new Error(
      `Invalid provider response: ${responseText.slice(
        0,
        300
      )}`
    );
  }

  const content =
    data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      'Empty AI response'
    );
  }

  return String(
    content
  ).trim();
}

function parseAIResponse(
  text
) {
  const raw =
    normalize(text);

  if (!raw) {
    throw new Error(
      'Empty AI response'
    );
  }

  let score = null;
  let fit = '';
  let reason = '';

  // Standard format:
  //
  // SCORE=85|FIT=Strong|REASON=...

  let scoreMatch =
    raw.match(
      /SCORE\s*[=:]\s*(\d{1,3})/i
    );

  // JSON-ish fallback:
  //
  // "score": 85

  if (!scoreMatch) {
    scoreMatch =
      raw.match(
        /["']?score["']?\s*:\s*(\d{1,3})/i
      );
  }

  if (scoreMatch) {
    score =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            scoreMatch[1]
          )
        )
      );
  }

  let fitMatch =
    raw.match(
      /FIT\s*[=:]\s*(Excellent|Strong|Good|Possible|Weak)/i
    );

  if (!fitMatch) {
    fitMatch =
      raw.match(
        /["']?fit["']?\s*:\s*["']?(Excellent|Strong|Good|Possible|Weak)/i
      );
  }

  if (fitMatch) {
    fit =
      fitMatch[1];
  }

  let reasonMatch =
    raw.match(
      /REASON\s*[=:]\s*(.+?)(?:\s*\|\s*(?:SCORE|FIT|REASON)\s*[=:]|$)/i
    );

  if (reasonMatch) {
    reason =
      normalize(
        reasonMatch[1]
      );
  }

  if (!reason) {
    const jsonReason =
      raw.match(
        /["']?reason["']?\s*:\s*["']([^"]+)/i
      );

    if (jsonReason) {
      reason =
        normalize(
          jsonReason[1]
        );
    }
  }

  if (score === null) {
    throw new Error(
      `AI response has no SCORE: ${raw.slice(
        0,
        300
      )}`
    );
  }

  if (!fit) {
    if (score >= 85) {
      fit = 'Excellent';
    } else if (score >= 70) {
      fit = 'Strong';
    } else if (score >= 55) {
      fit = 'Good';
    } else if (score >= 40) {
      fit = 'Possible';
    } else {
      fit = 'Weak';
    }
  }

  if (!reason) {
    reason =
      'AI scored this job using role, skills, and experience fit.';
  }

  return {
    matchScore: score,
    priority: fit,
    aiReason: reason,
  };
}

function makeUnevaluatedJob(
  job
) {
  return {
    ...job,

    matchScore: null,

    experienceFit:
      'Not evaluated',

    priority:
      'Not AI scored',

    aiReason:
      '',

    aiStrengths:
      [],

    aiGaps:
      [],

    coldPitch:
      '',

    aiProvider:
      'none',
  };
}

async function tryGroq(
  job,
  profile
) {
  if (
    groqDisabled ||
    !process.env.GROQ_API_KEY
  ) {
    return null;
  }

  const prompt =
    buildPrompt(
      job,
      profile
    );

  try {
    const text =
      await callProvider(
        GROQ_URL,
        process.env.GROQ_API_KEY,
        GROQ_MODEL,
        prompt
      );

    const parsed =
      parseAIResponse(text);

    return {
      ...job,
      ...parsed,

      experienceFit:
        'AI evaluated',

      aiStrengths:
        [],

      aiGaps:
        [],

      coldPitch:
        '',

      aiProvider:
        'groq',
    };
  } catch (error) {
    console.warn(
      `[LLM] Groq failed for "${job.title}" @ ${
        job.company || 'Unknown'
      }: ${error.message}`
    );

    // If Groq is consistently returning empty responses,
    // don't hammer it for the remainder of the run.
    if (
      error.message ===
      'Empty AI response'
    ) {
      groqDisabled = true;

      console.warn(
        '[LLM] Groq disabled for the remainder of this run after an empty response.'
      );
    }

    return null;
  }
}

async function tryOpenRouter(
  job,
  profile
) {
  if (
    openRouterDisabled ||
    !process.env.OPENROUTER_API_KEY
  ) {
    return null;
  }

  const prompt =
    buildPrompt(
      job,
      profile
    );

  try {
    const text =
      await callProvider(
        OPENROUTER_URL,
        process.env.OPENROUTER_API_KEY,
        OPENROUTER_MODEL,
        prompt,
        {
          'HTTP-Referer':
            'https://github.com/suhimugan/Job_Alert',

          'X-Title':
            'Job Alert Bot',
        }
      );

    const parsed =
      parseAIResponse(text);

    return {
      ...job,
      ...parsed,

      experienceFit:
        'AI evaluated',

      aiStrengths:
        [],

      aiGaps:
        [],

      coldPitch:
        '',

      aiProvider:
        'openrouter',
    };
  } catch (error) {
    console.warn(
      `[LLM] OpenRouter failed for "${job.title}" @ ${
        job.company || 'Unknown'
      }: ${error.message}`
    );

    const responseText =
      String(
        error.responseText ||
        ''
      );

    // IMPORTANT:
    // A 429 with free-models-per-day means
    // the daily OpenRouter free quota is exhausted.
    //
    // Stop immediately instead of attempting
    // the remaining jobs.

    if (
      error.status === 429 &&
      /free-models-per-day/i.test(
        responseText
      )
    ) {
      openRouterDisabled =
        true;

      console.warn(
        '[LLM] OpenRouter daily free-model quota exhausted. Disabling OpenRouter for the remainder of this run.'
      );
    }

    return null;
  }
}

async function evaluateOne(
  job,
  profile
) {
  // Provider order:
  //
  // Groq first.
  // OpenRouter fallback.
  //
  // Circuit breakers prevent repeated
  // requests after provider failure.

  const groqResult =
    await tryGroq(
      job,
      profile
    );

  if (groqResult) {
    return groqResult;
  }

  const openRouterResult =
    await tryOpenRouter(
      job,
      profile
    );

  if (openRouterResult) {
    return openRouterResult;
  }

  return makeUnevaluatedJob(
    job
  );
}

async function evaluateJobs(
  jobs
) {
  const profile =
    loadProfile();

  // Reset provider state for every
  // complete evaluation run.

  groqDisabled = false;
  openRouterDisabled = false;

  const results = [];

  console.log(
    `\n[LLM] Evaluating ${jobs.length} jobs...`
  );

  console.log(
    '[LLM] Provider order: Groq → OpenRouter'
  );

  for (
    let i = 0;
    i < jobs.length;
    i++
  ) {
    const job =
      jobs[i];

    console.log(
      `[LLM] ${i + 1}/${jobs.length}: "${job.title}" @ ${
        job.company || 'Unknown'
      }`
    );

    const evaluated =
      await evaluateOne(
        job,
        profile
      );

    results.push(
      evaluated
    );

    if (
      evaluated.matchScore != null
    ) {
      console.log(
        `[LLM]   → ${evaluated.aiProvider} score: ${evaluated.matchScore}% | ${evaluated.aiReason}`
      );
    } else {
      console.log(
        '[LLM]   → No AI score; keeping job for email.'
      );
    }

    // Keep a small delay between requests.
    //
    // This is especially useful for free providers.

    if (
      i < jobs.length - 1
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1500
          )
      );
    }

    // If BOTH providers are unavailable,
    // there is no reason to continue making
    // network calls.

    if (
      groqDisabled &&
      openRouterDisabled
    ) {
      console.warn(
        '[LLM] Both AI providers are unavailable for this run. Remaining jobs will remain Not AI scored.'
      );

      for (
        let j = i + 1;
        j < jobs.length;
        j++
      ) {
        results.push(
          makeUnevaluatedJob(
            jobs[j]
          )
        );
      }

      break;
    }
  }

  const scoredCount =
    results.filter(
      (job) =>
        job.matchScore != null
    ).length;

  console.log(
    `AI scored ${scoredCount}/${results.length} jobs`
  );

  return results;
}

module.exports = {
  evaluateJobs,
  evaluateOne,
};
