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
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
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

// The cases about looks read classes, not the cascade: which rule wins where
// two apply (a coarse pointer over a compact row, the inner ring over the
// outer one) is measured in a browser, not here.
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

	it("names each button in a tooltip under it, one at a time", () => {
		const { container } = actions();
		const shown = () => [
			...document.querySelectorAll('[data-slot="tooltip"]'),
		];

		for (const each of screen.getAllByRole("button")) {
			fireEvent.pointerEnter(each, { pointerType: "mouse" });

			expect(shown()).toHaveLength(1);
			expect(shown()[0]).toHaveAttribute("data-side", "bottom");
			expect(shown()[0]?.textContent).toBe(each.textContent);
			fireEvent.keyDown(each, { key: "Escape" });
			expect(shown()).toHaveLength(0);
		}
		// The buttons take no layer of their own: a filled mark must pass
		// under a date heading, and the row raises itself when it needs to.
		expect(
			container.querySelector('[data-slot="row-actions"]')?.className,
		).not.toMatch(/(^|\s)z-/);
	});

	it("draws the focus ring inside the button on a coarse pointer, where it is as tall as a compact row", () => {
		actions();

		for (const each of screen.getAllByRole("button")) {
			// Outside, the ring of a first row began over the row, under the
			// date heading that sticks above it, and lost that side.
			expect(each).toHaveClass(
				"focus-visible:outline-offset-2",
				"pointer-coarse:focus-visible:-outline-offset-2",
			);
		}
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

	/** Hold every answer of the server until `release` is called. */
	function holdAnswers() {
		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const answer = globalThis.fetch;
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			await held;
			return answer(...args);
		}) as typeof fetch;
		return () => release();
	}

	it("loses no press: two marks set in a row are written one after the other, each on the other's result", async () => {
		// The server as it is: it keeps what was written and gives it back.
		let kept: Record<string, boolean> = { $seen: true };
		const seen = stubJmap({
			"Email/get": () => ({
				list: [
					emailFixture({
						id: ID,
						keywords: kept,
						mailboxIds: { INBOX: true },
					}),
				],
			}),
			"Email/set": (args: Record<string, unknown>) => {
				const update = args["update"] as Record<
					string,
					{ keywords: Record<string, boolean> }
				>;
				kept = update[ID]?.keywords ?? kept;
				return { updated: { [ID]: null } };
			},
		});
		const release = holdAnswers();
		const client = testQueryClient();
		render(
			withQuery(
				<RowActions
					id={ID}
					box="INBOX"
					flagged={false}
					important={false}
				/>,
				client,
			),
		);
		const asked = () => client.getMutationCache().getAll();

		// In the same instant, with the server slow.
		fireEvent.click(button("star"));
		fireEvent.click(button("markImportant"));

		// Both were taken, and the second waits for the first: it has not
		// read the keywords the first is about to change.
		await waitFor(() => {
			expect(asked()).toHaveLength(2);
			expect(asked().every((one) => one.state.variables)).toBe(true);
		});
		expect(asked().map((one) => one.state.isPaused)).toEqual([false, true]);
		release();

		await waitFor(() => expect(written(seen)).toHaveLength(2));
		await settled();
		// The second was built from what the first left: both marks are there.
		expect(written(seen)).toEqual([
			["$flagged", "$seen"],
			["$flagged", "$important", "$seen"],
		]);
	});

	it("reads the list again once, after the last change that waits, not between two", async () => {
		serve();
		const release = holdAnswers();
		const client = testQueryClient();
		const read: string[] = [];
		const invalidate = client.invalidateQueries.bind(client);
		client.invalidateQueries = ((filters?: {
			queryKey?: readonly unknown[];
		}) => {
			read.push((filters?.queryKey ?? []).join("/"));
			return invalidate(filters as never);
		}) as typeof client.invalidateQueries;
		render(
			withQuery(
				<RowActions
					id={ID}
					box="INBOX"
					flagged={false}
					important={false}
				/>,
				client,
			),
		);

		fireEvent.click(button("star"));
		fireEvent.click(button("markImportant"));
		release();
		await settled();
		await waitFor(() => expect(read).toContain("mail/list"));

		// Read between the two, the list would come back without the second
		// mark and take it off the screen until its own answer.
		expect(read.filter((key) => key === "mail/list")).toHaveLength(1);
	});

	it("says a change is on its way three ways that are not a colour, and stays pressable", async () => {
		serve();
		const release = holdAnswers();
		actions();

		fireEvent.click(button("star"));

		await waitFor(() =>
			expect(button("star")).toHaveAttribute("aria-busy", "true"),
		);
		for (const each of screen.getAllByRole("button")) {
			expect(each).toHaveAttribute("aria-busy", "true");
			// A press made now waits its turn: the button is not shut.
			expect(each).not.toHaveAttribute("aria-disabled");
			expect(each).not.toBeDisabled();
			// The progress cursor, and a dot on its corner that takes no room.
			expect(each).toHaveClass(
				"relative",
				"aria-busy:cursor-progress",
				"aria-busy:after:absolute",
				"aria-busy:after:size-1.5",
				"aria-busy:after:rounded-full",
				"size-6",
			);
		}
		release();
		await settled();
		await waitFor(() =>
			expect(button("star")).not.toHaveAttribute("aria-busy"),
		);
	});

	it("says nothing when a mark was set: the row already shows it", async () => {
		const seen = serve();
		actions({}, true);

		fireEvent.click(button("star"));

		await waitFor(() => expect(written(seen)).toHaveLength(1));
		await settled();
		expect(screen.queryByText("changed")).toBeNull();
		expect(screen.queryByRole("status")?.textContent ?? "").toBe("");
	});

	it("centres its buttons with no transform, which would misplace their fixed tooltips", () => {
		const { container } = actions();
		const box = container.querySelector('[data-slot="row-actions"]');

		expect(box).toHaveClass(
			"flex",
			"items-center",
			"group-data-[density=compact]/list:inset-y-0",
			"pointer-coarse:inset-y-0",
		);
		// On a comfortable row it ends with the first line (4 + 24 px): two
		// pixels lower the buttons lay over the end of the subject's line.
		expect(box).toHaveClass("top-1");
		expect(box).not.toHaveClass("top-1.5");
		for (const element of [box, ...screen.getAllByRole("button")]) {
			expect(element?.className).not.toMatch(
				/translate|rotate|scale|skew|transform|filter|perspective/,
			);
		}
		// The box takes no press: the row under it stays a link.
		expect(box).toHaveClass("pointer-events-none");
		expect(button("star")).toHaveClass("pointer-events-auto");
	});

	it("says so when the server refuses the change", async () => {
		stubJmap({ "Email/get": { list: [] } });
		actions({}, true);

		fireEvent.click(button("star"));

		expect(await screen.findByText("actionFailed")).toBeInTheDocument();
	});

	it("puts no style attribute in the markup the server sends", () => {
		// The tooltip is drawn only once it opens, in the browser, where its
		// place is set from script; what the server sends carries no style.
		const { container } = actions();

		expect(container.querySelector("[style]")).toBeNull();
		expect(document.querySelector('[data-slot="tooltip"]')).toBeNull();
		fireEvent.pointerEnter(button("star"), { pointerType: "mouse" });
		expect(
			document.querySelector('[data-slot="tooltip"]')?.textContent,
		).toBe("star");
	});
});
