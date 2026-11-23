#!/usr/bin/env python3
"""The one check that says whether the CI of a change is complete.

  NEEDS="$json" gate.py --map map.toml

NEEDS is `toJSON(needs)` of the gate job: the result of every job it waits for,
and the outputs of `plan`. The gate passes when each suite did what `plan` said:

  plan said true  -> the job succeeded
  plan said false -> the job was skipped

and each job the map lists under `always` (what judges the whole tree) succeeded,
whatever the plan said: the plan does not decide those.

A suite or a job of `always` that the map lists under `optional` is known and may be
missing from `needs`:
the map is the base commit's, so a job that a pull request adds to the gate has to
be taught to the base first, by a pull request that adds it to the map as
optional, and added to the workflow by the next. While it is missing nothing is
asked of it; once it is in `needs` it is judged like any other. A third pull
request takes the word `optional` off and the job is required from then on.

Anything else fails it: a suite that was skipped without being told to (a job
before it failed), one that ran when nothing of its own changed, a cancelled or
failed one, a suite of the map that is missing from `needs` and is not optional,
a job the map does not know, or a `plan` that did not succeed. GitHub reports a skipped job as a success, so a required check
that leans on a job directly can be satisfied by a job that never ran; this one
cannot.
"""

import json
import os
import sys
import tomllib


def verdicts(needs: dict, suites: "list[str]", always: "list[str]" = (), optional: "list[str]" = ()) -> "list[str]":
    """The problems found, empty when the gate may pass."""
    problems = []
    plan = needs.get("plan")
    if not isinstance(plan, dict) or plan.get("result") != "success":
        got = plan.get("result") if isinstance(plan, dict) else "missing"
        return [f"plan: {got}, not success; nothing says what had to run"]
    outputs = plan.get("outputs") or {}
    for suite in suites:
        job = needs.get(suite)
        if not isinstance(job, dict):
            if suite not in optional:
                problems.append(f"{suite}: not among the jobs the gate waits for")
            continue
        result = job.get("result")
        wanted = outputs.get(suite)
        if wanted == "true":
            if result != "success":
                problems.append(f"{suite}: had to run and finished {result}")
        elif wanted == "false":
            if result != "skipped":
                problems.append(f"{suite}: nothing of its own changed and it finished {result}")
        else:
            problems.append(f"{suite}: plan printed {wanted!r}, not true or false")
    for job in always:
        got = needs.get(job)
        if not isinstance(got, dict) and job in optional:
            continue
        result = got.get("result") if isinstance(got, dict) else "missing"
        if result != "success":
            problems.append(f"{job}: runs on every change and finished {result}")
    extra = sorted(set(needs) - set(suites) - set(always) - {"plan"})
    if extra:
        problems.append(f"jobs the map does not know: {', '.join(extra)}")
    return problems


def main() -> int:
    map_path = sys.argv[sys.argv.index("--map") + 1] if "--map" in sys.argv else ""
    if not map_path:
        print("usage: NEEDS=<json> gate.py --map map.toml", file=sys.stderr)
        return 2
    try:
        needs = json.loads(os.environ["NEEDS"])
    except (KeyError, ValueError):
        print("::error::NEEDS is missing or is not JSON", file=sys.stderr)
        return 1
    with open(map_path, "rb") as handle:
        data = tomllib.load(handle)
    suites = list(data["suites"])
    always = list(data.get("always", []))
    optional = list(data.get("optional", []))
    unknown = [name for name in optional if name not in suites and name not in always]
    if unknown:
        print(f"::error::the map lists as optional what is not a suite or a job of always: {', '.join(unknown)}", file=sys.stderr)
        return 1

    problems = verdicts(needs, suites, always, optional)
    outputs = (needs.get("plan") or {}).get("outputs") or {}
    for suite in suites:
        job = needs.get(suite) or {}
        absent = " (optional, not in the workflow yet)" if suite in optional and suite not in needs else ""
        print(f"{suite:16} planned={outputs.get(suite, '?'):5} result={job.get('result', '-')}{absent}")
    for job in always:
        absent = " (optional, not in the workflow yet)" if job in optional and job not in needs else ""
        print(f"{job:16} always  result={(needs.get(job) or {}).get('result', '-')}{absent}")
    for problem in problems:
        print(f"::error::{problem}")
    if problems:
        return 1
    print("Every suite did what the plan said.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
