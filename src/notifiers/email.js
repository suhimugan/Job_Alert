'use strict';

const { Resend } = require('resend');

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

  formatJob(job) {
    return `
      <div style="margin-bottom:20px;padding-bottom:15px;border-bottom:1px solid #ddd;">
        <h3>${job.isWalkIn ? '🚨 WALK-IN / URGENT: ' : ''}${job.title}</h3>
        <p><strong>Company:</strong> ${job.company || 'Not specified'}</p>
        <p><strong>Location:</strong> ${job.location || 'Not specified'}</p>
        <p><strong>Posted:</strong> ${job.postedAt || 'Recently'}</p>
        <p>${job.description || ''}</p>
        <a href="${job.url}">Apply / View Original Posting</a>
      </div>
    `;
  }

  async send(jobs, globalJobs = []) {
    if (!this.enabled || (!jobs.length && !globalJobs.length)) {
      return false;
    }

    const resend = new Resend(this.apiKey);

    const mainHtml = jobs.length
      ? jobs.map((job) => this.formatJob(job)).join('')
      : '<p>No new India/Remote jobs in this run.</p>';

    const globalHtml = globalJobs.length
      ? globalJobs.map((job) => this.formatJob(job)).join('')
      : '<p>No global opportunities in this run.</p>';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:800px;margin:auto;">
        <h1>🤖 Job Alerts</h1>

        <h2>🇮🇳 India / Remote — Main Alerts</h2>
        ${mainHtml}

        <hr style="margin:30px 0;">

        <h2>🌎 Global Opportunities — Optional</h2>
        <p style="color:#666;">
          These are separate from the main India/Remote results.
        </p>
        ${globalHtml}
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: this.from,
      to: [this.to],
      subject:
        `Job Alerts — ${jobs.length} India/Remote + ` +
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

    console.log(`[Email] Resend ID: ${data?.id || 'unknown'}`);

    return true;
  }
}

module.exports = EmailNotifier;