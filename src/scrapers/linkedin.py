from jobspy import scrape_jobs
import json
import sys

SEARCHES = [
    "Power BI Developer",
    "Power BI Analyst",
    "Data Analyst",
    "Business Intelligence Analyst",
    "Azure Data Engineer",
    "Data Engineer",
    "Analytics Engineer",
]

LOCATION = "India"
RESULTS_PER_QUERY = 20
HOURS_OLD = 72


def clean(value):
    if value is None:
        return ""
    try:
        if hasattr(value, "isoformat"):
            return value.isoformat()
    except Exception:
        pass
    return str(value)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    all_jobs = []
    seen = set()

    for index, search_term in enumerate(SEARCHES, 1):
        print(
            f"[LinkedIn] [{index}/{len(SEARCHES)}] "
            f"Searching: {search_term}",
            file=sys.stderr,
        )

        try:
            jobs = scrape_jobs(
                site_name=["linkedin"],
                search_term=search_term,
                location=LOCATION,
                results_wanted=RESULTS_PER_QUERY,
                hours_old=HOURS_OLD,
                linkedin_fetch_description=True,
                verbose=0,
            )

            if jobs is None or len(jobs) == 0:
                print(
                    f"[LinkedIn]   0 jobs",
                    file=sys.stderr,
                )
                continue

            print(
                f"[LinkedIn]   {len(jobs)} jobs returned",
                file=sys.stderr,
            )

            for _, row in jobs.iterrows():
                title = clean(row.get("title"))
                company = clean(row.get("company"))
                location = clean(row.get("location"))
                url = clean(row.get("job_url"))
                description = clean(row.get("description"))
                date_posted = clean(row.get("date_posted"))

                if not title or not url:
                    continue

                key = (
                    url.split("?")[0].split("#")[0].lower()
                    if url
                    else f"{title.lower()}|{company.lower()}|{location.lower()}"
                )

                if key in seen:
                    continue

                seen.add(key)

                all_jobs.append({
                    "title": title,
                    "company": company,
                    "location": location,
                    "description": description,
                    "url": url,
                    "postedAt": date_posted,
                    "datePosted": date_posted,
                    "source": "LinkedIn",
                    "type": "fulltime",
                    "experience": clean(row.get("job_level")),
                })

        except Exception as exc:
            print(
                f"[LinkedIn]   ERROR: {exc}",
                file=sys.stderr,
            )

    print(
        f"[LinkedIn] Total unique jobs: {len(all_jobs)}",
        file=sys.stderr,
    )

    print(json.dumps(all_jobs, ensure_ascii=False))


if __name__ == "__main__":
    main()

