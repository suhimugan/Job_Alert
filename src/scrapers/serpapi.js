'use strict';

const API_URL = 'https://serpapi.com/search.json';

const QUERIES = [
  'Power BI Developer jobs',
  'Power BI Analyst jobs',
  'Data Analyst jobs',
  'Business Intelligence Analyst jobs',
  'Data Engineer Azure jobs',
  'Analytics Engineer jobs',
  'site:naukri.com Power BI Data Analyst jobs',
  'site:linkedin.com/jobs Power BI Data Analyst jobs',
];

const INDIA_KEYWORDS = [
  'india',
  'bangalore',
  'bengaluru',
  'mumbai',
  'delhi',
  'new delhi',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata',
  'noida',
  'gurgaon',
  'gurugram',
  'ahmedabad',
  'jaipur',
  'kota',
  'indore',
  'bhopal',
  'surat',
  'chandigarh',
  'coimbatore',
  'kochi',
  'thiruvananthapuram',
  'vizag',
  'visakhapatnam',
  'nagpur',
  'vadodara',
  'lucknow',
  'bhubaneswar',
  'mysore',
  'mysuru',
  'navi mumbai',
  'thane',
];

const REMOTE_KEYWORDS = [
  'remote',
  'work from home',
  'wfh',
  'anywhere',
  'worldwide',
  'global',
  'distributed',
];

const FOREIGN_LOCATION_KEYWORDS = [
  'san francisco',
  'miami',
  'new york',
  'london',
  'leeds',
  'manchester',
  'toronto',
  'california',
  'florida',
  'usa',
  'uk',
  'canada',
  'australia',
];

function isIndiaOrRemote(job) {
  const text = [
    job.title,
    job.location,
    job.description,
    job.url,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (REMOTE_KEYWORDS.some((x) => text.includes(x))) {
    return true;
  }

  return INDIA_KEYWORDS.some((x) => text.includes(x));
}

function isForeignOnly(job) {
  const text = [
    job.title,
    job.location,
    job.description,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return FOREIGN_LOCATION_KEYWORDS.some((x) =>
    text.includes(x)
  );
}

function isLikelyJobUrl(url) {
  if (!url) return false;

  const value = url.toLowerCase();

  // Strong individual-job URLs.
  if (value.includes('linkedin.com/jobs/view/')) return true;
  if (value.includes('naukri.com/job-listings-')) return true;
  if (value.includes('foundit.in/job/')) return true;
  if (value.includes('indeed.com/viewjob')) return true;

  // Glassdoor job pages are useful but sometimes noisy.
  if (value.includes('glassdoor.co.in/job-listing/')) return true;
  if (value.includes('glassdoor.com/job-listing/')) return true;

  // Other individual job pages.
  if (
    value.includes('/job/') ||
    value.includes('/job-') ||
    value.includes('/jobs/view/') ||
    value.includes('/vacancy/') ||
    value.includes('/position/')
  ) {
    return true;
  }

  // Reject generic career/location/listing pages.
  return false;
}

function normalizePostedAt(item) {
  return (
    item.date ||
    item.detected_extensions?.posted_at ||
    ''
  );
}

function isWithin24Hours(postedAt) {
  if (!postedAt) return false;

  const text = String(postedAt).toLowerCase().trim();

  return (
    text.includes('just now') ||
    text.includes('minute') ||
    text.includes('hour') ||
    text === 'today' ||
    text.includes('today') ||
    text.includes('1 day ago') ||
    text.includes('1 day')
  );
}

function normalizeResult(item, query) {
  const url =
    item.link ||
    item.redirect_link ||
    '';

  const postedAt = normalizePostedAt(item);

  return {
    title: item.title || '',
    company:
      item.company_name ||
      item.company ||
      '',
    location:
      item.location ||
      '',
    description:
      item.snippet ||
      '',
    url,
    postedAt,
    source:
      item.source ||
      item.via?.replace(/^via\s+/i, '') ||
      'Google Search',
    salary:
      item.detected_extensions?.salary ||
      '',
    type:
      item.detected_extensions?.schedule_type ||
      'fulltime',
    query,
    isRecent: isWithin24Hours(postedAt),
  };
}

async function searchSerpApi(apiKey, query, attempt = 1) {
  const params = new URLSearchParams({
    engine: 'google',
    q: query,
    location: 'India',
    google_domain: 'google.co.in',
    gl: 'in',
    hl: 'en',
    num: '10',
    tbs: 'qdr:d',
    api_key: apiKey,
  });

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    90000
  );

  try {
    const response = await fetch(
      `${API_URL}?${params}`,
      {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `SerpAPI HTTP ${response.status}: ${text.slice(0, 300)}`
      );
    }

    const data = JSON.parse(text);

    if (data.error) {
      throw new Error(
        `SerpAPI error: ${data.error}`
      );
    }

    return data;
  } catch (error) {
    if (
      attempt === 1 &&
      (
        error.name === 'AbortError' ||
        String(error.message).toLowerCase().includes('timeout')
      )
    ) {
      console.log('      ↻ Retrying once...');
      return searchSerpApi(apiKey, query, 2);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function scrape(apiKey, maxQueries = QUERIES.length) {
  if (!apiKey) {
    throw new Error('SERPAPI_KEY is missing');
  }

  const selectedQueries = QUERIES.slice(
    0,
    maxQueries
  );

  console.log(
    `🔎 SerpAPI: running ${selectedQueries.length} Google Search quer${
      selectedQueries.length === 1
        ? 'y'
        : 'ies'
    }`
  );

  const allJobs = [];

  for (
    let i = 0;
    i < selectedQueries.length;
    i++
  ) {
    const query = selectedQueries[i];

    try {
      console.log(
        `   [${i + 1}/${selectedQueries.length}] ${query}`
      );

      const data = await searchSerpApi(
        apiKey,
        query
      );

      const organic =
        Array.isArray(data.organic_results)
          ? data.organic_results
          : [];

      console.log(
        `      Google returned ${organic.length} results`
      );

      const jobs = organic
        .map((item) =>
          normalizeResult(item, query)
        )
        .filter(
          (job) =>
            job.title &&
            job.url
        )
        .filter((job) =>
          isLikelyJobUrl(job.url)
        )
        .filter((job) =>
          isWithin24Hours(job.postedAt)
        )
        .filter((job) =>
          isIndiaOrRemote(job)
        )
        .filter((job) =>
          !isForeignOnly(job)
        );

      console.log(
        `      kept ${jobs.length} India/Remote recent job pages`
      );

      allJobs.push(...jobs);
    } catch (error) {
      console.error(
        `      ❌ Query failed: ${
          error.message || error
        }`
      );
    }
  }

  const unique = [];
  const seen = new Set();

  for (const job of allJobs) {
    const key =
      job.url.toLowerCase().trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(job);
  }

  console.log(
    `\n   📦 SerpAPI total: ${allJobs.length} recent India/Remote results`
  );

  console.log(
    `   ✨ SerpAPI unique: ${unique.length} jobs`
  );

  return unique;
}

module.exports = {
  scrape,
  searchSerpApi,
  isWithin24Hours,
};