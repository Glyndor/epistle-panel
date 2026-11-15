import { describe, expect, it } from "bun:test";

import type { LabelView } from "@/features/mail/schemas/mail-view";

import { collectSidebarLabels, SIDEBAR_LABELS_MOST } from ".";

const label = (keyword: string, name = keyword): LabelView => ({
	keyword,
	name,
	tone: 1,
});
const message = (id: string, ...labels: LabelView[]) => ({ id, labels });
const names = (list: readonly LabelView[]) => list.map((one) => one.name);

describe("collectSidebarLabels", () => {
	it("is empty with nothing read and with messages that carry no label", () => {
		expect(collectSidebarLabels([])).toEqual([]);
		expect(collectSidebarLabels([[]])).toEqual([]);
		expect(collectSidebarLabels([[message("a"), message("b")]])).toEqual(
			[],
		);
	});

	it("lists each label once, with the messages that carry it, by name", () => {
		const work = label("Work");
		const todo = label("To_20do", "To do");
		const found = collectSidebarLabels([
			[message("a", work, todo), message("b", work), message("c", todo)],
			[message("d", work)],
		]);

		expect(found).toEqual([
			{ ...todo, count: 2 },
			{ ...work, count: 3 },
		]);
	});

	it("counts a message once however many pages hold it, by the page read most recently", () => {
		const work = label("Work");
		const later = label("Later");
		// The first page is the newest read: it says `a` has no `Work` any more.
		const found = collectSidebarLabels([
			[message("a", later)],
			[message("a", work), message("b", work)],
		]);

		expect(found).toEqual([
			{ ...later, count: 1 },
			{ ...work, count: 1 },
		]);
	});

	it("takes two spellings of one keyword for one label, drawn as the first seen", () => {
		const found = collectSidebarLabels([
			[message("a", label("Work")), message("b", label("work"))],
		]);

		expect(found).toEqual([{ ...label("Work"), count: 2 }]);
	});

	it("keeps two keywords that show as one name apart, ordered by keyword", () => {
		const found = collectSidebarLabels([
			[message("a", label("b", "x"), label("a", "x"))],
		]);

		expect(found.map((one) => one.keyword)).toEqual(["a", "b"]);
	});

	it("keeps the labels carried by the most messages and lists them by name", () => {
		const many = Array.from({ length: SIDEBAR_LABELS_MOST + 5 }, (_, n) =>
			label(`L${String(n).padStart(2, "0")}`),
		);
		// `L00` is on one message, `L01` on two, and so on: the five fewest go.
		const messages = many.flatMap((one, n) =>
			Array.from({ length: n + 1 }, (_, m) => message(`${n}-${m}`, one)),
		);
		const found = collectSidebarLabels([messages]);

		expect(found).toHaveLength(SIDEBAR_LABELS_MOST);
		expect(names(found)).toEqual(
			names(many.slice(5)).sort((a, b) => a.localeCompare(b)),
		);
		expect(found.map((one) => one.count)).toEqual(
			Array.from({ length: SIDEBAR_LABELS_MOST }, (_, n) => n + 6),
		);
	});

	it("breaks a tie of counts by name when it cuts the list", () => {
		const same = Array.from({ length: SIDEBAR_LABELS_MOST + 1 }, (_, n) =>
			label(`T${String(n).padStart(2, "0")}`),
		);
		const found = collectSidebarLabels([
			same.map((one) => message(one.keyword, one)),
		]);

		expect(names(found)).toEqual(names(same.slice(0, SIDEBAR_LABELS_MOST)));
	});
});
