import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { MessageSummary } from "@/features/mail/schemas/mail-view";

import { MessageRow } from ".";

afterEach(cleanup);

const message = (over: Partial<MessageSummary> = {}): MessageSummary => ({
	id: "id-1",
	from: { name: "Ana", email: "ana@example.org" },
	subject: "Hello",
	receivedAt: "2026-11-12T10:00:00Z",
	preview: "preview",
	unread: false,
	flagged: false,
	important: false,
	answered: false,
	forwarded: false,
	draft: false,
	hasAttachment: false,
	labels: [],
	...over,
});
const view = {
	box: "INBOX",
	role: "inbox",
	page: 2,
	filter: "unread",
	q: "x",
} as const;

function row(m: MessageSummary, selected = false) {
	return render(
		<ul>
			<MessageRow message={m} selected={selected} view={view} />
		</ul>,
	);
}

describe("MessageRow", () => {
	it("links to the message and keeps the list's own parameters", () => {
		row(message());
		const link = screen.getByRole("link");
		expect(link).toHaveAttribute(
			"href",
			"/app/mail/inbox/id-1?page=2&filter=unread&q=x",
		);
		expect(link).toHaveAttribute("data-message-id", "id-1");
		expect(link).not.toHaveAttribute("aria-current");
		expect(screen.getByText("Hello")).toBeInTheDocument();
		expect(screen.getByText("preview")).toBeInTheDocument();
	});

	it("isolates each text from message with bdi so it cannot reorder its neighbours", () => {
		const { container } = row(message());
		expect(container.querySelectorAll("bdi")).toHaveLength(3);
	});

	it("marks the selected message and spells the states out", () => {
		row(
			message({
				unread: true,
				flagged: true,
				answered: true,
				draft: true,
				hasAttachment: true,
			}),
			true,
		);
		expect(screen.getByRole("link")).toHaveAttribute(
			"aria-current",
			"true",
		);
		expect(
			screen.getByText(
				"stateUnread, stateFlagged, stateAnswered, stateDraft, hasAttachment.",
			),
		).toBeInTheDocument();
	});

	it("has no state text for a read, plain message", () => {
		const { container } = row(message());
		expect(container.querySelector(".sr-only")).toBeNull();
	});

	it("falls back to the address, then to a placeholder, and to a placeholder for no subject", () => {
		row(
			message({
				from: { name: null, email: "x@example.org" },
				subject: "",
			}),
		);
		expect(screen.getByText("x@example.org")).toBeInTheDocument();
		expect(screen.getByText("noSubject")).toBeInTheDocument();
		cleanup();
		row(message({ from: null }));
		expect(screen.getByText("noSender")).toBeInTheDocument();
	});

	it("prints the date in a time element", () => {
		const { container } = row(message());
		expect(container.querySelector("time")).toHaveAttribute(
			"dateTime",
			"2026-11-12T10:00:00Z",
		);
	});
});
