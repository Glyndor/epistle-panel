import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { narrowText, stepText } from ".";

afterEach(cleanup);

describe("reading a step of a trail in a test", () => {
	it("reads a step once, without the copy kept for the narrow bar", () => {
		const { container } = render(
			<li>
				<a href="/app/mail">
					<span>Mail</span>
				</a>
				<span data-slot="breadcrumb-narrow">Mail</span>
			</li>,
		);
		const step = container.querySelector("li") as Element;

		expect(step.textContent).toBe("MailMail");
		expect(stepText(step)).toBe("Mail");
		expect(narrowText(step)).toBe("Mail");
		// The step itself is left as it was.
		expect(step.querySelectorAll("span")).toHaveLength(2);
	});

	it("reads a step drawn at every width as it is", () => {
		const { container } = render(<li>Inbox</li>);
		const step = container.querySelector("li") as Element;

		expect(stepText(step)).toBe("Inbox");
		expect(narrowText(step)).toBeNull();
	});
});
