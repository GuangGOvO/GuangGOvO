from pathlib import Path
import json
import sys
import re
import yaml

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
EXPECTED = {"update-profile.yml", "generate-stats.yml", "contribution-snake.yml"}
files = set(path.name for path in WORKFLOWS.glob("*.yml"))
if files != EXPECTED:
    raise SystemExit(f"Workflow set mismatch: expected {sorted(EXPECTED)}, found {sorted(files)}")

config = json.loads((ROOT / "profile.config.json").read_text(encoding="utf-8"))
hour_text, minute_text = config["updates"]["baseTimeUtc"].split(":")
base_minutes = int(hour_text) * 60 + int(minute_text)
expected_crons = {
    "update-profile.yml": base_minutes,
    "generate-stats.yml": base_minutes + 10,
    "contribution-snake.yml": base_minutes + 20,
}
concurrency_groups = set()

for filename in sorted(EXPECTED):
    path = WORKFLOWS / filename
    with path.open(encoding="utf-8") as stream:
        document = yaml.load(stream, Loader=yaml.BaseLoader)
    if not isinstance(document, dict) or "name" not in document or "on" not in document or "jobs" not in document:
        raise SystemExit(f"{filename}: missing workflow top-level keys")
    if "workflow_dispatch" not in document["on"] or "schedule" not in document["on"]:
        raise SystemExit(f"{filename}: expected workflow_dispatch and schedule triggers")
    schedule = document["on"]["schedule"]
    expected_minute = expected_crons[filename] % 60
    expected_hour = (expected_crons[filename] // 60) % 24
    expected_cron = f"{expected_minute} {expected_hour} * * *"
    if not schedule or schedule[0].get("cron") != expected_cron:
        raise SystemExit(f"{filename}: expected the daily UTC schedule {expected_cron!r}")
    concurrency = document.get("concurrency", {})
    if concurrency.get("cancel-in-progress") != "false":
        raise SystemExit(f"{filename}: concurrency must queue, not cancel, an active refresh")
    concurrency_groups.add(concurrency.get("group"))
    if not document["jobs"]:
        raise SystemExit(f"{filename}: no jobs were declared")
    for job_name, job in document["jobs"].items():
        if "runs-on" not in job or not job.get("steps"):
            raise SystemExit(f"{filename}: job {job_name} needs runs-on and steps")
        if job.get("permissions") != {"contents": "write"}:
            raise SystemExit(f"{filename}: job {job_name} must grant only contents: write")
        for index, step in enumerate(job["steps"]):
            action = step.get("uses")
            if action and not re.search(r"@[0-9a-f]{40}$", action):
                raise SystemExit(f"{filename}: step {index + 1} uses a mutable action reference")
            if "run" not in step and "uses" not in step:
                raise SystemExit(f"{filename}: step {index + 1} needs uses or run")

if len(concurrency_groups) != 1:
    raise SystemExit("All workflows must share one concurrency group to serialize generated-file writes")

print(f"Validated GitHub Actions YAML structure and immutable action pins for {len(EXPECTED)} workflows.")
