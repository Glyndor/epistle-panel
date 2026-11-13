import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { MessageDetail } from "@/features/mail/schemas/mail-view";

import { BodyView } from ".";

afterEach(cleanup);

const base = {
	id: "m1",
	subject: "s",
	from: [],
	to: [],
	cc: [],
	replyTo: [],
	receivedAt: "x",
	messageId: null,
	unread: false,
	flagged: false,
	mailboxId: null,
	attachments: [],
	headers: [],
} satisfies Omit<MessageDetail, "body">;

describe("BodyView", () => {
	it("says so when there is no content", () => {
		render(<BodyView message={{ ...base, body: { kind: "none" } }} />);
		expect(screen.getByText("noBody")).toBeInTheDocument();
	});

	it("shows a text body as text, never as markup, and says when it was cut", () => {
		render(
			<BodyView
				message={{
					...base,
					body: { kind: "text", text: "<b>hi</b>", truncated: true },
				}}
			/>,
		);
		expect(screen.getByText("<b>hi</b>")).toBeInTheDocument();
		expect(document.querySelector("b")).toBeNull();
		expect(screen.getByText("truncated")).toBeInTheDocument();
		expect(document.querySelector("pre")).toHaveAttribute("dir", "auto");
	});

	it("keeps remote images blocked until the button is pressed, then reloads the frame with them", () => {
		render(
			<BodyView
				message={{
					...base,
					body: {
						kind: "html",
						blockedImages: 2,
						truncated: false,
						alternativeText: null,
					},
				}}
			/>,
		);
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			"/app/mail/body/m1",
		);
		expect(screen.getByText("imagesBlocked")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "loadImages" }));
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			"/app/mail/body/m1?images=1",
		);
		expect(screen.queryByRole("button", { name: "loadImages" })).toBeNull();
	});

	it("offers no image button when none were blocked, and no text switch without a text version", () => {
		render(
			<BodyView
				message={{
					...base,
					body: {
						kind: "html",
						blockedImages: 0,
						truncated: true,
						alternativeText: null,
					},
				}}
			/>,
		);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("truncated")).toBeInTheDocument();
	});

	it("switches between the frame and the plain text version", () => {
		render(
			<BodyView
				message={{
					...base,
					body: {
						kind: "html",
						blockedImages: 1,
						truncated: false,
						alternativeText: "plain <i>text</i>",
					},
				}}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "showText" }));
		expect(screen.getByText("plain <i>text</i>")).toBeInTheDocument();
		expect(screen.queryByTitle("bodyFrame")).toBeNull();
		expect(screen.queryByText("imagesBlocked")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "showFormatted" }));
		expect(screen.getByTitle("bodyFrame")).toBeInTheDocument();
	});
});
