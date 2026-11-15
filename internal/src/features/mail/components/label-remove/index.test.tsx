import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { installNextIntlMocks } from "@/test/next-intl";
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
import { detail, summary } from "../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();

// This file reads what the button says, with the label's name in it, so its
// translator prints the key and the values it was given. Put back after.
beforeAll(() => {
	mock.module("next-intl", () => ({
		useTranslations: () =>
			Object.assign(
				(key: string, values?: Record<string, unknown>) =>
					values?.["name"] === undefined
						? key
						: `${key}:${String(values["name"])}`,
				{ rich: (key: string) => key },
			),
	}));
});
afterAll(() => installNextIntlMocks());

const { LabelRemove } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000b1";
const WORK: LabelView = { keyword: "Work", name: "Work", tone: 1 };
// Two labels that show one name: a raw keyword and an encoded one.
const RAW: LabelView = { keyword: "Same", name: "Same", tone: 2 };
const ENCODED: LabelView = { keyword: "ep1-53616d65", name: "Same", tone: 2 };

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

function serve(keywords: Record<string, boolean>, refuse = false) {
	const writes: Record<string, boolean>[] = [];
	stubJmap({
		"Email/get": {
			list: [emailFixture({ id: ID, keywords })],
		},
		"Email/set": (args: Record<string, unknown>) => {
			const update = args["update"] as Record<
				string,
				{ keywords: Record<string, boolean> }
			>;
			writes.push(update[ID]?.keywords ?? {});
			return refuse
				? { notUpdated: { [ID]: { type: "x" } } }
				: { updated: { [ID]: null } };
		},
	});
	return writes;
}

function draw(labels: LabelView[]) {
	const client = testQueryClient();
	client.setQueryData(mailKeys.message(ID), detail({ id: ID, labels }));
	client.setQueryData(mailKeys.list("INBOX", 1, EMPTY_CONDITIONS), {
		items: [summary({ id: ID, labels })],
		page: 1,
		total: 1,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	client.invalidateQueries = (() =>
		Promise.resolve()) as typeof client.invalidateQueries;
	render(
		withQuery(
			<>
				{labels.map((label) => (
					<LabelRemove
						key={label.keyword}
						messageId={ID}
						label={label}
					/>
				))}
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return client;
}
const labelsOf = (client: ReturnType<typeof testQueryClient>) =>
	(
		client.getQueryData(mailKeys.message(ID)) as { labels: LabelView[] }
	).labels.map((label) => label.keyword);

describe("LabelRemove", () => {
	it("has a name that says which label it takes off", () => {
		draw([WORK]);
		expect(
			screen.getByRole("button", { name: "labelRemove:Work" }),
		).toBeTruthy();
	});

	it("takes the label off at once and writes the keyword set without it", async () => {
		const writes = serve({ $seen: true, Work: true, Other: true });
		const client = draw([WORK]);

		fireEvent.click(screen.getByRole("button", { name: /labelRemove/ }));

		await waitFor(() => expect(labelsOf(client)).toEqual([]));
		await waitFor(() =>
			expect(writes).toEqual([{ $seen: true, Other: true }]),
		);
		expect(screen.queryByText("actionFailed")).toBeNull();
	});

	it("removes by the keyword and leaves the label that shows the same name", async () => {
		const writes = serve({ Same: true, "ep1-53616d65": true });
		const client = draw([RAW, ENCODED]);

		const buttons = screen.getAllByRole("button", {
			name: "labelRemove:Same",
		});
		expect(
			buttons.map((button) => button.getAttribute("data-keyword")),
		).toEqual(["Same", "ep1-53616d65"]);
		fireEvent.click(buttons[1] as HTMLElement);

		await waitFor(() => expect(labelsOf(client)).toEqual(["Same"]));
		await waitFor(() => expect(writes).toEqual([{ Same: true }]));
	});

	it("puts the label back and says so when the server refuses", async () => {
		serve({ Work: true }, true);
		const client = draw([WORK]);

		fireEvent.click(screen.getByRole("button", { name: /labelRemove/ }));

		expect(await screen.findByText("actionFailed")).toBeTruthy();
		await waitFor(() => expect(labelsOf(client)).toEqual(["Work"]));
	});
});
