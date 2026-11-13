import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { BodyFrame } from ".";

afterEach(cleanup);

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
});
