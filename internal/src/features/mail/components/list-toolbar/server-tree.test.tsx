import { describe, expect, it } from "bun:test";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { resolveServerTree } from "@/test/server-tree";
import { assertServerProps } from "@/test/server-tree/assert-server-props";
import { ListToolbar } from ".";

describe("the toolbar's server tree", () => {
	it("passes serializable props to client leaves with and without words", async () => {
		for (const q of ["", "newsletter"]) {
			// Run the synchronous server component explicitly: the shared
			// resolver only executes async components, not synchronous ones.
			const tree = await resolveServerTree(
				ListToolbar({
					box: "INBOX",
					folderRole: "inbox",
					page: 1,
					conditions: { ...EMPTY_CONDITIONS, q },
					density: "comfortable",
				}),
			);
			expect(() => assertServerProps(tree)).not.toThrow();
			expect(JSON.stringify(tree).includes("searchClear")).toBe(q !== "");
		}
	});

	it("rejects handlers nested in server children of a client wrapper", () => {
		const tree = (
			<Button asChild>
				<Link href="/app/mail" onClick={() => {}}>
					clear
				</Link>
			</Button>
		);
		expect(() => assertServerProps(tree)).toThrow(
			"Function prop from server",
		);
		expect(() => assertServerProps({ action: () => {} })).toThrow();
	});
});
