# The CI

## Adding a job to `ci gate` takes two pull requests, and a third to make it required

`ci gate` runs the copy of `scripts/ci/plan/gate.py` and `map.toml` that the base commit holds, so that a pull request cannot rewrite the rule that judges it. The same rule keeps a pull request from adding a job to the `needs` of the gate in the pull request that teaches the map about it: the base map does not know the job, and the gate fails closed on a job it does not know (`jobs the map does not know`).

1. **Teach the base.** One pull request adds the suite to `scripts/ci/plan/map.toml` and lists its name under `optional`. A suite listed there is known and may be missing from the gate: while it is missing nothing is asked of it, and once it is in `needs` it is judged like any other (it has to succeed when the plan says `true`, and be skipped when it says `false`). This pull request does not touch the `needs` of the gate or add the job, so it passes with the gate as it is.
2. **Add the job.** The next pull request, rebased on the first, adds the job to `ci.yml`, to the `needs` of `gate` and to the outputs of `plan`, and widens what the suite reads in the map to what it is for. The base knows the suite now. Until it has a job, a suite listed as optional claims only paths that another suite judges too (`test_an_optional_suite_claims_nothing_the_others_do_not_judge`): a path that only it read would count as judged by a suite that does not run.
3. **Make it required.** A third, minimal pull request takes the name off `optional` and out of the list the tests hold (`test_a_suite_without_a_job_is_an_optional_one_and_the_list_is_closed`). Until then a pull request could remove the job from the workflow and the gate would accept its absence.

The same goes for a change of the map or of the gate that the base would read differently: it is judged by the base, so it takes effect for the pull requests after it, not for itself.
