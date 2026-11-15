import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	COPYRIGHT_NOTICE_NONE,
	COPYRIGHT_NOTICE_VARIABLE,
	DEFAULT_COPYRIGHT_NOTICE,
} from "@/lib/config/copyright-notice";

import { CopyrightNotice } from ".";

let saved: string | undefined;

beforeEach(() => {
	saved = process.env[COPYRIGHT_NOTICE_VARIABLE];
});

afterEach(() => {
	cleanup();
	if (saved === undefined) {
		delete process.env[COPYRIGHT_NOTICE_VARIABLE];
	} else {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = saved;
	}
});

describe("CopyrightNotice", () => {
	it("shows the panel's own notice when the operator sets none", () => {
		delete process.env[COPYRIGHT_NOTICE_VARIABLE];

		render(<CopyrightNotice />);

		expect(screen.getByText(DEFAULT_COPYRIGHT_NOTICE)).toBeInTheDocument();
	});

	it("shows the line the operator chose", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "© 2026 Acme";

		render(<CopyrightNotice />);

		expect(screen.getByText("© 2026 Acme")).toBeInTheDocument();
	});

	it("shows a line that looks like markup as the characters it is", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "<b>Acme</b>";

		render(<CopyrightNotice />);

		expect(screen.getByText("<b>Acme</b>")).toBeInTheDocument();
		expect(document.querySelector("b")).toBeNull();
	});

	it("shows no line at all when the operator asks for none", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = COPYRIGHT_NOTICE_NONE;

		const { container } = render(<CopyrightNotice />);

		expect(container).toBeEmptyDOMElement();
		expect(screen.queryByText(DEFAULT_COPYRIGHT_NOTICE)).toBeNull();
	});

	it("takes a class for placement", () => {
		delete process.env[COPYRIGHT_NOTICE_VARIABLE];

		render(<CopyrightNotice className="text-xs" />);

		expect(screen.getByText(DEFAULT_COPYRIGHT_NOTICE)).toHaveClass(
			"text-xs",
		);
	});
});

it("breaks a 200-character unspaced notice and preserves placement classes", () => {
	process.env[COPYRIGHT_NOTICE_VARIABLE] = "x".repeat(200);
	render(<CopyrightNotice className="text-xs" />);
	expect(screen.getByText("x".repeat(200))).toHaveClass(
		"[overflow-wrap:anywhere]",
		"text-xs",
	);
	expect(screen.getByText("x".repeat(200))).not.toHaveAttribute("style");
});
