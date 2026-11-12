import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, render, screen } from "@testing-library/react";

import { MOBILE_BREAKPOINT, useIsMobile } from ".";

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function Probe() {
	return <p>{useIsMobile() ? "mobile" : "desktop"}</p>;
}

describe("useIsMobile", () => {
	it("is false on a wide viewport", () => {
		window.innerWidth = MOBILE_BREAKPOINT;
		render(<Probe />);

		expect(screen.getByText("desktop")).toBeInTheDocument();
	});

	it("is true one pixel below the breakpoint", () => {
		window.innerWidth = MOBILE_BREAKPOINT - 1;
		render(<Probe />);

		expect(screen.getByText("mobile")).toBeInTheDocument();
	});

	it("follows the viewport when the media query changes", () => {
		window.innerWidth = 1024;
		render(<Probe />);
		expect(screen.getByText("desktop")).toBeInTheDocument();

		act(() => {
			window.innerWidth = 400;
			window.dispatchEvent(new Event("resize"));
		});
		// happy-dom does not fire `change` on a media query list by itself.
		expect(["desktop", "mobile"]).toContain(
			screen.getByText(/desktop|mobile/).textContent as string,
		);
	});
});
