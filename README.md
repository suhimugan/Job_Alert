# Job Alert Bot

Automated daily job discovery, filtering, ranking, and email alerts for **India / Remote** data, BI, Power BI, and Azure data engineering roles.

The system discovers jobs from multiple sources, removes duplicates, filters irrelevant roles, evaluates candidate fit, generates resume/application guidance, and sends a consolidated email report.

---

## 🎯 Target Roles

The bot is configured around the following target areas:

* Power BI Developer
* Power BI Analyst
* BI Analyst
* BI Developer
* Business Intelligence
* Data Analyst
* Data Engineer
* Azure Data Engineer
* Analytics Engineer
* Related Azure / BI / data engineering positions

### Experience Preference

The target profile is **2+ years of experience**.

The system does **not** automatically reject roles simply because they contain titles such as:

* Senior
* Lead
* Principal
* Manager
* Architect

Experience requirements are considered as part of candidate scoring rather than using seniority titles alone as a hard exclusion.

Roles requiring significantly more experience may still appear in the report, allowing manual review.

---

# 🚀 Features

## Multi-source job discovery

The production pipeline currently uses:

1. RemoteOK
2. We Work Remotely
3. Y Combinator
4. Remotive
5. Naukri
6. LinkedIn
7. SerpAPI / Google organic search

The system is designed so additional sources can be added independently.

---

## LinkedIn Job Discovery

LinkedIn jobs are collected using **JobSpy** through the Python scraper.

The LinkedIn scraper searches multiple target queries, including:

* Power BI Developer
* Power BI Analyst
* Data Analyst
* Business Intelligence Analyst
* Azure Data Engineer
* Data Engineer
* Analytics Engineer

The scraper:

* Searches LinkedIn jobs in India
* Collects recent jobs
* Fetches descriptions where available
* Returns structured JSON to the Node.js pipeline
* Integrates with the same filtering, scoring, deduplication, and email pipeline as other sources

The Python dependency is installed automatically in GitHub Actions.

---

## Naukri Discovery

Naukri is handled separately using a Playwright-based scraper.

The scraper uses recent-job filtering and collects relevant India-based roles.

This approach is used instead of the JobSpy Naukri scraper because direct JobSpy Naukri requests encountered CAPTCHA / HTTP 406 restrictions.

---

# 🧠 Job Processing Pipeline

Every run follows this general flow:

```text
Job Sources
    ↓
Scrape Jobs
    ↓
Role Relevance Filter
    ↓
Geography Filter
    ↓
Experience / Junk Filtering
    ↓
Deduplication
    ↓
Candidate Ranking
    ↓
AI Evaluation (when available)
    ↓
Fallback Match Scoring
    ↓
Resume Gap Analysis
    ↓
Resume Tailoring Advice
    ↓
Application Advice
    ↓
Final Job Ranking
    ↓
Email Report
    ↓
Update Seen-Jobs Database
```

---

# 🔎 Filtering

The system filters jobs using several layers.

## Role filtering

Jobs are evaluated against the target role groups:

* Power BI / BI
* Data Analyst
* Azure Data Engineer
* Data Engineer

Irrelevant roles such as unrelated software development, sales, marketing, recruiting, and other non-target positions are reduced during filtering.

---

## Geography filtering

Primary target:

* India
* Remote opportunities

Global jobs can be retained as a secondary category when appropriate.

---

## Experience filtering

The system is designed around a **2+ years** candidate profile.

It recognizes experience ranges such as:

* 2–4 years
* 3–5 years
* 5–8 years
* 8–10 years
* 10+ years

Experience is incorporated into candidate ranking rather than treating every senior title as an automatic rejection.

---

## Junk filtering

Obvious non-target and low-value listings are removed before the expensive evaluation stages.

---

# 📊 Candidate Ranking

Before AI evaluation, jobs are ranked to identify the strongest candidates for deeper analysis.

The ranking considers factors including:

* Target role relevance
* Power BI / BI skills
* Azure skills
* SQL
* DAX
* Power Query
* Excel
* Data Engineering
* ETL
* Data pipelines
* ADF
* Synapse
* Data analysis
* Data visualization
* Engineering technologies
* Experience compatibility
* Seniority
* Walk-in / urgent hiring indicators

The candidate pool is currently limited to:

```text
25 AI candidates per run
```

This prevents excessive AI API usage while allowing the email report to contain all new relevant jobs.

---

# 🤖 AI Evaluation

The project supports LLM-based job evaluation.

Current provider order:

1. Groq
2. OpenRouter

The AI evaluator can analyze:

* Job fit
* Match score
* Seniority compatibility
* Relevant skills
* Job requirements
* Candidate suitability
* Reasoning

The AI candidate pool is intentionally limited to avoid excessive API consumption.

### AI fallback

If AI providers are unavailable, rate-limited, or return an invalid response, the system automatically falls back to deterministic scoring.

The job pipeline therefore continues operating even when AI evaluation is unavailable.

---

# 📈 Match Scoring

The fallback scoring system evaluates the job against the configured candidate profile.

The profile includes skills such as:

* Power BI
* Power BI / PowerBI
* DAX
* Power Query
* SQL
* Excel
* Azure
* Azure Data Factory
* Azure Synapse Analytics
* Data Engineering
* Data Analysis
* Business Intelligence
* ETL
* Data Visualization
* Data Pipelines

Additional engineering skills include:

* Python
* PySpark
* Spark
* Databricks
* Microsoft Fabric
* Data Lake
* Data Warehouse

The fallback score is used whenever AI scoring is unavailable.

---

# 🏷️ Job Categories

Jobs are classified into:

|  Score | Category  |
| -----: | --------- |
| 85–100 | Excellent |
|  70–84 | Strong    |
|  55–69 | Good      |
|  40–54 | Possible  |
|   0–39 | Weak      |

Fallback results are labelled separately:

```text
Excellent (fallback)
Strong (fallback)
Good (fallback)
Possible (fallback)
Weak (fallback)
```

This makes it clear whether a score came from AI or deterministic fallback logic.

---

# 📄 Resume Analysis

For relevant jobs, the system generates:

## Resume gaps

Identifies skills or technologies mentioned in the job that are not currently represented in the configured resume profile.

## Resume tailoring

Provides suggestions such as:

* Which existing skills should be emphasized
* Which technologies should be moved higher in the resume
* Which project or experience areas should be highlighted
* Which keywords are relevant to the job

The system explicitly avoids recommending that the candidate falsely claim technologies they do not actually have.

---

# 📝 Application Advice

Each selected job can include:

* Recommended application positioning
* Skills to emphasize
* Technologies to mention
* Technologies that should not be claimed without real experience
* Suggested application message

Example:

```text
Hi, I'm interested in the Power BI Developer opportunity.
My background in Power BI, DAX / Power Query, SQL / ETL,
data engineering, and Azure data engineering aligns well
with the requirements of this role.
```

---

# 📧 Email Reports

The primary notification channel is email.

The email contains:

* Run statistics
* Job category breakdown
* India / Remote jobs
* Global jobs when available
* Match score
* Score source
* Job rank
* Company
* Location
* Experience
* Source
* Job description
* Matched skills
* Resume gaps
* Resume tailoring suggestions
* Application advice
* Suggested application message
* Apply / original posting link

### No artificial email cap

The AI evaluation pool is limited, but **email visibility is not capped**.

For example:

```text
93 relevant jobs
25 AI candidates
93 fallback-scored jobs
63 new jobs
63 emailed
```

All new relevant jobs can therefore appear in the email, even when only a subset received AI evaluation.

---

# 📬 No-Jobs Notification

If there are no new relevant jobs, the bot can send a separate notification:

```text
Job Alerts — No New Jobs Today
```

This confirms that the scheduled job ran successfully even when there are no new matches.

---

# 🗃️ Duplicate Protection

The project maintains:

```text
data/seen_jobs.json
```

Jobs are identified using normalized job information including:

* Job title
* Company
* URL

Previously emailed jobs are not emailed again.

---

## Email failure safety

The database is updated **only after successful email delivery**.

Therefore:

```text
Email succeeds
    ↓
Job marked as seen
```

while:

```text
Email fails
    ↓
Job remains unseen
    ↓
Job can be retried on the next run
```

This prevents jobs from being permanently lost when an email provider temporarily fails.

---

# 🧪 Dry Run

The application supports dry-run testing:

```powershell
node src\main.js --dry-run
```

Dry-run mode:

* Scrapes jobs
* Filters jobs
* Scores jobs
* Generates ranking
* Displays notification preview
* Does not send email
* Does not update the seen-jobs database

This is useful for validating changes before production execution.

---

# 🌱 Seed Mode

Seed mode is intended only for the initial database setup.

It marks currently discovered jobs as already seen so that the first production notification does not send the entire existing job inventory.

Seed mode should **not** be run repeatedly.

After the initial setup, normal scheduled runs should be used.

---

# ⚙️ Environment Variables

Typical production configuration includes:

```env
USE_SERPAPI=true
USE_LLM=true
DRY_RUN=false
```

The exact secrets and API keys are stored in environment variables / GitHub Actions Secrets and are not committed to the repository.

Important credentials include:

* Resend API key
* Groq API key
* OpenRouter API key
* SerpAPI key

---

# 🕐 GitHub Actions

The production workflows are located in:

```text
.github/workflows/
```

Current workflows:

```text
scrape-morning.yml
scrape-evening.yml
scrape-seed.yml
```

---

## Morning Job Alerts

Runs at approximately:

```text
9:00 AM IST
```

Configuration:

```text
SerpAPI: enabled
LLM: enabled
Email: enabled
Dry Run: disabled
```

The morning run performs the full discovery and evaluation pipeline.

---

## Evening Job Alerts

Runs at approximately:

```text
9:00 PM IST
```

Configuration:

```text
SerpAPI: disabled
LLM: disabled
Email: enabled
Dry Run: disabled
```

The evening run uses the free/local scraping sources and does not consume the limited SerpAPI or AI quota.

---

## Seed Run

Seed workflow is intended for manual first-time setup only.

It should not be scheduled as a daily production job.

---

# 🐍 Python Dependency

Most of the project is Node.js.

Python is currently required for the LinkedIn JobSpy scraper.

GitHub Actions automatically performs:

```yaml
- name: Setup Python 3.12
  uses: actions/setup-python@v5
  with:
    python-version: '3.12'

- name: Install LinkedIn scraper dependencies
  run: |
    python -m pip install --upgrade pip
    python -m pip install python-jobspy
```

The Node.js application invokes the Python scraper and consumes its JSON output.

---

# 📁 Project Structure

```text
Job_Alert/
│
├── .github/
│   └── workflows/
│       ├── scrape-morning.yml
│       ├── scrape-evening.yml
│       └── scrape-seed.yml
│
├── data/
│   └── seen_jobs.json
│
├── src/
│   ├── core/
│   │   ├── applicationAdvice.js
│   │   ├── candidateRanker.js
│   │   ├── database.js
│   │   ├── experienceFilter.js
│   │   ├── filter.js
│   │   ├── geoFilter.js
│   │   ├── jobCategories.js
│   │   ├── jobRanker.js
│   │   ├── junkFilter.js
│   │   ├── llmEvaluator.js
│   │   ├── matchScoring.js
│   │   ├── resumeGapAnalysis.js
│   │   └── resumeTailoring.js
│   │
│   ├── notifiers/
│   │   └── email.js
│   │
│   ├── scrapers/
│   │   ├── index.js
│   │   ├── linkedin.js
│   │   ├── linkedin.py
│   │   ├── naukri.js
│   │   ├── serpapi.js
│   │   ├── remoteok.js
│   │   ├── remotive.js
│   │   ├── weworkremotely.js
│   │   └── ycombinator.js
│   │
│   └── main.js
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

# 🧰 Local Development

Install Node.js dependencies:

```powershell
npm install
```

Install the LinkedIn scraper dependency:

```powershell
python -m pip install python-jobspy
```

Run the production pipeline locally:

```powershell
node src\main.js
```

Run a dry test:

```powershell
node src\main.js --dry-run
```

---

# 🔍 Syntax Validation

Before committing changes, validate the main Node.js files:

```powershell
node --check src\main.js
node --check src\scrapers\index.js
node --check src\scrapers\linkedin.js
node --check src\scrapers\naukri.js
node --check src\scrapers\serpapi.js
```

Validate the Python scraper:

```powershell
python -m py_compile src\scrapers\linkedin.py
```

Check Git formatting:

```powershell
git diff --check
```

---

# 📊 Example Production Run

A successful production run can look like:

```text
Raw jobs discovered:       273
Role relevant:             114
India / Remote:             93
Pre-AI unique:              93
AI candidates:              25
AI scored:                   0
Fallback scored:            93
New India / Remote:         63
Jobs emailed:               63
```

The system can continue successfully using fallback scoring when AI providers are unavailable.

---

# 🔐 Security

Secrets must never be committed to Git.

The `.gitignore` excludes:

```text
.env
node_modules/
*.pyc
__pycache__/
```

API keys should be stored in:

* Local `.env` for development
* GitHub Actions Secrets for production

---

# 🧭 Current Production Status

| Component                        | Status |
| -------------------------------- | ------ |
| Job discovery                    | ✅      |
| RemoteOK                         | ✅      |
| We Work Remotely                 | ✅      |
| Y Combinator                     | ✅      |
| Remotive                         | ✅      |
| Naukri                           | ✅      |
| LinkedIn / JobSpy                | ✅      |
| SerpAPI                          | ✅      |
| Role filtering                   | ✅      |
| Geography filtering              | ✅      |
| Junk filtering                   | ✅      |
| Experience handling              | ✅      |
| Deduplication                    | ✅      |
| Candidate ranking                | ✅      |
| AI evaluation structure          | ✅      |
| Fallback scoring                 | ✅      |
| Job categorization               | ✅      |
| Resume gap analysis              | ✅      |
| Resume tailoring                 | ✅      |
| Application advice               | ✅      |
| Final ranking                    | ✅      |
| Email reporting                  | ✅      |
| No-jobs notification             | ✅      |
| Seen-job database                | ✅      |
| Email failure retry safety       | ✅      |
| Dry run                          | ✅      |
| GitHub Actions                   | ✅      |
| Morning workflow                 | ✅      |
| Evening workflow                 | ✅      |
| LinkedIn GitHub dependency setup | ✅      |
| Production email test            | ✅      |

---

# 🏁 Production Workflow

The intended daily workflow is:

```text
Morning
   ↓
7 job sources
   ↓
Filter + deduplicate
   ↓
Candidate ranking
   ↓
AI evaluation when available
   ↓
Fallback scoring when necessary
   ↓
Resume / application analysis
   ↓
Final ranking
   ↓
Email all new relevant jobs
   ↓
Mark successfully emailed jobs as seen

Evening
   ↓
Free job sources
   ↓
Filter + deduplicate
   ↓
Fallback scoring
   ↓
Email new jobs
   ↓
Update seen-jobs database
```

The system is designed to run continuously with minimal manual intervention while preserving visibility into new India / Remote opportunities.
