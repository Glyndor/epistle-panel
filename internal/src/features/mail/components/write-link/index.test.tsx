import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { WriteLink } from ".";

afterEach(cleanup);

describe("WriteLink", () => {
	it("is a link to the composer", () => {
		render(<WriteLink />);
		expect(screen.getByRole("link", { name: "compose" })).toHaveAttribute(
			"href",
			"/app/mail/compose",
		);
	});
});
