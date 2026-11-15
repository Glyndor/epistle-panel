import { afterEach, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { clearToasts } from "@/components/ui/toaster";
import { FALLBACK_COMPOSE_LIMITS } from "@/features/mail/schemas/compose-input-limits";
import { ComposeForm } from ".";

const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
afterEach(() => {
	cleanup();
	clearToasts();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});
const initial = {
	to: "a@example.org",
	cc: "b@example.org",
	bcc: "c@example.org",
	subject: "s",
	text: "keep this body",
};
function server() {
	const fetch = mock(
		async (_url: string | URL, _init?: RequestInit) =>
			new Response(
				JSON.stringify({
					ok: true,
					result: { kind: "draft", id: "d" },
				}),
			),
	);
	globalThis.fetch = fetch as unknown as typeof globalThis.fetch;
	return fetch;
}
it.each(["send", "saveDraft"])(
	"shows the total-recipient message under the overflowing field for %s",
	async (action) => {
		const fetch = server();
		render(
			<ComposeForm
				initial={initial}
				limits={{ ...FALLBACK_COMPOSE_LIMITS, maxRecipients: 2 }}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: action }));
		const message = await screen.findByText("refusal_tooManyRecipients");
		expect(screen.getByLabelText("fieldBcc")).toHaveAttribute(
			"aria-describedby",
			message.id,
		);
		expect(screen.getByLabelText("fieldBcc")).toHaveAttribute(
			"aria-invalid",
			"true",
		);
		expect(screen.getByLabelText("fieldBody")).toHaveValue(
			"keep this body",
		);
		expect(fetch).not.toHaveBeenCalled();
	},
);
it("keeps invalid-recipient and total-recipient messages on the same field", async () => {
	const fetch = server();
	render(
		<ComposeForm
			initial={{ ...initial, bcc: "bad, c@example.org" }}
			limits={{ ...FALLBACK_COMPOSE_LIMITS, maxRecipients: 2 }}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "send" }));
	const message = await screen.findByText(
		"invalidRecipients refusal_tooManyRecipients",
	);
	expect(screen.getByLabelText("fieldBcc")).toHaveAttribute(
		"aria-describedby",
		message.id,
	);
	expect(fetch).not.toHaveBeenCalled();
});
it("saves exactly the combined recipient limit without showing an error", async () => {
	const fetch = server();
	render(
		<ComposeForm
			initial={initial}
			limits={{ ...FALLBACK_COMPOSE_LIMITS, maxRecipients: 3 }}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "saveDraft" }));
	await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
	expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
		op: "draft",
		to: [{ email: "a@example.org" }],
		cc: [{ email: "b@example.org" }],
		bcc: [{ email: "c@example.org" }],
	});
	expect(screen.queryByText("refusal_tooManyRecipients")).toBeNull();
	// Wait for the hook to settle before removing its component and fetch stub.
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "saveDraft" })).toBeEnabled(),
	);
});
