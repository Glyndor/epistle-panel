import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { withQuery } from "@/test/query-wrapper";
import { summary } from "../../../test-support/fixtures";
import { MessageRow } from "../../message-row";

import { RowSkeleton } from ".";

afterEach(cleanup);

/** The classes of `element` that set its height or its side margins, at any variant. */
const box = (element: Element | null) =>
	(element?.className ?? "")
		.split(/\s+/)
		.filter((name) => /(^|:)(h|ps|pe)-[\w./]+$/.test(name))
		.sort();

describe("RowSkeleton", () => {
	it("gives a row's place the height of a real row in both densities and on both pointers", () => {
		const { container } = render(<RowSkeleton />);
		const place = container.querySelector('[data-slot="row-skeleton"]');
		const heights = box(place).filter((name) => /(^|:)h-/.test(name));
		cleanup();
		const real = render(
			withQuery(
				<ul>
					<MessageRow
						message={summary()}
						selected={false}
						view={{
							box: "INBOX",
							role: "inbox",
							page: 1,
							filter: "all",
							q: "",
						}}
						datePart="time"
					/>
				</ul>,
			),
		).container.querySelector("li");

		expect(heights).toEqual([
			"group-data-[density=compact]/list:h-10",
			"h-18",
			"pointer-coarse:group-data-[density=compact]/list:h-11",
		]);
		expect(heights).toEqual(
			box(real).filter((name) => /(^|:)h-/.test(name)),
		);
	});

	it("draws the initials as a circle where the row has them, the lines beside it, and the preview only when comfortable", () => {
		const { container } = render(<RowSkeleton />);
		const place = container.querySelector('[data-slot="row-skeleton"]');
		const [circle, ...lines] = Array.from(place?.children ?? []);
		const C = "group-data-[density=compact]/list:";

		expect(circle).toHaveClass(
			"rounded-full",
			"size-8",
			"hidden",
			"@xs/row:block",
			`${C}size-6`,
			`${C}hidden`,
			`${C}@sm/row:block`,
		);
		expect(lines).toHaveLength(3);
		expect(lines[2]).toHaveClass(`${C}hidden`);
		expect(place).toHaveClass(
			"@container/row",
			"ps-5",
			"pe-3",
			`${C}pe-15`,
		);
	});

	it("never moves: no animation and no style attribute", () => {
		const { container } = render(<RowSkeleton />);

		expect(container.innerHTML).not.toMatch(/animate-|transition/);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
