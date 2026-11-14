import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Kbd } from ".";

afterEach(cleanup);

describe("Kbd", () => {
	it("is a kbd element with the key in it, a caller's class kept and no inline style", () => {
		render(<Kbd className="extra">j</Kbd>);
		const key = screen.getByText("j");

		expect(key.tagName).toBe("KBD");
		expect(key.className).toContain("font-mono");
		expect(key.className).toContain("extra");
		expect(key).not.toHaveAttribute("style");
	});
});
