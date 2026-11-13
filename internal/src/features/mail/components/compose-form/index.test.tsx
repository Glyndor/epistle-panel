import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts } from "@/components/ui/toaster";
import { composeFormSchema } from "@/features/mail/schemas/compose-form";
import { ComposeForm, type ComposeInitial } from ".";

const originalFetch = globalThis.fetch;
const originalAssign = window.location.assign;
beforeEach(() => clearToasts());
afterEach(clearToasts);
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
	Object.defineProperty(window.location, "assign", {
		value: originalAssign,
		configurable: true,
		writable: true,
	});
});

const empty: ComposeInitial = {
	to: "",
	cc: "",
	bcc: "",
	subject: "",
	text: "",
};

type Sent = Array<Record<string, unknown>>;
function server(result: unknown, status = 200): Sent {
	const sent: Sent = [];
	globalThis.fetch = mock(async (_url: string | URL, init?: RequestInit) => {
		sent.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify(result), { status });
	}) as unknown as typeof fetch;
	return sent;
}
const type = (label: string, value: string) =>
	fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ComposeForm", () => {
	it("sends the structured message with recipients read, and keeps the thread of a reply", async () => {
		const sent = server({ ok: true, result: { kind: "sent" } });
		const assigned: string[] = [];
		Object.defineProperty(window.location, "assign", {
			value: (url: string) => assigned.push(url),
			configurable: true,
			writable: true,
		});
		render(
			<ComposeForm
				initial={{
					...empty,
					inReplyTo: "o@x.org",
					references: ["o@x.org"],
				}}
			/>,
		);
		type("fieldTo", "Ana <a@x.org>, b@x.org");
		type("fieldSubject", "Hello");
		type("fieldBody", "text");
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]).toEqual({
			op: "send",
			to: [{ name: "Ana", email: "a@x.org" }, { email: "b@x.org" }],
			cc: [],
			bcc: [],
			subject: "Hello",
			text: "text",
			attachments: [],
			inReplyTo: "o@x.org",
			references: ["o@x.org"],
		});
		await waitFor(() => expect(assigned).toEqual(["/app/mail"]));
	});

	it("names the pieces that are not addresses and sends nothing", async () => {
		const sent = server({ ok: true, result: { kind: "sent" } });
		render(<ComposeForm initial={empty} />);
		type("fieldTo", "a@x.org, nope");
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		expect(
			await screen.findByText("invalidRecipients"),
		).toBeInTheDocument();
		expect(sent).toHaveLength(0);
	});

	it("asks for a recipient to send, but not to save a draft", async () => {
		const sent = server({ ok: true, result: { kind: "draft", id: "d1" } });
		render(<ComposeForm initial={empty} />);
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		expect(await screen.findByText("needRecipient")).toBeInTheDocument();
		expect(sent).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]).toMatchObject({ op: "draft", to: [] });
	});

	it("keeps the saved draft's id so the next save replaces it", async () => {
		const sent = server({ ok: true, result: { kind: "draft", id: "d1" } });
		render(<ComposeForm initial={empty} />);
		type("fieldTo", "a@x.org");
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		await waitFor(() => expect(sent).toHaveLength(1));
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "saveDraft" }),
			).toBeEnabled(),
		);
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		await waitFor(() => expect(sent).toHaveLength(2));
		expect(sent[0]?.["draftId"]).toBeUndefined();
		expect(sent[1]?.["draftId"]).toBe("d1");
	});

	it("says why it was refused, keeps what was typed, and keeps the work as a draft", async () => {
		const sent = server({
			ok: true,
			result: {
				kind: "refused",
				reason: "forbiddenToSend",
				draftId: "d2",
			},
		});
		render(<ComposeForm initial={empty} />);
		type("fieldTo", "a@x.org");
		type("fieldBody", "still here");
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"refusal_forbiddenToSend",
		);
		expect(screen.getByLabelText("fieldBody")).toHaveValue("still here");
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "send" })).toBeEnabled(),
		);
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		await waitFor(() => expect(sent).toHaveLength(2));
		expect(sent[1]?.["draftId"]).toBe("d2");
	});

	it("says so when the account has no sender, and when the server cannot be reached or answers badly", async () => {
		server({ ok: true, result: { kind: "noSender" } });
		render(<ComposeForm initial={{ ...empty, to: "a@x.org" }} />);
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("noSender");
		globalThis.fetch = mock(async () => {
			throw new TypeError("network");
		}) as unknown as typeof fetch;
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "send" })).toBeEnabled(),
		);
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		expect(
			await screen.findByText("unavailableCompose"),
		).toBeInTheDocument();
		server({ nope: 1 }, 502);
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "send" })).toBeEnabled(),
		);
		fireEvent.click(screen.getByRole("button", { name: "send" }));
		await waitFor(() =>
			expect(screen.getByText("unavailableCompose")).toBeInTheDocument(),
		);
	});

	it("shows Cc and Bcc only when asked for or already filled, and sends them", async () => {
		const sent = server({ ok: true, result: { kind: "draft", id: "d" } });
		const { unmount } = render(<ComposeForm initial={empty} />);
		expect(screen.queryByLabelText("fieldCc")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "showCcBcc" }));
		type("fieldCc", "c@x.org");
		type("fieldBcc", "d@x.org");
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]).toMatchObject({
			cc: [{ email: "c@x.org" }],
			bcc: [{ email: "d@x.org" }],
		});
		unmount();
		render(<ComposeForm initial={{ ...empty, bcc: "z@x.org" }} />);
		expect(screen.getByLabelText("fieldBcc")).toHaveValue("z@x.org");
	});

	it("gives the browser each field's length, one character over the schema's", () => {
		render(<ComposeForm initial={{ ...empty, cc: "c@x.org" }} />);

		for (const label of ["fieldTo", "fieldCc", "fieldBcc"]) {
			expect(screen.getByLabelText(label)).toHaveAttribute(
				"maxlength",
				"20001",
			);
		}
		expect(screen.getByLabelText("fieldSubject")).toHaveAttribute(
			"maxlength",
			"999",
		);
		expect(screen.getByLabelText("fieldBody")).toHaveAttribute(
			"maxlength",
			"1000001",
		);
		const fits = {
			to: "a".repeat(20_000),
			cc: "",
			bcc: "",
			subject: "s".repeat(998),
			text: "t".repeat(1_000_000),
		};
		expect(composeFormSchema.safeParse(fits).success).toBe(true);
		for (const field of ["to", "subject", "text"] as const) {
			expect([
				field,
				composeFormSchema.safeParse({
					...fits,
					[field]: `${fits[field]}x`,
				}).success,
			]).toEqual([field, false]);
		}
	});

	it("a value the browser cut to a field's length is stopped by the schema, which names the field in words", async () => {
		const sent = server({ ok: true, result: { kind: "draft", id: "d" } });
		render(<ComposeForm initial={empty} />);
		type("fieldTo", "a".repeat(20_001));
		type("fieldSubject", "x".repeat(999));
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		expect(await screen.findByText("subjectTooLong")).toBeInTheDocument();
		expect(screen.getByText("recipientsTooLong")).toBeInTheDocument();
		expect(sent).toHaveLength(0);
	});

	it("sends the attachments it was opened with, by blob id, and leaves through its own link", async () => {
		const sent = server({ ok: true, result: { kind: "draft", id: "d" } });
		render(
			<ComposeForm
				initial={{
					...empty,
					to: "a@x.org",
					attachments: [
						{
							blobId: "m1.2",
							name: "a.pdf",
							type: "application/pdf",
							size: 9,
						},
					],
				}}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
		await waitFor(() => expect(sent).toHaveLength(1));
		expect(sent[0]?.["attachments"]).toEqual([
			{ blobId: "m1.2", name: "a.pdf", type: "application/pdf" },
		]);
		expect(screen.getByRole("link", { name: "discard" })).toHaveAttribute(
			"href",
			"/app/mail",
		);
	});
});
