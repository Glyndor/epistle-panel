import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { getNonce } from "get-nonce";

import { StyleNonce } from ".";

afterEach(() => {
	cleanup();
	document.head.innerHTML = "";
});

describe("StyleNonce", () => {
	it("renders nothing and hands the page's script nonce to the scroll-lock library", () => {
		const script = document.createElement("script");
		// A browser hides the value of a nonce attribute but keeps the attribute and
		// the `nonce` property, which is what the component reads.
		script.setAttribute("nonce", "");
		Object.defineProperty(script, "nonce", { value: "n-123" });
		document.head.append(script);

		const { container } = render(<StyleNonce />);

		expect(container.innerHTML).toBe("");
		expect(getNonce()).toBe("n-123");
	});
});
