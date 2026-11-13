import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { BodyFrame } from ".";

afterEach(() => {
	cleanup();
	document.documentElement.removeAttribute("data-theme");
});

describe("BodyFrame", () => {
	it("is a sandboxed frame with no script and no same-origin access, on the body route", () => {
		render(<BodyFrame messageId="abc" remoteImages={false} />);
		const frame = screen.getByTitle("bodyFrame");
		expect(frame).toHaveAttribute("src", "/app/mail/body/abc");
		const sandbox = frame.getAttribute("sandbox") ?? "";
		expect(sandbox.split(" ").sort()).toEqual([
			"allow-popups",
			"allow-popups-to-escape-sandbox",
		]);
		expect(sandbox).not.toContain("allow-scripts");
		expect(sandbox).not.toContain("allow-same-origin");
		expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
	});

	it("asks for the remote images only when told to", () => {
		render(<BodyFrame messageId="abc" remoteImages />);
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			"/app/mail/body/abc?images=1",
		);
	});

	it("tells the body the theme pinned on the page, and nothing when none is", async () => {
		render(<BodyFrame messageId="abc" remoteImages={false} />);
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			"/app/mail/body/abc",
		);
		cleanup();

		document.documentElement.setAttribute("data-theme", "dark");
		render(<BodyFrame messageId="abc" remoteImages />);
		expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
			"src",
			"/app/mail/body/abc?images=1&theme=dark",
		);
	});

	it("loads the body again, in the new theme, when the theme changes", async () => {
		render(<BodyFrame messageId="abc" remoteImages={false} />);
		const before = screen.getByTitle("bodyFrame");

		document.documentElement.setAttribute("data-theme", "light");

		await waitFor(() =>
			expect(screen.getByTitle("bodyFrame")).toHaveAttribute(
				"src",
				"/app/mail/body/abc?theme=light",
			),
		);
		// A new frame, not the old one sent elsewhere: its document starts over.
		expect(screen.getByTitle("bodyFrame")).not.toBe(before);
	});
});
