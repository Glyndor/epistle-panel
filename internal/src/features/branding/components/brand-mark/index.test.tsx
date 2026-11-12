import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { BrandMark } from ".";

afterEach(cleanup);

describe("BrandMark", () => {
	it("draws the Epistle mark when no logo is configured", () => {
		const { container } = render(<BrandMark hasLogo={false} />);

		expect(container.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(container.querySelector("img")).toBeNull();
	});

	it("draws the operator's logo from the panel's own origin, hidden from assistive tech", () => {
		const { container } = render(<BrandMark hasLogo />);

		const img = container.querySelector("img");
		expect(img).toHaveAttribute("src", "/brand/logo");
		expect(img).toHaveAttribute("alt", "");
		expect(img).not.toHaveAttribute("style");
		expect(container.querySelector("svg")).toBeNull();
	});
});
