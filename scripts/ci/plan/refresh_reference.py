#!/usr/bin/env python3
"""Write the reference copies of the workflows, after the change has been read.

	python3 scripts/ci/plan/refresh_reference.py

Each workflow in FILES is read with the strict loader and written, without its
comments, to scripts/ci/plan/reference/<file>. test_contract.py holds every
workflow equal to its copy, so a change to a workflow shows twice in a pull
request: in the workflow and in its copy. Read both before merging.
"""

import os

from wiring_support import FILES, REFERENCE, ROOT, dump_reference, load


def main():
    os.makedirs(REFERENCE, exist_ok=True)
    for name in sorted(os.listdir(REFERENCE)):
        os.remove(os.path.join(REFERENCE, name))
    for path in sorted(FILES):
        with open(os.path.join(REFERENCE, os.path.basename(path)), "w", encoding="utf-8") as handle:
            handle.write(dump_reference(load(path)))
    print(f"{len(FILES)} references written under {os.path.relpath(REFERENCE, ROOT)}")


if __name__ == "__main__":
    main()
