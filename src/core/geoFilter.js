'use strict';

// ─── Indian city/location keywords ───────────────────────────────────────────

const INDIA_KEYWORDS = [
  'india',
  'indian',
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
  'pimpri',
  'mohali',
  'zirakpur',
];

// ─── Remote/location-agnostic keywords ──────────────────────────────────────

const REMOTE_KEYWORDS = [
  'remote',
  'work from home',
  'wfh',
  'anywhere',
  'worldwide',
  'global',
  'distributed',
  'fully remote',
  'remote-first',
  'location independent',
  'virtual',
  'telecommute',
];

// ─── Global companies worth showing separately ───────────────────────────────

const REPUTABLE_COMPANIES = [
  'google',
  'alphabet',
  'microsoft',
  'amazon',
  'aws',
  'meta',
  'facebook',
  'apple',
  'netflix',
  'openai',
  'anthropic',
  'deepmind',
  'nvidia',
  'goldman sachs',
  'jane street',
  'two sigma',
  'citadel',
  'de shaw',
  'jump trading',
  'optiver',
  'tower research',
  'stripe',
  'airbnb',
  'uber',
  'linkedin',
  'salesforce',
  'adobe',
  'oracle',
  'ibm',
  'qualcomm',
  'intel',
  'amd',
  'arm',
  'atlassian',
  'zoom',
  'slack',
  'shopify',
  'dropbox',
  'notion',
  'figma',
  'canva',
  'databricks',
  'snowflake',
  'palantir',
  'coinbase',
  'robinhood',
  'square',
  'block',
  'spacex',
  'tesla',
  'bytedance',
  'tiktok',
  'samsung',
  'sony',
  'lg',
  'siemens',
  'sap',
  'servicenow',
  'workday',
  'hubspot',
  'twilio',
];

// ─── Sources that are primarily India-focused ───────────────────────────────

const INDIA_PRIMARY_SOURCES = [
  'Internshala',
  'Naukri',
  'Freshersworld',
];

function isIndia(location) {
  if (!location) return false;

  const loc = location.toLowerCase();

  return INDIA_KEYWORDS.some((keyword) =>
    loc.includes(keyword)
  );
}

function isRemote(location) {
  if (!location) return false;

  const loc = location.toLowerCase();

  return REMOTE_KEYWORDS.some((keyword) =>
    loc.includes(keyword)
  );
}

function isReputableCompany(company) {
  if (!company) return false;

  const co = company.toLowerCase();

  return REPUTABLE_COMPANIES.some((companyName) =>
    co.includes(companyName)
  );
}

// ─── Main India/Remote Filter ────────────────────────────────────────────────
//
// Main results:
//   - India jobs
//   - Remote jobs
//
// Global on-site jobs are NOT included here.

function passesGeoFilter(job) {
  const location = (job.location || '').toLowerCase().trim();

  if (isIndia(location)) {
    return true;
  }

  if (isRemote(location)) {
    return true;
  }

  // India-primary sources with no location information.
  if (!location) {
    return INDIA_PRIMARY_SOURCES.includes(job.source);
  }

  return false;
}

// ─── Global Secondary Filter ─────────────────────────────────────────────────
//
// These jobs are intentionally kept separate from the main India results.
//
// Includes:
//   - Global remote jobs
//   - Jobs from reputable global companies
//
// Does NOT automatically put them into the main notification list.

function passesGlobalFilter(job) {
  const location = (job.location || '').toLowerCase().trim();
  const company = job.company || '';

  // Already covered by main India/Remote results.
  if (isIndia(location) || isRemote(location)) {
    return false;
  }

  // Global jobs from reputable companies.
  if (isReputableCompany(company)) {
    return true;
  }

  return false;
}

// ─── Geo Tag ─────────────────────────────────────────────────────────────────

function getGeoTag(job) {
  const location = (job.location || '').toLowerCase();

  if (isRemote(location)) {
    return '🌐 Remote';
  }

  if (isIndia(location)) {
    return '🇮🇳 India';
  }

  return '🌍 Global';
}

module.exports = {
  passesGeoFilter,
  passesGlobalFilter,
  getGeoTag,
  isIndia,
  isRemote,
  isReputableCompany,
};