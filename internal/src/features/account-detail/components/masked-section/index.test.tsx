import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import {
	type Answer,
	stubRoutes,
} from "@/features/account-detail/test-support/stub-routes";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { settled, withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { MaskedSection } = await import(".");
const { maskedLabelFormSchema } = await import(
	"@/features/account-detail/schemas/masked-label-form"
);

afterEach(() => {
	cleanup();
	clearToasts();
});

const row = {
	address: "news.abcdefgh@example.org",
	label: "News",
	enabled: true,
	created_at: 1_700_000_000,
};
const list = (...addresses: unknown[]): Answer => ({ body: { addresses } });
const label = () =>
	screen.getByLabelText("maskedLabelLabel") as HTMLInputElement;
const type = (value: string) =>
	act(async () => {
		fireEvent.change(label(), { target: { value } });
	});
const create = async () => {
	// The button reads "creating" until the mutation, its refetch included, is over.
	const button = await screen.findByRole("button", { name: "maskedCreate" });
	await act(async () => {
		fireEvent.click(button);
	});
};
/** What a script does when it submits without the browser's own validation. */
const createPastTheBrowser = async () => {
	const button = await screen.findByRole("button", { name: "maskedCreate" });
	await act(async () => {
		fireEvent.submit(button.closest("form") as HTMLFormElement);
	});
};
const posts = () => sentRequests().filter((r) => r.method === "POST");

describe("MaskedSection", () => {
	useActionEnvironment(cookies);

	it("lists each address with its label, creation and last use, and a remove control", async () => {
		stubRoutes([
			[
				"GET",
				/masked$/,
				list(row, {
					...row,
					address: "shop.abcdefg2@example.org",
					label: "Shop",
					enabled: false,
					last_used_at: 1_700_000_100,
				}),
			],
		]);

		render(withQuery(<MaskedSection name="alice" />));

		expect(
			await screen.findByText("news.abcdefgh@example.org"),
		).toBeInTheDocument();
		expect(screen.getAllByText(/maskedMeta/)).toHaveLength(2);
		expect(
			screen.getAllByRole("button", { name: "maskedRemoveLabel" }),
		).toHaveLength(2);
		expect(screen.getByText(/maskedDisabled/)).toBeInTheDocument();
	});

	it("offers no remove control for an address that does not have the minted shape", async () => {
		stubRoutes([
			["GET", /masked$/, list({ ...row, address: "../odd@evil" })],
		]);

		render(withQuery(<MaskedSection name="alice" />));

		expect(await screen.findByText("../odd@evil")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "maskedRemoveLabel" }),
		).toBeNull();
	});

	it("says there are no masked addresses, and still offers the form", async () => {
		stubRoutes([["GET", /masked$/, list()]]);

		render(withQuery(<MaskedSection name="alice" />));

		expect(await screen.findByText("maskedEmpty")).toBeInTheDocument();
		expect(label()).toBeInTheDocument();
	});

	it("gives the browser the label's own rules: required, bounded, and at least one letter or digit", async () => {
		stubRoutes([["GET", /masked$/, list()]]);
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");

		expect(label()).toBeRequired();
		// One over the schema's 64, so a label the browser cut is named, not kept short.
		expect(label()).toHaveAttribute("maxlength", "65");
		// A browser compiles the attribute with the `v` flag; it must be valid there.
		const pattern = new RegExp(
			`^(?:${label().getAttribute("pattern") ?? ""})$`,
			"v",
		);
		for (const [value, accepted] of [
			["shop", true],
			["a", true],
			["-- 7 --", true],
			["---", false],
			["", false],
			["   ", false],
		] as const) {
			expect([value, pattern.test(value)]).toEqual([value, accepted]);
			expect([
				value,
				maskedLabelFormSchema.safeParse({ label: value }).success,
			]).toEqual([value, accepted]);
		}
	});

	it("a label the browser cut to the field's length is named too long, and is not created", async () => {
		stubRoutes([["GET", /masked$/, list()]]);
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");

		await type("a".repeat(65));
		expect(label().checkValidity()).toBe(true);
		await create();

		expect(await screen.findByText("labelTooLong")).toBeInTheDocument();
		expect(posts()).toHaveLength(0);
	});

	it("the browser stops an empty label, and one with no letter or digit, before any script", async () => {
		stubRoutes([["GET", /masked$/, list()]]);
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");

		expect(label().validity.valueMissing).toBe(true);
		await create();
		await type("---");
		expect(label().validity.patternMismatch).toBe(true);
		await create();

		expect(screen.queryByText("labelRequired")).toBeNull();
		expect(screen.queryByText("labelNeedsLetter")).toBeNull();
		expect(posts()).toHaveLength(0);
	});

	it("a form submitted past the browser's check is stopped by the schema, which names what is wrong", async () => {
		stubRoutes([["GET", /masked$/, list()]]);
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");

		await createPastTheBrowser();
		expect(await screen.findByText("labelRequired")).toBeInTheDocument();
		await type("---");
		await createPastTheBrowser();

		expect(await screen.findByText("labelNeedsLetter")).toBeInTheDocument();
		expect(posts()).toHaveLength(0);
	});

	it("creates the address, announces it, empties the field and reads the list again", async () => {
		let created = false;
		stubRoutes([
			["GET", /masked$/, () => list(...(created ? [row] : []))],
			[
				"POST",
				/masked$/,
				() => {
					created = true;
					return { status: 201, body: { address: row.address } };
				},
			],
		]);
		render(
			withQuery(
				<>
					<MaskedSection name="alice" />
					<Toaster label="toasts" closeLabel="close" />
				</>,
			),
		);
		await screen.findByText("maskedEmpty");

		await type("  News  ");
		await create();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"maskedCreated",
			),
		);
		expect(JSON.parse(posts()[0]?.body ?? "")).toEqual({ label: "News" });
		expect(await screen.findByText(row.address)).toBeInTheDocument();
		expect(label().value).toBe("");
	});

	it("tells a full account from a refused label, under the field", async () => {
		stubRoutes([
			["GET", /masked$/, list()],
			[
				"POST",
				/masked$/,
				{
					status: 409,
					body: { error: { code: "conflict", message: "limit" } },
				},
			],
		]);
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");
		await type("News");
		await create();
		expect(await screen.findByText("maskedLimit")).toBeInTheDocument();

		stubRoutes([
			["GET", /masked$/, list()],
			[
				"POST",
				/masked$/,
				{
					status: 400,
					body: { error: { code: "invalid_input", message: "x" } },
				},
			],
		]);
		await create();
		expect(await screen.findByText("maskedRefused")).toBeInTheDocument();
	});

	it("reports an account that is gone as a toast", async () => {
		stubRoutes([
			["GET", /masked$/, list()],
			[
				"POST",
				/masked$/,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
		]);
		render(
			withQuery(
				<>
					<MaskedSection name="alice" />
					<Toaster label="toasts" closeLabel="close" />
				</>,
			),
		);
		await screen.findByText("maskedEmpty");
		await type("News");
		await create();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);
	});

	it("shows the unreachable notice as a warning when the API fails, and a toast when a create fails", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		render(withQuery(<MaskedSection name="alice" />));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unreachable",
		);
		errors.mockRestore();
	});

	it("shows a failed create as an error toast", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubRoutes([
			["GET", /masked$/, list()],
			[
				"POST",
				/masked$/,
				{
					status: 500,
					body: { error: { code: "internal", message: "x" } },
				},
			],
		]);
		render(
			withQuery(
				<>
					<MaskedSection name="alice" />
					<Toaster label="toasts" closeLabel="close" />
				</>,
			),
		);
		await screen.findByText("maskedEmpty");
		await type("News");
		await create();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		errors.mockRestore();
	});

	it("disables the create button while the request is in flight", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const original = globalThis.fetch;
		stubRoutes([["GET", /masked$/, list()]]);
		const base = globalThis.fetch;
		// Held open until the case has looked, then answered: no case ends with a
		// request on its way.
		let answer: (response: Response) => void = () => {};
		globalThis.fetch = mock((input: string | URL, init?: RequestInit) =>
			init?.method === "POST"
				? new Promise<Response>((resolve) => {
						answer = resolve;
					})
				: base(input, init),
		) as unknown as typeof fetch;
		render(withQuery(<MaskedSection name="alice" />));
		await screen.findByText("maskedEmpty");
		await type("News");
		await create();

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "maskedCreating" }),
			).toBeDisabled(),
		);
		answer(new Response("{}", { status: 503 }));
		await settled();
		globalThis.fetch = original;
		errors.mockRestore();
	});
});
