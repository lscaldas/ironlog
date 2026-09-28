import json
import re
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "js" / "catalog-data.js"
OUTPUT = ROOT / "data" / "strengthlevel-standards.json"
USER_AGENT = "IronLog non-commercial standards collection (authorized by StrengthLevel)"
DELAY_SECONDS = 3.0
LEVELS = ["beginner", "novice", "intermediate", "advanced", "elite"]
ALIASES = {
    "Pushups": "push-ups",
    "Pullups": "pull-ups",
    "Dumbbell Press": "dumbbell-bench-press",
    "Pec Deck": "machine-chest-fly",
    "Parallel Bar Dips": "dips",
    "Incline Pushups": "incline-push-up",
    "Decline Pushups": "decline-push-up",
    "Single-arm Lat Pulldown": "one-arm-lat-pulldown",
    "Cable Rows": "seated-cable-row",
    "Single-arm Cable Row": "one-arm-seated-cable-row",
    "Barbell Row": "bent-over-row",
    "Overhead Press": "shoulder-press",
    "Pike Pushups": "pike-push-up",
    "Lateral Raises": "dumbbell-lateral-raise",
    "Cable Lateral Raise - Lower Path": "cable-lateral-raise",
    "Cable Lateral Raise - Upper Path": "cable-lateral-raise",
    "Front Raise": "dumbbell-front-raise",
    "Cable Rear Delt Fly": "cable-reverse-fly",
    "Face Pulls": "face-pull",
    "Dumbbell Shrugs": "dumbbell-shrug",
    "Barbell Shrugs": "barbell-shrug",
    "Trap Bar Shrugs": "hex-bar-shrug",
    "Cable Shrugs": "cable-shrug",
    "Single-arm Cable Shrugs": "cable-shrug",
    "Farmer Carries": "farmers-walk",
    "Upright Rows": "upright-row",
    "Cable Curl": "cable-bicep-curl",
    "Bayesian Cable Curl": "one-arm-cable-bicep-curl",
    "Bayesian Single-arm Curl": "one-arm-cable-bicep-curl",
    "Rope Hammer Curl": "cable-hammer-curl",
    "Concentration Curl": "dumbbell-concentration-curl",
    "Triceps Pulldown": "tricep-pushdown",
    "Triceps Overhead Extension": "cable-overhead-tricep-extension",
    "Triceps Overhead Ext.": "cable-overhead-tricep-extension",
    "Overhead Cable Triceps Extension": "cable-overhead-tricep-extension",
    "Single-arm Cable Pushdown": "tricep-pushdown",
    "Skull Crushers": "lying-tricep-extension",
    "Triceps Kickback": "dumbbell-tricep-kickback",
    "Diamond Pushups": "diamond-push-ups",
    "Reverse Curl": "reverse-barbell-curl",
    "Squats": "squat",
    "Leg Press": "sled-leg-press",
    "Lunges": "lunge",
    "Nordic Ham Curl": "nordic-hamstring-curl",
    "Glute-biased Back Extension": "back-extension",
    "Cable Woodchop": "cable-woodchopper",
    "Crunch": "crunches",
    "Sit-up": "sit-ups",
    "Single-arm Face Pulls": "face-pull",
}

def unique_exercises():
    source = CATALOG.read_text(encoding="utf-8")
    names = []
    for name in re.findall(r'\bbase:"([^"]+)"', source):
        if name not in names:
            names.append(name)
    for name in re.findall(r'\{name:"([^"]+)"', source):
        if name not in names:
            names.append(name)
    return names

def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xml"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return response.read()

def parse_cells(table, metric):
    rows = []
    for tr in table.select("tbody tr"):
        cells = [cell.get_text(" ", strip=True).replace(",", "") for cell in tr.find_all(["th", "td"])]
        if len(cells) < 6:
            continue
        parsed = []
        try:
            parsed.append(float(cells[0]))
            for cell in cells[1:6]:
                cleaned = cell.lower().replace("kg", "").strip()
                if re.match(r"^<\s*1(?:\.0+)?$", cleaned):
                    parsed.append("<1" if metric == "reps" else 0.0)
                else:
                    cleaned = cleaned.replace("+", "")
                    parsed.append(float(cleaned))
        except ValueError:
            continue
        rows.append(parsed)
    return rows

def extract_tables(html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    parsed_tables = []
    for table in soup.find_all("table"):
        headers = [cell.get_text(" ", strip=True).lower() for cell in table.select("thead th")]
        if headers[:6] != ["bw", "beg.", "nov.", "int.", "adv.", "elite"]:
            continue
        heading = table.find_previous(["h2", "h3"])
        title = heading.get_text(" ", strip=True).lower() if heading else ""
        if "reps by" in title:
            metric = "reps"
        elif "1rm weight" in title:
            metric = "addedWeight1RM"
        elif "time" in title:
            metric = "time"
        else:
            metric = "weight1RM"
        if metric == "time":
            continue
        rows = parse_cells(table, metric)
        if rows:
            parsed_tables.append({"metric": metric, "rows": rows})
    if len(parsed_tables) not in (2, 4):
        raise ValueError(f"Expected 2 or 4 bodyweight tables; found {len(parsed_tables)}")
    if len(parsed_tables) == 2:
        male_tables, female_tables = parsed_tables[:1], parsed_tables[1:]
    else:
        male_tables, female_tables = parsed_tables[:2], parsed_tables[2:]
    def sex_data(group):
        return {entry["metric"]: entry["rows"] for entry in group}
    result = {"male": sex_data(male_tables), "female": sex_data(female_tables)}
    if not any(metric in result[sex] for sex in ("male", "female") for metric in ("weight1RM", "reps", "addedWeight1RM")):
        raise ValueError("No supported bodyweight standards found")
    return result

def main():
    names = unique_exercises()
    print("Loading StrengthLevel sitemap once to validate lift URLs…", flush=True)
    root = ET.fromstring(get("https://strengthlevel.com/sitemap.xml"))
    available = {
        item.text.rstrip("/").split("/")[-2]
        for item in root.iter()
        if item.tag.endswith("loc") and "/strength-standards/" in (item.text or "") and item.text.endswith("/kg")
    }
    mappings = {}
    for name in names:
        slug = ALIASES.get(name, slugify(name))
        if slug in available:
            mappings[name] = {"slug": slug, "mapping": "alias" if name in ALIASES else "exact"}
    slugs = list(dict.fromkeys(item["slug"] for item in mappings.values()))
    refresh = "--refresh" in sys.argv
    cached_pages = {}
    if OUTPUT.exists() and not refresh:
        try:
            existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if existing.get("metadata", {}).get("rankMetrics"):
                cached_pages = existing.get("standardsBySlug", {})
        except (OSError, json.JSONDecodeError):
            cached_pages = {}
    output = {
        "metadata": {
            "source": "StrengthLevel",
            "sourcePolicy": "User reports written authorization for non-commercial use",
            "collectedOn": date.today().isoformat(),
            "units": "kg",
            "rankMetrics": ["weight1RM", "reps", "addedWeight1RM"],
            "tables": "by bodyweight only",
            "repThresholdBelowOne": "<1 is preserved as text; a recorded rep count of 1 meets it",
            "levels": LEVELS,
            "requestDelaySeconds": DELAY_SECONDS,
            "sourceUrlPattern": "https://strengthlevel.com/strength-standards/{slug}/kg",
        },
        "exerciseMappings": mappings,
        "standardsBySlug": {slug: cached_pages[slug] for slug in slugs if slug in cached_pages},
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Matched {len(mappings)}/{len(names)} catalog names to {len(slugs)} standards pages.", flush=True)
    pending_slugs = [slug for slug in slugs if slug not in output["standardsBySlug"]]
    print(f"Reusing {len(slugs) - len(pending_slugs)} cached pages; fetching {len(pending_slugs)} new pages.", flush=True)
    for index, slug in enumerate(pending_slugs, 1):
        time.sleep(DELAY_SECONDS)
        url = f"https://strengthlevel.com/strength-standards/{slug}/kg"
        try:
            tables = extract_tables(get(url))
        except Exception as exc:
            print(f"SKIP {slug}: {exc}", flush=True)
            continue
        output["standardsBySlug"][slug] = {"url": url, "bySex": tables}
        temp = OUTPUT.with_suffix(".json.tmp")
        temp.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(OUTPUT)
        if index % 5 == 0 or index == len(pending_slugs):
            print(f"Collected {index}/{len(pending_slugs)} new pages; saved {len(output['standardsBySlug'])} total.", flush=True)
    output["exerciseMappings"] = {
        name: mapping for name, mapping in mappings.items()
        if mapping["slug"] in output["standardsBySlug"]
    }
    used_slugs = {mapping["slug"] for mapping in output["exerciseMappings"].values()}
    output["standardsBySlug"] = {
        slug: page for slug, page in output["standardsBySlug"].items()
        if slug in used_slugs
    }
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(OUTPUT)
    print(
        f"DONE: {OUTPUT} ({len(output['standardsBySlug'])}/{len(slugs)} pages; "
        f"{len(output['exerciseMappings'])}/{len(names)} catalog exercises with at least one supported metric)",
        flush=True,
    )

if __name__ == "__main__":
    main()
