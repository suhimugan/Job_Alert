'use strict';

const TARGET_GROUPS = [
  {
    name: 'Power BI / BI',

    titleKeywords: [
      'power bi developer',
      'power bi analyst',
      'power bi consultant',
      'powerbi developer',
      'powerbi analyst',
      'bi developer',
      'bi analyst',
      'business intelligence developer',
      'business intelligence analyst',
      'business intelligence',
    ],

    descriptionKeywords: [
      'power bi',
      'powerbi',
      'dax',
      'power query',
      'business intelligence',
      'bi reporting',
      'bi dashboard',
    ],
  },

  {
    name: 'Data Analyst',

    titleKeywords: [
      'data analyst',
      'data analytics analyst',
      'analytics analyst',
      'data analyst ii',
      'data analyst iii',
      'data analyst iv',
    ],

    descriptionKeywords: [
      'data analysis',
      'data analytics',
      'analytical reporting',
      'business analysis',
      'reporting',
      'data visualization',
    ],
  },

  {
    name: 'Azure Data Engineer',

    titleKeywords: [
      'azure data engineer',
      'azure data engineering',
      'azure data factory',
      'azure synapse',
      'data engineer - azure',
      'data engineer azure',
      'azure data platform',
    ],

    descriptionKeywords: [
      'azure data factory',
      'azure synapse',
      'adf',
      'data factory',
      'azure data lake',
      'azure data lake storage',
      'azure sql',
      'microsoft fabric',
    ],
  },

  {
    name: 'Data Engineer',

    titleKeywords: [
      'data engineer',
      'data engineering',
      'etl developer',
      'etl engineer',
      'analytics engineer',
    ],

    descriptionKeywords: [
      'data engineering',
      'etl',
      'data pipeline',
      'data pipelines',
      'data warehouse',
      'data platform',
    ],
  },
];

const CORE_SKILLS = [
  'power bi',
  'powerbi',
  'dax',
  'power query',
  'sql',
  'microsoft excel',
  'excel',
  'azure',
  'azure data factory',
  'data factory',
  'azure synapse',
  'synapse',
  'etl',
  'business intelligence',
  'data engineering',
  'data analysis',
  'data visualization',
  'microsoft fabric',
];

const ENGINEERING_SKILLS = [
  'python',
  'pyspark',
  'spark',
  'databricks',
  'azure data factory',
  'adf',
  'azure synapse',
  'synapse',
  'data lake',
  'data warehouse',
  'etl',
  'data pipeline',
  'data pipelines',
];

const BI_SKILLS = [
  'power bi',
  'powerbi',
  'dax',
  'power query',
  'sql',
  'tableau',
  'power platform',
  'business intelligence',
  'reporting',
  'dashboard',
  'data visualization',
];

const NEGATIVE_PRIMARY_ROLES = [
  'data scientist',
  'machine learning engineer',
  'machine learning',
  'ml engineer',
  'software engineer',
  'frontend developer',
  'frontend engineer',
  'backend developer',
  'backend engineer',
  'full stack developer',
  'fullstack developer',
  'financial analyst',
  'financial reporting analyst',
  'sales',
  'marketing',
  'recruiter',
  'recruitment',
  'hr manager',
  'human resources',
];

const URGENCY_KEYWORDS = [
  'walk-in',
  'walk in',
  'walkin',
  'immediate joining',
  'immediate joiner',
  'urgent hiring',
  'hiring drive',
  'job drive',
  'immediate start',
];

const SENIORITY_KEYWORDS = [
  'senior',
  'sr ',
  'sr.',
  'lead',
  'principal',
  'manager',
  'architect',
  'head',
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function countMatches(text, keywords) {
  const normalizedText = normalize(text);

  return keywords.filter((keyword) =>
    normalizedText.includes(
      normalize(keyword)
    )
  ).length;
}

function getText(job) {
  const title = normalize(job.title);
  const description = normalize(
    job.description
  );

  return {
    title,
    description,
    text: `${title} ${description}`,
  };
}

function getGroups(job) {
  const {
    title,
    description,
  } = getText(job);

  return TARGET_GROUPS
    .filter((group) => {
      const titleMatch =
        group.titleKeywords.some(
          (keyword) =>
            title.includes(
              normalize(keyword)
            )
        );

      const descriptionMatch =
        group.descriptionKeywords.some(
          (keyword) =>
            description.includes(
              normalize(keyword)
            )
        );

      return (
        titleMatch ||
        descriptionMatch
      );
    })
    .map(
      (group) => group.name
    );
}

function getPrimaryGroups(job) {
  const title =
    normalize(job.title);

  return TARGET_GROUPS
    .filter((group) =>
      group.titleKeywords.some(
        (keyword) =>
          title.includes(
            normalize(keyword)
          )
      )
    )
    .map(
      (group) => group.name
    );
}

function extractExperience(job) {
  const text = normalize(
    `${job.title || ''} ${
      job.experience || ''
    } ${
      job.description || ''
    }`
  );

  let match = text.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (match) {
    return {
      min: Number(match[1]),
      max: Number(match[2]),
      stated: true,
    };
  }

  match = text.match(
    /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/i
  );

  if (match) {
    return {
      min: Number(match[1]),
      max: null,
      stated: true,
    };
  }

  match = text.match(
    /(?:minimum|min|at least)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
  );

  if (match) {
    return {
      min: Number(match[1]),
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

function scoreExperience(job) {
  const experience =
    extractExperience(job);

  if (!experience.stated) {
    return {
      score: 8,
      label: 'Not stated',
    };
  }

  const min = experience.min;
  const max = experience.max;

  if (
    max !== null &&
    max < 2
  ) {
    return {
      score: 0,
      label: 'Below 2 years',
    };
  }

  if (
    min >= 2 &&
    min <= 4
  ) {
    return {
      score: 15,
      label: `${min}-${max} years`,
    };
  }

  if (
    min > 4 &&
    min <= 6
  ) {
    return {
      score: 11,
      label:
        max !== null
          ? `${min}-${max} years`
          : `${min}+ years`,
    };
  }

  if (
    min > 6 &&
    min <= 8
  ) {
    return {
      score: 7,
      label:
        max !== null
          ? `${min}-${max} years`
          : `${min}+ years`,
    };
  }

  if (
    min > 8 &&
    min <= 10
  ) {
    return {
      score: 4,
      label:
        max !== null
          ? `${min}-${max} years`
          : `${min}+ years`,
    };
  }

  if (min > 10) {
    return {
      score: 1,
      label: `${min}+ years`,
    };
  }

  if (
    min < 2 &&
    max !== null &&
    max >= 2
  ) {
    return {
      score: 10,
      label: `${min}-${max} years`,
    };
  }

  return {
    score: 8,
    label: 'Not stated',
  };
}

function scoreRoleMatch(job) {
  const title =
    normalize(job.title);

  const description =
    normalize(job.description);

  const primaryGroups =
    getPrimaryGroups(job);

  if (
    primaryGroups.length > 0
  ) {
    return {
      score: 40,
      groups: primaryGroups,
      reason:
        'target role in title',
    };
  }

  const descriptionGroup =
    TARGET_GROUPS.find(
      (group) =>
        group.descriptionKeywords.some(
          (keyword) =>
            description.includes(
              normalize(keyword)
            )
        )
    );

  if (descriptionGroup) {
    return {
      score: 16,
      groups: [
        descriptionGroup.name,
      ],
      reason:
        'target skill area in description',
    };
  }

  return {
    score: 0,
    groups: [],
    reason: '',
  };
}

function scoreSkills(job) {
  const { text } =
    getText(job);

  const coreMatches =
    countMatches(
      text,
      CORE_SKILLS
    );

  const biMatches =
    countMatches(
      text,
      BI_SKILLS
    );

  const engineeringMatches =
    countMatches(
      text,
      ENGINEERING_SKILLS
    );

  const coreScore =
    Math.min(
      coreMatches * 2,
      14
    );

  const biBonus =
    Math.min(
      biMatches * 1.5,
      7
    );

  const engineeringBonus =
    Math.min(
      engineeringMatches * 1.5,
      7
    );

  return {
    score: Math.round(
      coreScore +
      biBonus +
      engineeringBonus
    ),

    coreMatches,
    biMatches,
    engineeringMatches,
  };
}

function scoreSeniority(job) {
  const title =
    normalize(job.title);

  const seniorityMatches =
    countMatches(
      title,
      SENIORITY_KEYWORDS
    );

  if (
    seniorityMatches === 0
  ) {
    return {
      score: 5,
      label:
        'Mid-level/unspecified',
    };
  }

  const experience =
    extractExperience(job);

  if (
    experience.stated &&
    experience.min !== null &&
    experience.min <= 4
  ) {
    return {
      score: 5,
      label:
        'Senior title with reasonable experience',
    };
  }

  if (
    experience.stated &&
    experience.min !== null &&
    experience.min <= 6
  ) {
    return {
      score: 3,
      label:
        'Senior title with moderate experience gap',
    };
  }

  if (
    experience.stated &&
    experience.min !== null &&
    experience.min > 6
  ) {
    return {
      score: 0,
      label:
        'Senior title with large experience gap',
    };
  }

  return {
    score: 3,
    label:
      'Senior/Lead/Principal',
  };
}

// IMPORTANT:
// Urgency is now determined primarily from the JOB TITLE.
//
// This prevents a normal "6+ years" Azure job from being labelled
// WALK-IN just because its description happens to contain words like
// "immediate", "hiring drive", etc.

function scoreUrgency(job) {
  const title =
    normalize(job.title);

  const matches =
    countMatches(
      title,
      URGENCY_KEYWORDS
    );

  if (matches > 0) {
    return {
      score: 6,
      urgent: true,
    };
  }

  return {
    score: 0,
    urgent: false,
  };
}

function scoreNegativeRole(job) {
  const title =
    normalize(job.title);

  const matches =
    countMatches(
      title,
      NEGATIVE_PRIMARY_ROLES
    );

  if (matches === 0) {
    return {
      score: 0,
      matches: 0,
    };
  }

  return {
    score: -25,
    matches,
  };
}

function scoreCandidate(job) {
  const role =
    scoreRoleMatch(job);

  const skills =
    scoreSkills(job);

  const experience =
    scoreExperience(job);

  const seniority =
    scoreSeniority(job);

  const urgency =
    scoreUrgency(job);

  const negative =
    scoreNegativeRole(job);

  let score =
    role.score +
    skills.score +
    experience.score +
    seniority.score +
    urgency.score +
    negative.score;

  if (
    job.type === 'fulltime'
  ) {
    score += 2;
  }

  const location =
    normalize(job.location);

  if (
    location.includes('remote') ||
    location.includes('india') ||
    location.includes('work from home') ||
    location.includes('wfh')
  ) {
    score += 2;
  }

  score = Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );

  const reasons = [];

  if (role.reason) {
    reasons.push(
      role.reason
    );
  }

  if (
    skills.coreMatches >= 4
  ) {
    reasons.push(
      'strong skill overlap'
    );
  } else if (
    skills.coreMatches >= 2
  ) {
    reasons.push(
      'relevant skill overlap'
    );
  }

  if (
    experience.stated
  ) {
    reasons.push(
      `experience: ${experience.label}`
    );
  }

  if (
    urgency.urgent
  ) {
    reasons.push(
      'urgent/walk-in'
    );
  }

  if (
    negative.matches > 0
  ) {
    reasons.push(
      'possible role mismatch'
    );
  }

  return {
    ...job,

    candidateScore:
      score,

    candidateReasons:
      reasons,

    candidateGroups:
      getGroups(job),

    candidatePrimaryGroups:
      role.groups,

    candidateExperience:
      experience.label,

    candidateSkillMatches:
      skills.coreMatches,

    isWalkIn:
      urgency.urgent,
  };
}

// ─── Balanced AI Candidate Selection ────────────────────────────────────────
//
// The previous version selected the 25 highest scores globally.
//
// That caused Azure/Data Engineer jobs to dominate the AI pool.
//
// We now guarantee reasonable representation across the four target groups.
//
// For 25 candidates:
//   Power BI / BI       → up to 7
//   Data Analyst        → up to 6
//   Azure Data Engineer → up to 6
//   Data Engineer       → up to 6
//
// These are maximum allocation targets, not hard requirements.
// If a category doesn't have enough jobs, its unused slots are filled
// by the strongest remaining candidates.
//
// AI still evaluates only 25 jobs.
// The full relevant pool remains available for email.

function rankCandidates(
  jobs,
  limit = 25
) {
  const scored =
    jobs.map(
      scoreCandidate
    );

  scored.sort(
    (a, b) => {
      if (
        b.candidateScore !==
        a.candidateScore
      ) {
        return (
          b.candidateScore -
          a.candidateScore
        );
      }

      if (
        a.isWalkIn !==
        b.isWalkIn
      ) {
        return a.isWalkIn
          ? -1
          : 1;
      }

      return 0;
    }
  );

  if (
    scored.length <= limit
  ) {
    return scored;
  }

  const allocations = {
    'Power BI / BI': 7,
    'Data Analyst': 6,
    'Azure Data Engineer': 6,
    'Data Engineer': 6,
  };

  const selected = [];
  const selectedIds =
    new Set();

  // First pass:
  // Fill each category according to its allocation.

  for (
    const group of TARGET_GROUPS
  ) {
    const allocation =
      allocations[group.name] ||
      0;

    const groupCandidates =
      scored.filter(
        (job) =>
          !selectedIds.has(
            DatabaseSafeId(job)
          ) &&
          job.candidatePrimaryGroups.includes(
            group.name
          )
      );

    let added = 0;

    for (
      const candidate of groupCandidates
    ) {
      if (
        added >= allocation ||
        selected.length >= limit
      ) {
        break;
      }

      const id =
        DatabaseSafeId(
          candidate
        );

      if (
        selectedIds.has(id)
      ) {
        continue;
      }

      selected.push(
        candidate
      );

      selectedIds.add(id);
      added++;
    }
  }

  // Second pass:
  // Fill remaining slots with strongest candidates
  // regardless of group.

  for (
    const job of scored
  ) {
    if (
      selected.length >= limit
    ) {
      break;
    }

    const id =
      DatabaseSafeId(job);

    if (
      selectedIds.has(id)
    ) {
      continue;
    }

    selected.push(job);
    selectedIds.add(id);
  }

  // Final ordering.

  selected.sort(
    (a, b) => {
      if (
        b.candidateScore !==
        a.candidateScore
      ) {
        return (
          b.candidateScore -
          a.candidateScore
        );
      }

      if (
        a.isWalkIn !==
        b.isWalkIn
      ) {
        return a.isWalkIn
          ? -1
          : 1;
      }

      return 0;
    }
  );

  return selected.slice(
    0,
    limit
  );
}

// We intentionally avoid importing Database here.
// This helper creates a stable ID for same-run ranking.
// URL is preferred, with title/company fallback.

function DatabaseSafeId(job) {
  const url =
    normalize(job.url);

  if (url) {
    return url;
  }

  return [
    normalize(job.title),
    normalize(job.company),
    normalize(job.location),
  ].join('|');
}

module.exports = {
  scoreCandidate,
  rankCandidates,
  extractExperience,
};
