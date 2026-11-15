import { afterEach, beforeEach, expect, it } from "bun:test";
import { box, disclosure, install, reset, tree } from "../test-support";

beforeEach(install);
afterEach(reset);

it("gives the fold button a fill of its own on hover and on press, so it answers the pointer in the light theme too", () => {
	tree([box("Work"), box("Q4", "Work")]);
	const classes = disclosure("Work").className.split(/\s+/);
	expect(classes).toContain("hover:bg-sidebar-accent");
	expect(classes).toContain("active:bg-sidebar-accent");
});
