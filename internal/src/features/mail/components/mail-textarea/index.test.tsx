import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { MailTextarea } from ".";

afterEach(cleanup);

describe("MailTextarea", () => {
	it("is a text area on the shared field look that takes its caller's props and classes", () => {
		render(<MailTextarea aria-label="body" className="extra" rows={3} />);
		const field = screen.getByRole("textbox", { name: "body" });
		expect(field.tagName).toBe("TEXTAREA");
		expect(field).toHaveClass("bg-field", "extra", "min-h-48");
		expect(field).toHaveClass("pointer-coarse:min-h-48");
		expect(field).not.toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		expect(field.className).not.toMatch(/(^|\s)border/);
		expect(field).toHaveAttribute("rows", "3");
		expect(field).toHaveClass("focus-visible:outline-2");
	});
});
