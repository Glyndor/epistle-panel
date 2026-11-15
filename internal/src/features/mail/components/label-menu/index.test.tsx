import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { useQuery } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { clearToasts, Toaster } from "@/components/ui/toaster";
import {
	encodeLabelName,
	LABEL_NAME_MAX,
} from "@/features/mail/labels/name-codec";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type {
	LabelView,
	MessageDetail,
} from "@/features/mail/schemas/mail-view";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
import { detail, summary } from "../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { LabelMenu } = await import(".");

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";
const WORK: LabelView = { keyword: "Work", name: "Work", tone: 1 };
const HOME: LabelView = { keyword: "Home", name: "Home", tone: 2 };

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

type Written = Record<string, Record<string, boolean>>;

/** A server that keeps each message's keywords and answers the writes whose turn is not listed as refused. */
function serve(
	kept: Record<string, Record<string, boolean>>,
	refused: readonly number[] = [],
) {
	const writes: Written[] = [];
	stubJmap({
		"Email/get": (args: Record<string, unknown>) => ({
			list: (args["ids"] as string[]).map((id) =>
				emailFixture({ id, keywords: kept[id] ?? {} }),
			),
		}),
		"Email/set": (args: Record<string, unknown>) => {
			const update = args["update"] as Record<
				string,
				{ keywords: Record<string, boolean> }
			>;
			writes.push(
				Object.fromEntries(
					Object.entries(update).map(([id, one]) => [
						id,
						one.keywords,
					]),
				),
			);
			if (refused.includes(writes.length)) {
				return {
					notUpdated: Object.fromEntries(
						Object.keys(update).map((id) => [id, { type: "x" }]),
					),
				};
			}
			for (const [id, one] of Object.entries(update)) {
				kept[id] = one.keywords;
			}
			return {
				updated: Object.fromEntries(
					Object.keys(update).map((id) => [id, null]),
				),
			};
		},
	});
	return writes;
}

/** The menu on the messages `ids`, whose labels it reads from the cache as the reader and the rows do. */
function Live({ ids }: { ids: readonly string[] }) {
	const targets = ids.map((id) => {
		// biome-ignore lint/correctness/useHookAtTopLevel: a fixed list of this test
		const { data } = useQuery<MessageDetail | null>({
			queryKey: mailKeys.message(id),
			queryFn: async () => null,
			enabled: false,
		});
		return { id, labels: data?.labels ?? [] };
	});
	return (
		<LabelMenu targets={targets}>
			<Button type="button">open</Button>
		</LabelMenu>
	);
}

function menu(labelsOf: Record<string, LabelView[]>) {
	const client = testQueryClient();
	for (const [id, labels] of Object.entries(labelsOf)) {
		client.setQueryData(mailKeys.message(id), detail({ id, labels }));
	}
	client.setQueryData(mailKeys.list("INBOX", 1, EMPTY_CONDITIONS), {
		items: Object.entries(labelsOf).map(([id, labels]) =>
			summary({ id, labels }),
		),
		page: 1,
		total: 2,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	client.invalidateQueries = (() =>
		Promise.resolve()) as typeof client.invalidateQueries;
	render(
		withQuery(
			<>
				<Live ids={Object.keys(labelsOf)} />
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return client;
}
const open = async () => {
	fireEvent.click(screen.getByRole("button", { name: "open" }));
	return screen.findByRole("dialog");
};
const field = () => screen.getByRole("textbox") as HTMLInputElement;
const box = (name: string) =>
	screen.getByRole("checkbox", { name }) as HTMLInputElement;
const type = (text: string) =>
	fireEvent.change(field(), { target: { value: text } });
const key = (target: Element, name: string) =>
	fireEvent.keyDown(target, { key: name });

describe("LabelMenu", () => {
	it("opens a dialog named for what it does, with the field in focus and the labels as tick boxes", async () => {
		menu({ [A]: [WORK] });
		const dialog = await open();

		expect(dialog).toHaveAccessibleName("labelAs");
		await waitFor(() => expect(field()).toHaveFocus());
		expect(box("Work").checked).toBe(true);
		expect(
			within(dialog).getByRole("group", { name: "labelsTitle" }),
		).toBeTruthy();
	});

	it("draws a closed menu as its control alone", () => {
		menu({ [A]: [WORK] });
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByRole("checkbox")).toBeNull();
	});

	it("ticks, leaves empty or shows indeterminate by how many of the selection carry the label", async () => {
		menu({ [A]: [WORK, HOME], [B]: [WORK] });
		await open();

		expect(box("Work").checked).toBe(true);
		expect(box("Work").indeterminate).toBe(false);
		expect(box("Home").checked).toBe(false);
		expect(box("Home").indeterminate).toBe(true);
	});

	it("puts a label on the message with a press, at once, and writes it by keeping what else it holds", async () => {
		const kept = { [A]: { $seen: true, Work: true } };
		const writes = serve(kept);
		menu({ [A]: [WORK] });
		await open();
		expect(screen.queryByRole("checkbox", { name: "Home" })).toBeNull();

		fireEvent.click(box("Work"));
		await waitFor(() => expect(box("Work").checked).toBe(false));
		await waitFor(() => expect(writes).toEqual([{ [A]: { $seen: true } }]));
	});

	it("puts the label on the whole selection when only part of it carries it, and takes it off all when all do", async () => {
		const kept = { [A]: { Home: true }, [B]: {} };
		const writes = serve(kept);
		menu({ [A]: [HOME], [B]: [] });
		await open();
		expect(box("Home").indeterminate).toBe(true);

		fireEvent.click(box("Home"));
		await waitFor(() => expect(box("Home").checked).toBe(true));
		await waitFor(() => expect(writes).toHaveLength(1));
		// The message that already carries it is not written.
		expect(writes[0]).toEqual({ [B]: { Home: true } });

		fireEvent.click(box("Home"));
		await waitFor(() => expect(box("Home").checked).toBe(false));
		await waitFor(() => expect(writes).toHaveLength(2));
		expect(writes[1]).toEqual({ [A]: {}, [B]: {} });
	});

	it("puts a label back, and says so, when the server refuses the change", async () => {
		serve({ [A]: { Work: true } }, [1]);
		menu({ [A]: [WORK] });
		await open();

		fireEvent.click(box("Work"));
		await waitFor(() => expect(box("Work").checked).toBe(false));
		await waitFor(() => expect(box("Work").checked).toBe(true));
		expect(await screen.findByText("actionFailed")).toBeTruthy();
	});

	it("narrows the list as the person types, whatever the case, and says when nothing matches", async () => {
		menu({ [A]: [WORK, HOME] });
		await open();

		type("ho");
		expect(screen.queryByRole("checkbox", { name: "Work" })).toBeNull();
		expect(box("Home")).toBeTruthy();

		// Text that is no label offers to make one in the list's place.
		type("zzz");
		expect(screen.queryByRole("checkbox")).toBeNull();
		expect(
			screen.getByRole("button", { name: /labelCreate/ }),
		).toBeTruthy();
		expect(screen.queryByText("labelNoMatch")).toBeNull();

		// Text no label holds and none can be made of says so.
		type("z".repeat(LABEL_NAME_MAX + 1));
		expect(screen.getByText("labelNoMatch")).toBeTruthy();
	});

	it("offers to create what is typed, last, and not when a label of that exact name exists", async () => {
		menu({ [A]: [WORK] });
		await open();
		expect(
			screen.queryByRole("button", { name: /labelCreate/ }),
		).toBeNull();

		type("Wor");
		expect(
			screen.getByRole("button", { name: /labelCreate/ }),
		).toBeTruthy();
		type("Work");
		expect(
			screen.queryByRole("button", { name: /labelCreate/ }),
		).toBeNull();
		type("work");
		expect(
			screen.getByRole("button", { name: /labelCreate/ }),
		).toBeTruthy();
	});

	it("makes the label from the typed name with a press, ticks it, empties the field and keeps the focus there", async () => {
		const kept = { [A]: {} };
		const writes = serve(kept);
		menu({ [A]: [] });
		await open();

		type("To do");
		fireEvent.click(screen.getByRole("button", { name: /labelCreate/ }));

		const keyword = encodeLabelName("To do") ?? "";
		await waitFor(() =>
			expect(writes).toEqual([{ [A]: { [keyword]: true } }]),
		);
		expect(field().value).toBe("");
		await waitFor(() => expect(field()).toHaveFocus());
		expect(box("To do").checked).toBe(true);
	});

	it("makes the label with Enter in the field, and with one label left Enter presses it", async () => {
		const writes = serve({ [A]: { Work: true } });
		menu({ [A]: [WORK] });
		await open();

		type("Wor");
		key(field(), "Enter");
		await waitFor(() => expect(writes).toHaveLength(1));
		expect(Object.keys(writes[0]?.[A] ?? {})).toEqual(
			expect.arrayContaining([encodeLabelName("Wor") ?? ""]),
		);
	});

	it("presses the one label the text narrows the list to when Enter finds nothing to make", async () => {
		const writes = serve({ [A]: { Work: true } });
		menu({ [A]: [WORK] });
		await open();

		type("Work");
		key(field(), "Enter");
		await waitFor(() => expect(writes).toEqual([{ [A]: {} }]));
	});

	it("does nothing on Enter with several labels left and nothing to make", async () => {
		const writes = serve({ [A]: {} });
		menu({ [A]: [WORK, HOME] });
		await open();

		key(field(), "Enter");
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 30));
		});
		expect(writes).toEqual([]);
	});

	it("bounds the field a character over the limit and says so, without offering the name, when it is too long", async () => {
		menu({ [A]: [] });
		await open();
		expect(field()).toHaveAttribute(
			"maxlength",
			String(LABEL_NAME_MAX + 1),
		);
		expect(field()).toHaveAttribute("aria-label", "labelSearch");

		type("a".repeat(LABEL_NAME_MAX));
		expect(
			screen.getByRole("button", { name: /labelCreate/ }),
		).toBeTruthy();

		type("a".repeat(LABEL_NAME_MAX + 1));
		expect(
			screen.queryByRole("button", { name: /labelCreate/ }),
		).toBeNull();
		expect(field()).toHaveAttribute("aria-invalid", "true");
		expect(screen.getByText("labelTooLong")).toBeTruthy();

		type("ñ".repeat(LABEL_NAME_MAX));
		expect(screen.getByText("labelTooLong")).toBeTruthy();
		type("ok");
		expect(screen.queryByText("labelTooLong")).toBeNull();
		expect(field()).not.toHaveAttribute("aria-invalid");
	});

	it("is operated by the keyboard: arrows between the field and the boxes, Home and End, and Enter presses", async () => {
		const writes = serve({ [A]: { Work: true, Home: true } });
		menu({ [A]: [WORK, HOME] });
		await open();
		await waitFor(() => expect(field()).toHaveFocus());

		// One stop for the Tab key for the whole list.
		expect(box("Home")).toHaveAttribute("tabindex", "0");
		expect(box("Work")).toHaveAttribute("tabindex", "-1");

		key(field(), "ArrowDown");
		expect(box("Home")).toHaveFocus();
		key(box("Home"), "ArrowDown");
		expect(box("Work")).toHaveFocus();
		key(box("Work"), "ArrowDown");
		expect(box("Work")).toHaveFocus();
		key(box("Work"), "Home");
		expect(box("Home")).toHaveFocus();
		key(box("Home"), "End");
		expect(box("Work")).toHaveFocus();
		key(box("Work"), "ArrowUp");
		expect(box("Home")).toHaveFocus();

		key(box("Home"), "Enter");
		await waitFor(() => expect(writes).toHaveLength(1));
		expect(box("Home")).toHaveFocus();

		key(box("Home"), "ArrowUp");
		expect(field()).toHaveFocus();
	});

	it("reaches the button that makes a label with the arrow keys, and Enter on it makes it", async () => {
		const writes = serve({ [A]: {} });
		menu({ [A]: [] });
		await open();

		type("Fresh");
		key(field(), "ArrowDown");
		const make = screen.getByRole("button", { name: /labelCreate/ });
		expect(make).toHaveFocus();
		fireEvent.click(make);
		await waitFor(() => expect(writes).toHaveLength(1));
	});

	it("leaves a key it has no use for to the browser", async () => {
		menu({ [A]: [WORK] });
		await open();
		const event = new KeyboardEvent("keydown", {
			key: "a",
			bubbles: true,
			cancelable: true,
		});
		box("Work").dispatchEvent(event);
		expect(event.defaultPrevented).toBe(false);
		expect(box("Work")).toBeTruthy();

		// The field's Down arrow, with no label to go to, is a plain key too.
		cleanup();
		menu({ [A]: [] });
		await open();
		const down = new KeyboardEvent("keydown", {
			key: "ArrowDown",
			bubbles: true,
			cancelable: true,
		});
		field().dispatchEvent(down);
		expect(down.defaultPrevented).toBe(false);
	});

	it("closes with Escape and gives the focus back to the control that opened it", async () => {
		menu({ [A]: [WORK] });
		await open();
		await waitFor(() => expect(field()).toHaveFocus());

		key(field(), "Escape");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "open" })).toHaveFocus(),
		);
	});

	it("stays open while the person chooses more than one label", async () => {
		serve({ [A]: { Work: true, Home: true } });
		menu({ [A]: [WORK, HOME] });
		await open();

		fireEvent.click(box("Work"));
		fireEvent.click(box("Home"));
		expect(screen.getByRole("dialog")).toBeTruthy();
		await waitFor(() => expect(box("Work").checked).toBe(false));
		await waitFor(() => expect(box("Home").checked).toBe(false));
		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("says how many messages it is for", async () => {
		menu({ [A]: [], [B]: [] });
		const dialog = await open();
		expect(dialog).toHaveAccessibleDescription("labelAsHint");
	});
});
