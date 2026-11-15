import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { BrandMark } from ".";

afterEach(() => {
	cleanup();
	delete process.env["EPISTLE_PANEL_BRAND_ORIGIN"];
});

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

	it("draws the logo from the brand origin when the operator set one", () => {
		process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "https://cdn.example.com";
		const { container } = render(<BrandMark hasLogo />);

		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"https://cdn.example.com/brand/logo",
		);
	});

	it("keeps the panel's own address for a brand origin that is not an origin", () => {
		process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "https://cdn.example.com/x";
		const { container } = render(<BrandMark hasLogo />);

		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"/brand/logo",
		);
	});
});
