import { describe, expect, it } from "bun:test";

import { sidebarGroupsCookie } from "../groups-cookie";
import { closedSidebarGroups } from ".";

describe("the closed groups a request asks for", () => {
	it("reads every group as open with no cookie and with an empty one", () => {
		expect(closedSidebarGroups(undefined)).toEqual([]);
		expect(closedSidebarGroups("")).toEqual([]);
	});

	it("reads the groups the provider wrote", () => {
		expect(closedSidebarGroups("manage")).toEqual(["manage"]);
		expect(closedSidebarGroups("folders")).toEqual(["folders"]);
		expect(closedSidebarGroups("manage.folders")).toEqual([
			"manage",
			"folders",
		]);
		// In its own order, whatever order the request used.
		expect(closedSidebarGroups("folders.manage")).toEqual([
			"manage",
			"folders",
		]);
		expect(closedSidebarGroups("labels")).toEqual(["labels"]);
		expect(closedSidebarGroups("labels.folders")).toEqual([
			"folders",
			"labels",
		]);
		// What is written is what is read back.
		const written = /^sidebar_groups=([^;]*);/.exec(
			sidebarGroupsCookie(["folders"]),
		)?.[1];
		expect(closedSidebarGroups(written)).toEqual(["folders"]);
	});

	it("reads nothing from a value that names anything but a known group", () => {
		for (const value of [
			"other",
			"manage.other",
			"Manage",
			"manage ",
			" manage",
			"manage,folders",
			"manage;folders",
			"manage..folders",
			".manage",
			"manage.",
			"true",
			'"><script>alert(1)</script>',
			"__proto__",
			"constructor",
			"manage%2Efolders",
		]) {
			expect([value, closedSidebarGroups(value)]).toEqual([value, []]);
		}
	});

	it("reads as many names as there are groups and refuses one more", () => {
		// Three groups exist, so three names are the most a value can hold.
		expect(closedSidebarGroups("manage.folders.labels")).toHaveLength(3);
		expect(closedSidebarGroups("folders.folders")).toEqual(["folders"]);
		expect(closedSidebarGroups("manage.folders.labels.manage")).toEqual([]);
		expect(
			closedSidebarGroups(
				Array.from({ length: 5000 }, () => "manage").join("."),
			),
		).toEqual([]);
	});

	it("answers with its own names, never with characters of the request", () => {
		const asked = `${"man"}${"age"}`;
		const [answered] = closedSidebarGroups(asked);

		expect(answered).toBe("manage");
		// A value that is a known name with anything around it is refused
		// whole, so nothing the request spelled can ride along.
		expect(closedSidebarGroups(`manage${String.fromCodePoint(0)}`)).toEqual(
			[],
		);
		expect(
			closedSidebarGroups(`manage${String.fromCodePoint(10)}`),
		).toEqual([]);
	});
});
