'use strict';

const serpapi = require('./serpapi');
const remoteok = require('./remoteok');
const weworkremotely = require('./weworkremotely');
const ycombinator = require('./ycombinator');
const remotive = require('./remotive');
const naukri = require('./naukri');
const linkedin = require('./linkedin');

/**
 * Run all job discovery sources concurrently.
 *
 * Sources:
 *   - RemoteOK
 *   - WeWorkRemotely
 *   - Y Combinator
 *   - Remotive
 *   - Naukri
 *   - LinkedIn / JobSpy
 *   - SerpAPI / Google
 *
 * Individual source failures never crash the whole run.
 */
async function runAllScrapers(options = {}) {
  const {
    useSerpapi = false,
  } = options;

  const tasks = [
    {
      name: 'RemoteOK',
      fn: remoteok.scrape,
    },

    {
      name: 'WeWorkRemotely',
      fn: weworkremotely.scrape,
    },

    {
      name: 'YCombinator',
      fn: ycombinator.scrape,
    },

    {
      name: 'Remotive',
      fn: remotive.scrape,
    },

    {
      name: 'Naukri',
      fn: naukri.scrape,
    },

    {
      name: 'LinkedIn',
      fn: linkedin.scrape,
    },
  ];

  if (useSerpapi) {
    const apiKey =
      process.env.SERPAPI_KEY;

    if (apiKey) {
      tasks.push({
        name: 'SerpAPI',
        fn: () =>
          serpapi.scrape(apiKey),
      });
    } else {
      console.warn(
        '[Scrapers] USE_SERPAPI=true but SERPAPI_KEY is not set — skipping.'
      );
    }
  }

  console.log(
    `\n🔍 Running ${tasks.length} scrapers${
      useSerpapi
        ? ' (SerpAPI enabled)'
        : ' (free sources only)'
    }...\n`
  );

  const results =
    await Promise.allSettled(
      tasks.map(
        (task) => task.fn()
      )
    );

  const allJobs = [];

  for (
    let i = 0;
    i < tasks.length;
    i++
  ) {
    const result =
      results[i];

    if (
      result.status ===
      'fulfilled'
    ) {
      const jobs =
        result.value || [];

      console.log(
        `✅ ${tasks[i].name}: ${jobs.length} jobs`
      );

      const taggedJobs =
        jobs.map((job) => ({
          ...job,

          // Preserve the scraper source.
          source:
            job.source ||
            tasks[i].name,
        }));

      allJobs.push(
        ...taggedJobs
      );
    } else {
      console.error(
        `❌ ${tasks[i].name} FAILED:`,
        result.reason?.message ||
          result.reason
      );
    }
  }

  console.log(
    `\n📦 Total raw jobs from all scrapers: ${allJobs.length}\n`
  );

  return allJobs;
}

module.exports = {
  runAllScrapers,
};
