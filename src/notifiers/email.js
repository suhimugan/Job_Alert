'use strict';

const { Resend } = require('resend');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(value, max = 700) {
  const text = String(value || '').trim();

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max).trim()}...`;
}

function formatList(items, emptyText = 'None identified') {
  const values = Array.isArray(items)
    ? items.filter(Boolean)
    : [];

  if (values.length === 0) {
    return `<span style="color:#666;">${escapeHtml(emptyText)}</span>`;
  }

  return `
    <ul style="margin:6px 0 10px 20px;padding:0;">
      ${values
        .map(
          (item) =>
            `<li style="margin-bottom:4px;">${escapeHtml(item)}</li>`
        )
        .join('')}
    </ul>
  `;
}

function getScore(job) {
  if (
    typeof job.matchScore === 'number' &&
    Number.isFinite(job.matchScore)
  ) {
    return {
      score: job.matchScore,
      label: 'AI score',
    };
  }

  if (
    typeof job.fallbackScore === 'number' &&
    Number.isFinite(job.fallbackScore)
  ) {
    return {
      score: job.fallbackScore,
      label: 'Fallback match',
    };
  }

  if (
    typeof job.categoryScore === 'number' &&
    Number.isFinite(job.categoryScore)
  ) {
    return {
      score: job.categoryScore,
      label: 'Match score',
    };
  }

  return {
    score: null,
    label: 'Not scored',
  };
}

function getCategory(job) {
  return (
    job.jobCategory ||
    job.aiCategory ||
    'Not scored'
  );
}

function getScoreSource(job) {
  if (job.aiEvaluated || job.categorySource === 'AI') {
    return 'AI';
  }

  if (
    job.fallbackScore != null ||
    job.categorySource === 'Fallback' ||
    String(job.jobCategory || '').includes('fallback')
  ) {
    return 'Fallback';
  }

  return 'Not scored';
}

function getCategoryStyle(category) {
  const normalized = String(category || '').toLowerCase();

  if (normalized.includes('excellent')) {
    return {
      background: '#e8f5e9',
      border: '#43a047',
      text: '#1b5e20',
    };
  }

  if (normalized.includes('strong')) {
    return {
      background: '#e3f2fd',
      border: '#1e88e5',
      text: '#0d47a1',
    };
  }

  if (normalized.includes('good')) {
    return {
      background: '#f3f8e8',
      border: '#7cb342',
      text: '#33691e',
    };
  }

  if (normalized.includes('possible')) {
    return {
      background: '#fff8e1',
      border: '#f9a825',
      text: '#7f6000',
    };
  }

  if (normalized.includes('weak')) {
    return {
      background: '#ffebee',
      border: '#e53935',
      text: '#b71c1c',
    };
  }

  return {
    background: '#f5f5f5',
    border: '#9e9e9e',
    text: '#424242',
  };
}

function getRank(job, index) {
  if (
    typeof job.finalRankScore === 'number' &&
    Number.isFinite(job.finalRankScore)
  ) {
    return job.finalRankScore;
  }

  return null;
}

function getApplicationAdvice(job) {
  return job.applicationAdvice || {};
}

function getResumeGap(job) {
  return job.resumeGap || {};
}

function getResumeTailoring(job) {
  return job.resumeTailoring || {};
}

class EmailNotifier {
  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM;
    this.to = process.env.EMAIL_TO;

    this.enabled = Boolean(
      this.apiKey &&
      this.from &&
      this.to
    );

    if (!this.enabled) {
      console.log(
        '[Email] Resend email notifications are not configured.'
      );
    }
  }

  formatJob(job, index = 0) {
    const scoreInfo = getScore(job);
    const category = getCategory(job);
    const scoreSource = getScoreSource(job);
    const categoryStyle = getCategoryStyle(category);
    const rank = getRank(job, index);

    const gap = getResumeGap(job);
    const tailoring = getResumeTailoring(job);
    const advice = getApplicationAdvice(job);

    const matchedSkills =
      job.fallbackMatchedSkills ||
      gap.matchedSkills ||
      [];

    const missingSkills =
      gap.missingSkills ||
      advice.missingSkills ||
      [];

    const tailoringSuggestions =
      tailoring.suggestions ||
      tailoring.resumeSuggestions ||
      [];

    const applicationSuggestions =
      advice.suggestions ||
      [];

    const isUrgent =
      Boolean(job.isWalkIn) ||
      /immediate\s+join|urgent\s+hiring|walk[\s-]?in/i.test(
        `${job.title || ''} ${job.description || ''}`
      );

    const scoreHtml =
      scoreInfo.score != null
        ? `
          <span style="
            display:inline-block;
            margin-right:8px;
            padding:5px 9px;
            border-radius:5px;
            background:#eeeeee;
            font-weight:bold;
          ">
            ${escapeHtml(scoreInfo.label)}:
            ${escapeHtml(scoreInfo.score)}%
          </span>
        `
        : `
          <span style="
            display:inline-block;
            margin-right:8px;
            padding:5px 9px;
            border-radius:5px;
            background:#eeeeee;
            color:#666;
          ">
            Not AI scored
          </span>
        `;

    const sourceHtml = `
      <span style="
        display:inline-block;
        padding:5px 9px;
        border-radius:5px;
        background:#eeeeee;
      ">
        ${escapeHtml(scoreSource)}
      </span>
    `;

    const rankHtml =
      rank != null
        ? `
          <span style="
            display:inline-block;
            margin-right:8px;
            padding:5px 9px;
            border-radius:5px;
            background:#eeeeee;
          ">
            Rank: ${escapeHtml(rank)}
          </span>
        `
        : '';

    const urgencyHtml = isUrgent
      ? `
        <div style="
          margin:10px 0;
          padding:9px 12px;
          background:#fff3e0;
          border-left:4px solid #fb8c00;
          font-weight:bold;
        ">
          WALK-IN / URGENT / IMMEDIATE-JOINING SIGNAL
        </div>
      `
      : '';

    const aiReasonHtml = job.aiReason
      ? `
        <h4 style="margin:15px 0 5px;">Why it matches</h4>
        <p style="margin-top:5px;">
          ${escapeHtml(job.aiReason)}
        </p>
      `
      : '';

    const matchedSkillsHtml =
      matchedSkills.length > 0
        ? `
          <h4 style="margin:15px 0 5px;">Matched skills</h4>
          ${formatList(matchedSkills)}
        `
        : '';

    const gapHtml =
      missingSkills.length > 0
        ? `
          <h4 style="margin:15px 0 5px;">Resume gaps</h4>
          ${formatList(missingSkills)}
        `
        : `
          <h4 style="margin:15px 0 5px;">Resume gaps</h4>
          <p style="color:#2e7d32;">No major missing skills identified.</p>
        `;

    const tailoringHtml =
      tailoringSuggestions.length > 0
        ? `
          <h4 style="margin:15px 0 5px;">Resume tailoring</h4>
          ${formatList(tailoringSuggestions)}
        `
        : '';

    const applicationSuggestionsHtml =
      applicationSuggestions.length > 0
        ? `
          <h4 style="margin:15px 0 5px;">Application advice</h4>
          ${formatList(applicationSuggestions)}
        `
        : '';

    const applicationMessage =
      advice.applicationMessage ||
      job.coldPitch ||
      '';

    const applicationMessageHtml =
      applicationMessage
        ? `
          <h4 style="margin:15px 0 5px;">
            Suggested application message
          </h4>

          <div style="
            padding:12px;
            background:#f7f7f7;
            border:1px solid #ddd;
            border-radius:5px;
            line-height:1.5;
          ">
            ${escapeHtml(applicationMessage)}
          </div>
        `
        : '';

    const description =
      truncate(job.description, 900);

    return `
      <div style="
        margin:0 0 24px;
        padding:18px;
        border:1px solid #ddd;
        border-left:5px solid ${categoryStyle.border};
        border-radius:8px;
        background:#ffffff;
      ">

        <div style="margin-bottom:8px;">
          ${
            rank != null
              ? `<strong style="color:#666;">#${index + 1}</strong>`
              : ''
          }

          <span style="
            display:inline-block;
            margin-left:6px;
            padding:5px 9px;
            border-radius:5px;
            background:${categoryStyle.background};
            color:${categoryStyle.text};
            font-weight:bold;
          ">
            ${escapeHtml(category)}
          </span>
        </div>

        <h3 style="
          margin:8px 0;
          font-size:18px;
          line-height:1.35;
        ">
          ${escapeHtml(job.title || 'Untitled role')}
        </h3>

        <p style="margin:5px 0;">
          <strong>Company:</strong>
          ${escapeHtml(job.company || 'Not specified')}
        </p>

        <p style="margin:5px 0;">
          <strong>Location:</strong>
          ${escapeHtml(job.location || 'Not specified')}
        </p>

        <p style="margin:5px 0;">
          <strong>Experience:</strong>
          ${escapeHtml(job.experience || job.candidateExperience || 'Not specified')}
        </p>

        <p style="margin:5px 0;">
          <strong>Source:</strong>
          ${escapeHtml(job.source || 'Unknown')}
        </p>

        <p style="margin:5px 0;">
          <strong>Posted:</strong>
          ${escapeHtml(job.postedAt || 'Recently')}
        </p>

        <div style="margin:12px 0;">
          ${rankHtml}
          ${scoreHtml}
          ${sourceHtml}
        </div>

        ${urgencyHtml}

        ${
          description
            ? `
              <details style="margin:12px 0;">
                <summary style="cursor:pointer;font-weight:bold;">
                  Job description
                </summary>

                <p style="line-height:1.5;color:#444;">
                  ${escapeHtml(description)}
                </p>
              </details>
            `
            : ''
        }

        ${aiReasonHtml}

        ${matchedSkillsHtml}

        ${gapHtml}

        ${tailoringHtml}

        ${applicationSuggestionsHtml}

        ${applicationMessageHtml}

        <div style="margin-top:18px;">
          ${
            job.url
              ? `
                <a
                  href="${escapeHtml(job.url)}"
                  style="
                    display:inline-block;
                    padding:10px 16px;
                    background:#1565c0;
                    color:#ffffff;
                    text-decoration:none;
                    border-radius:5px;
                    font-weight:bold;
                  "
                >
                  Apply / View Original Posting
                </a>
              `
              : '<span style="color:#666;">No application URL available.</span>'
          }
        </div>

      </div>
    `;
  }

  formatSummary(jobs, globalJobs, runStats = {}) {
    const allJobs = [
      ...(jobs || []),
      ...(globalJobs || []),
    ];

    const categories = {
      Excellent: 0,
      Strong: 0,
      Good: 0,
      Possible: 0,
      Weak: 0,
      'Not scored': 0,
    };

    let aiScored = 0;
    let fallbackScored = 0;
    let urgent = 0;

    for (const job of allJobs) {
      const category = getCategory(job);

      const baseCategory =
        String(category)
          .replace(/\s*\(fallback\)/i, '')
          .trim();

      if (
        Object.prototype.hasOwnProperty.call(
          categories,
          baseCategory
        )
      ) {
        categories[baseCategory]++;
      } else {
        categories['Not scored']++;
      }

      const source = getScoreSource(job);

      if (source === 'AI') {
        aiScored++;
      } else if (source === 'Fallback') {
        fallbackScored++;
      }

      if (
        job.isWalkIn ||
        /immediate\s+join|urgent\s+hiring|walk[\s-]?in/i.test(
          `${job.title || ''} ${job.description || ''}`
        )
      ) {
        urgent++;
      }
    }

    const statRows = [
      ['Raw jobs discovered', runStats.rawJobs],
      ['Role relevant', runStats.roleRelevant],
      ['India / Remote', runStats.indiaRemote],
      ['Global secondary', runStats.global],
      ['Pre-AI unique', runStats.preAiUnique],
      ['AI candidates', runStats.aiCandidates],
      ['AI scored', runStats.aiScored],
      ['Fallback scored', runStats.fallbackScored],
      ['New India / Remote', runStats.newJobs],
      ['New global', runStats.newGlobalJobs],
      ['Jobs emailed', runStats.emailedJobs],
      ['Global emailed', runStats.emailedGlobalJobs],
    ];

    return `
      <div style="
        margin:20px 0;
        padding:16px;
        background:#f7f9fc;
        border:1px solid #d9e0e8;
        border-radius:8px;
      ">

        <h2 style="margin-top:0;">
          📊 Run Statistics
        </h2>

        <table style="
          width:100%;
          border-collapse:collapse;
          margin-top:10px;
        ">
          ${statRows
            .map(
              ([label, value]) => `
                <tr>
                  <td style="padding:6px;">
                    <strong>${escapeHtml(label)}</strong>
                  </td>
                  <td style="padding:6px;">
                    ${escapeHtml(
                      value == null ? 0 : value
                    )}
                  </td>
                </tr>
              `
            )
            .join('')}
        </table>

        <h3 style="margin-top:20px;">
          Job Categories
        </h3>

        <table style="
          width:100%;
          border-collapse:collapse;
        ">
          <tr>
            <td style="padding:5px;">Excellent</td>
            <td style="padding:5px;">${categories.Excellent}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Strong</td>
            <td style="padding:5px;">${categories.Strong}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Good</td>
            <td style="padding:5px;">${categories.Good}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Possible</td>
            <td style="padding:5px;">${categories.Possible}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Weak</td>
            <td style="padding:5px;">${categories.Weak}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Not scored</td>
            <td style="padding:5px;">${categories['Not scored']}</td>
          </tr>

          <tr>
            <td style="padding:5px;">AI evaluated in email</td>
            <td style="padding:5px;">${aiScored}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Fallback scored in email</td>
            <td style="padding:5px;">${fallbackScored}</td>
          </tr>

          <tr>
            <td style="padding:5px;">Walk-in / urgent</td>
            <td style="padding:5px;">${urgent}</td>
          </tr>
        </table>

        <p style="
          margin-bottom:0;
          color:#666;
          font-size:13px;
          line-height:1.5;
        ">
          AI evaluation is limited to the configured candidate pool.
          Email visibility is not capped: all new relevant jobs are included.
        </p>

      </div>
    `;
  }
  async send(
  jobs = [],
  globalJobs = [],
  runStats = {}
) {
   if (!this.enabled) {
      return false;
    }

    const resend = new Resend(this.apiKey);

      const isNoJobs =
      jobs.length === 0 &&
      globalJobs.length === 0;

    const mainHtml = jobs.length
      ? jobs
          .map((job, index) =>
            this.formatJob(job, index)
          )
          .join('')
      : '<p>No new India/Remote jobs in this run.</p>';

    const globalHtml = globalJobs.length
      ? globalJobs
          .map((job, index) =>
            this.formatJob(job, index)
          )
          .join('')
      : '<p>No global opportunities in this run.</p>';

    const html = `
      <!DOCTYPE html>
      <html>
        <body style="
          margin:0;
          padding:0;
          background:#f1f3f6;
          font-family:Arial,Helvetica,sans-serif;
          color:#222;
        ">

          <div style="
            max-width:900px;
            margin:0 auto;
            padding:24px 14px;
          ">

            <div style="
              padding:20px;
              background:#17202a;
              color:#ffffff;
              border-radius:8px;
            ">
              <h1 style="margin:0 0 8px;">
                ?? Job Alerts
              </h1>

              <p style="margin:0;color:#d5dbe0;">
                Daily India / Remote job intelligence report
              </p>
            </div>

            ${this.formatSummary(
              jobs,
              globalJobs,
              runStats
            )}

            <h2 style="margin-top:30px;">
              ???? India / Remote � Main Alerts
            </h2>

            ${
              jobs.length
                ? jobs
                    .map((job, index) =>
                      this.formatJob(job, index)
                    )
                    .join('')
                : '<p>No new India/Remote jobs in this run.</p>'
            }

            <hr style="margin:35px 0;border:none;border-top:1px solid #ddd;">

            <h2>
              ?? Global Opportunities � Optional
            </h2>

            <p style="color:#666;">
              These are separate from the main India/Remote results.
            </p>

            ${globalHtml}

            <div style="
              margin-top:30px;
              padding:15px;
              border-top:1px solid #ddd;
              color:#777;
              font-size:12px;
              line-height:1.5;
            ">
              Generated by the Job Alert Bot.
              AI scores are shown only when an AI provider successfully
              evaluated the job. Otherwise the deterministic fallback
              match score is shown.
            </div>

          </div>

        </body>
      </html>
    `;

    const { data, error } =
      await resend.emails.send({
        from: this.from,
        to: [this.to],
        subject: isNoJobs
          ? 'Job Alerts — No New Jobs Today'
          : `Job Alerts — ${jobs.length} India/Remote + ` +
          `${globalJobs.length} Global`,
        html,
      });

    if (error) {
      throw new Error(
        error.message || 'Resend email failed'
      );
    }

    console.log(
      `[Email] Sent ${jobs.length} main + ` +
      `${globalJobs.length} global jobs.`
    );

    console.log(
      `[Email] Resend ID: ${data?.id || 'unknown'}`
    );

    return true;
  }
}

module.exports = EmailNotifier;
