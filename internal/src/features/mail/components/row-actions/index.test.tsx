import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { RowActions } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000c1";

function serve(keywords: Record<string, boolean> = { $seen: true }) {
	return stubJmap({
		"Email/get": {
			list: [
				emailFixture({
					id: ID,
					keywords,
					mailboxIds: { INBOX: true },
				}),
			],
		},
		"Email/set": () => ({ updated: { [ID]: null } }),
	});
}
/** The keyword sets the panel wrote, in order. */
const written = (seen: ReturnType<typeof stubJmap>) =>
	seen
		.flatMap((request) => request.calls)
		.filter((call) => call[0] === "Email/set")
		.map((call) => {
			const update = call[1]["update"] as Record<
				string,
				{ keywords: Record<string, boolean> }
			>;
			return Object.keys(update[ID]?.keywords ?? {}).sort();
		});

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	clearToasts();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	await settled();
	cleanup();
	clearToasts();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

function actions(
	flags: { flagged?: boolean; important?: boolean } = {},
	withToasts = false,
) {
	return render(
		withQuery(
			<>
				<RowActions
					id={ID}
					box="INBOX"
					flagged={flags.flagged ?? false}
					important={flags.important ?? false}
				/>
				{withToasts ? (
					<Toaster label="toasts" closeLabel="close" />
				) : null}
			</>,
		),
	);
}
const button = (name: string) => screen.getByRole("button", { name });

describe("RowActions", () => {
	it("offers important first and the star second, each named for what a press does", () => {
		actions();

		expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(
			["markImportant", "star"],
		);
		cleanup();

		actions({ flagged: true, important: true });
		expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(
			["unmarkImportant", "unstar"],
		);
	});

	it("fills a mark that is set and leaves one that is not as an outline", () => {
		actions({ flagged: true, important: false });

		expect(button("unstar")).toHaveAttribute("data-set", "true");
		expect(button("unstar").querySelector("svg")).toHaveClass(
			"fill-current",
		);
		expect(button("markImportant")).toHaveAttribute("data-set", "false");
		expect(button("markImportant").querySelector("svg")).not.toHaveClass(
			"fill-current",
		);
	});

	it("keeps a mark that is not set reachable: hidden by opacity, shown on hover, on focus and on a coarse pointer", () => {
		actions();

		for (const each of screen.getAllByRole("button")) {
			expect(each).toHaveClass(
				"opacity-0",
				"data-[set=true]:opacity-100",
				"group-hover/row:opacity-100",
				"group-focus-within/row:opacity-100",
				"focus-visible:opacity-100",
				"pointer-coarse:opacity-100",
			);
			// Never out of the tab order or the layout.
			expect(each).not.toHaveClass("invisible");
			expect(each).not.toHaveClass("hidden");
			expect(each).not.toHaveAttribute("tabindex");
			expect(each).not.toBeDisabled();
		}
	});

	it("opens each tooltip under its own button, never over the other one", () => {
		const { container } = actions();

		for (const each of screen.getAllByRole("button")) {
			fireEvent.pointerEnter(each.parentElement as Element, {
				pointerType: "mouse",
			});
			const text = each.parentElement?.querySelector(
				'[data-slot="tooltip-content"]',
			);

			expect(text).toHaveAttribute("data-side", "bottom");
			expect(text).toHaveClass("top-full", "end-0");
			fireEvent.pointerLeave(each.parentElement as Element);
		}
		// The buttons take no layer of their own: a filled mark must pass
		// under a date heading, and the row raises itself when it needs to.
		expect(
			container.querySelector('[data-slot="row-actions"]')?.className,
		).not.toMatch(/(^|\s)z-/);
	});

	it("is 24 px on a fine pointer and 44 px on a coarse one", () => {
		actions();

		for (const each of screen.getAllByRole("button")) {
			expect(each).toHaveClass("size-6", "pointer-coarse:size-11");
		}
	});

	it("marks a message important with every keyword it already had", async () => {
		const seen = serve({ $seen: true, Work: true });
		actions();

		fireEvent.click(button("markImportant"));

		await waitFor(() => expect(written(seen)).toHaveLength(1));
		expect(written(seen)[0]).toEqual(["$important", "$seen", "Work"]);
	});

	it("takes the important mark and the star off", async () => {
		const seen = serve({ $seen: true, $important: true, $flagged: true });
		actions({ flagged: true, important: true });

		fireEvent.click(button("unmarkImportant"));
		await waitFor(() => expect(written(seen)).toHaveLength(1));
		expect(written(seen)[0]).toEqual(["$flagged", "$seen"]);
		await settled();

		fireEvent.click(button("unstar"));
		await waitFor(() => expect(written(seen)).toHaveLength(2));
		expect(written(seen)[1]).not.toContain("$flagged");
	});

	it("sends nothing for a press on either button while a change is on its way", async () => {
		// The answer is held until the case has looked at the waiting buttons.
		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const seen = serve();
		const answer = globalThis.fetch;
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			await held;
			return answer(...args);
		}) as typeof fetch;
		actions();

		fireEvent.click(button("markImportant"));
		// In the same instant, before anything was rendered again.
		fireEvent.click(button("star"));
		fireEvent.click(button("markImportant"));
		// Both wait, and neither left the tab order to do it.
		await waitFor(() =>
			expect(button("star")).toHaveAttribute("aria-disabled", "true"),
		);
		expect(button("markImportant")).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		expect(button("star")).not.toBeDisabled();
		fireEvent.click(button("star"));

		release();
		await settled();
		// One write, and it is the first press: a second built from the same
		// keywords would have taken the important mark off again.
		expect(written(seen)).toEqual([["$important", "$seen"]]);
		await waitFor(() =>
			expect(button("star")).not.toHaveAttribute("aria-disabled"),
		);

		// And the lock opens: the next press is sent.
		fireEvent.click(button("star"));
		await waitFor(() => expect(written(seen)).toHaveLength(2));
	});

	it("opens the lock again after a change the server refused", async () => {
		stubJmap({ "Email/get": { list: [] } });
		actions({}, true);

		fireEvent.click(button("star"));
		expect(await screen.findByText("actionFailed")).toBeInTheDocument();
		await settled();
		const seen = serve();

		fireEvent.click(button("star"));

		await waitFor(() => expect(written(seen)).toHaveLength(1));
	});

	it("says so when the server refuses the change", async () => {
		stubJmap({ "Email/get": { list: [] } });
		actions({}, true);

		fireEvent.click(button("star"));

		expect(await screen.findByText("actionFailed")).toBeInTheDocument();
	});

	it("puts no style attribute in the page, tooltip included", () => {
		const { container } = actions();

		fireEvent.pointerEnter(button("star").parentElement as Element, {
			pointerType: "mouse",
		});

		expect(container.querySelector("[style]")).toBeNull();
		expect(
			container.querySelector('[data-slot="tooltip-content"]')
				?.textContent,
		).toBe("star");
	});
});
