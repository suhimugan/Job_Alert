'use strict';

const { chromium } = require('playwright');

const SEARCH_URLS = [
  'https://www.naukri.com/power-bi-developer-jobs?jobAge=3',
  'https://www.naukri.com/power-bi-analyst-jobs?jobAge=3',
  'https://www.naukri.com/data-analyst-jobs?jobAge=3',
  'https://www.naukri.com/business-intelligence-analyst-jobs?jobAge=3',
  'https://www.naukri.com/data-engineer-jobs?jobAge=3',
  'https://www.naukri.com/azure-data-engineer-jobs?jobAge=3'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractExperience(text) {
  const match = text.match(/(\d+)\s*-\s*(\d+)\s*Yrs?/i);

  if (match) {
    return `${match[1]}-${match[2]} years`;
  }

  const single = text.match(/(\d+)\+?\s*Yrs?/i);

  if (single) {
    return `${single[1]}+ years`;
  }

  return '';
}

function extractLocation(text, url) {
  const cities = [
    'Bengaluru',
    'Bangalore',
    'Mumbai',
    'Pune',
    'Hyderabad',
    'Delhi',
    'Delhi / NCR',
    'Gurgaon',
    'Gurugram',
    'Noida',
    'Chennai',
    'Kolkata',
    'Ahmedabad',
    'Kochi',
    'Thane',
    'Remote',
    'Work From Home',
    'Hybrid'
  ];

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const location = lines.find(line =>
    cities.some(city =>
      line.toLowerCase().includes(city.toLowerCase())
    )
  );

  return location || 'India';
}

function extractCompany(cardText, title) {
  const lines = cardText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const titleIndex = lines.findIndex(
    line => line.toLowerCase() === title.toLowerCase()
  );

  if (titleIndex >= 0) {
    for (
      let i = titleIndex + 1;
      i < Math.min(titleIndex + 6, lines.length);
      i++
    ) {
      const line = lines[i];

      if (
        !/^\d+(\.\d+)?$/.test(line) &&
        !/^\d+(\.\d+)?\s*Reviews?$/i.test(line) &&
        !/^\d+\s*-\s*\d+\s*Yrs?/i.test(line) &&
        !/^\d+(\.\d+)?\s*(Lacs?|Lakhs?)/i.test(line)
      ) {
        return line;
      }
    }
  }

  return 'Company on Naukri';
}

async function extractJobs(page) {
  const rawJobs = await page
    .locator('a[href*="/job-listings-"]')
    .evaluateAll(anchors => {
      return anchors.map(anchor => {
        const title = (anchor.innerText || '').trim();
        const url = anchor.href;

        let node = anchor;
        let cardText = title;

        for (let i = 0; i < 8 && node; i++) {
          const text = (node.innerText || '').trim();

          if (
            text.length > cardText.length &&
            text.includes(title)
          ) {
            cardText = text;
          }

          node = node.parentElement;
        }

        return {
          title,
          url,
          cardText
        };
      });
    });

  const jobs = [];
  const seenUrls = new Set();

  for (const item of rawJobs) {
    if (!item.title || !item.url) {
      continue;
    }

    if (seenUrls.has(item.url)) {
      continue;
    }

    seenUrls.add(item.url);

    jobs.push({
      title: item.title,
      company: extractCompany(item.cardText, item.title),
      location: extractLocation(item.cardText, item.url),
      salary: '',
      experience: extractExperience(item.cardText),
      description: item.cardText,
      url: item.url,
      postedAt: '',
      type: item.title.toLowerCase().includes('intern')
        ? 'internship'
        : 'fulltime',
      source: 'Naukri'
    });
  }

  return jobs;
}

async function scrape() {
  console.log('[Naukri] Starting Playwright scraper');

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 1000
    },
    locale: 'en-IN',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  const allJobs = [];
  const seen = new Set();

  try {
    for (const url of SEARCH_URLS) {
      console.log(`[Naukri] Opening ${url}`);

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await page.waitForTimeout(10000);

        const jobs = await extractJobs(page);

        console.log(`[Naukri]   ${jobs.length} jobs found`);

        for (const job of jobs) {
          const key =
            `${job.title.toLowerCase()}|` +
            `${job.company.toLowerCase()}|` +
            `${job.location.toLowerCase()}`;

          if (!seen.has(key)) {
            seen.add(key);
            allJobs.push(job);
          }
        }

        console.log(
          `[Naukri]   ${allJobs.length} unique jobs so far`
        );

      } catch (error) {
        console.error(
          `[Naukri] Error: ${error.message}`
        );
      }

      await sleep(3000);
    }
  } finally {
    await browser.close();
  }

  console.log(
    `[Naukri] Total: ${allJobs.length} unique jobs`
  );

  return allJobs;
}

module.exports = {
  scrape
};


