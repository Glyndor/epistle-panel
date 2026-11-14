import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { tip } from "@/components/ui/tooltip/test-support";
import type { LabelView } from "@/features/mail/schemas/mail-view";

import { More } from ".";

afterEach(() => {
	fireEvent.pointerDown(document.body);
	cleanup();
});

const label = (name: string): LabelView => ({ keyword: name, name, tone: 1 });
const count = (root: HTMLElement) =>
	root.querySelector<HTMLElement>('[data-slot="label-more"]');

describe("More", () => {
	it("draws nothing when there is no label to count", () => {
		const { container } = render(<More labels={[]} className="h-5" />);

		expect(container).toBeEmptyDOMElement();
	});

	it("says how many labels it stands for", () => {
		const { container } = render(
			<More labels={[label("A"), label("B")]} className="h-5" />,
		);

		expect(count(container)).toHaveAttribute("data-count", "2");
		expect(count(container)).toHaveTextContent("moreLabels");
	});

	it("is a pill that never gives way, where and as tall as it is told", () => {
		const { container } = render(
			<More labels={[label("A")]} className="h-5 @sm/row:hidden" />,
		);

		expect(count(container)).toHaveClass(
			"shrink-0",
			"rounded-full",
			"h-5",
			"@sm/row:hidden",
		);
	});

	it("names its labels under the pointer, each isolated from the others", () => {
		const { container } = render(
			<More labels={[label("Work"), label("Home")]} className="h-5" />,
		);

		fireEvent.pointerEnter(count(container) as Element);

		expect(tip()).toHaveTextContent("Work, Home");
		expect(
			Array.from(tip()?.querySelectorAll("bdi") ?? []).map(
				(name) => name.textContent,
			),
		).toEqual(["Work", "Home"]);
	});
});
