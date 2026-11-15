import { expect, it } from "bun:test";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { folderEntries } from ".";

const box = (
	id: string,
	parentId: string | null = null,
	unread = 0,
): MailboxView => ({
	id,
	name: id,
	parentId,
	unread,
	role: null,
	depth: 0,
	total: unread,
});

it("opens every branch by default and preserves input order", () => {
	const boxes = [box("child", "root"), box("root")] as const;
	expect(folderEntries(boxes, null, new Set())).toEqual([
		{
			box: boxes[0],
			hasChildren: false,
			open: true,
			held: false,
			unread: 0,
		},
		{
			box: boxes[1],
			hasChildren: true,
			open: true,
			held: false,
			unread: 0,
		},
	]);
});

it("hides all descendants through four levels without hiding other branches", () => {
	const boxes = [
		box("root"),
		box("one", "root"),
		box("two", "one"),
		box("three", "two"),
		box("other"),
	];
	expect(
		folderEntries(boxes, null, new Set(["root"])).map(({ box }) => box.id),
	).toEqual(["root", "other"]);
	expect(
		folderEntries(boxes, null, new Set(["two"])).map(({ box }) => box.id),
	).toEqual(["root", "one", "two", "other"]);
});

it("sums every hidden sibling and descendant only while the parent is folded", () => {
	const boxes = [
		box("root", null, 1),
		...Array.from({ length: 100 }, (_, i) => box(`child${i}`, "root", 2)),
		box("deep", "child99", 5),
		box("other", null, 999),
	];
	const folded = new Set(["root"]);
	expect(folderEntries(boxes, null, folded)[0]).toMatchObject({
		unread: 206,
		open: false,
	});
	expect(folderEntries(boxes, null, new Set())[0]).toMatchObject({
		unread: 1,
		open: true,
	});
	expect(boxes[0]?.unread).toBe(1);
	expect([...folded]).toEqual(["root"]);
});

it("holds every ancestor open for the active leaf and restores the remembered folds on leaving", () => {
	const boxes = [
		box("root"),
		box("one", "root"),
		box("two", "one"),
		box("leaf", "two"),
	];
	const folded = new Set(["root", "one", "two"]);
	const entries = folderEntries(boxes, "leaf", folded);
	expect(entries).toHaveLength(4);
	expect(entries.slice(0, 3).map(({ open, held }) => [open, held])).toEqual([
		[true, true],
		[true, true],
		[true, true],
	]);
	expect(entries[3]).toMatchObject({ held: false });
	expect(folderEntries(boxes, null, folded).map(({ box }) => box.id)).toEqual(
		["root"],
	);
	expect([...folded]).toEqual(["root", "one", "two"]);
});

it("keeps vanished folded names harmlessly and applies them if that branch returns", () => {
	const folded = new Set(["gone"]);
	const present = [box("present")];
	expect(folderEntries(present, "missing-active", folded)).toEqual(
		folderEntries(present, null, new Set()),
	);
	expect([...folded]).toEqual(["gone"]);
	const returned = [...present, box("gone"), box("child", "gone")];
	expect(
		folderEntries(returned, null, folded).map(({ box }) => box.id),
	).toEqual(["present", "gone"]);
});

it("treats missing and self parents as leaves without hanging active walks", () => {
	const boxes = [box("orphan", "missing", 2), box("self", "self", 3)];
	expect(
		folderEntries(boxes, "orphan", new Set()).map(
			({ hasChildren, open, unread }) => ({ hasChildren, open, unread }),
		),
	).toEqual([
		{ hasChildren: false, open: true, unread: 2 },
		{ hasChildren: false, open: true, unread: 3 },
	]);
	expect(folderEntries(boxes, "self", new Set())).toHaveLength(2);
});

it("terminates a cyclic ancestry and counts each cyclic branch at most once", () => {
	const boxes = [box("a", "b", 2), box("b", "a", 3), box("safe", null, 7)];
	expect(
		folderEntries(boxes, "a", new Set(["a", "b"])).map(
			({ unread, held }) => [unread, held],
		),
	).toEqual([
		[2, true],
		[3, true],
		[7, false],
	]);
	expect(
		folderEntries(boxes, null, new Set(["a"])).map(({ box }) => box.id),
	).toEqual(["safe"]);
});
