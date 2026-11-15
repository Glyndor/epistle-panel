import { afterEach, beforeEach, expect, it } from "bun:test";
import { fireEvent, screen } from "@testing-library/react";
import { box, disclosure, install, reset, tree } from "../test-support";

beforeEach(install);
afterEach(reset);

for (const [kind, name] of [
	["HTML", '<img src=x onerror="alert(1)"><script>bad()</script>'],
	["long", "Long".repeat(1000)],
	["RTL", "البريد עברית"],
] as const) {
	it(`renders a hostile ${kind} folder name as isolated text in the link and disclosure label`, () => {
		const parent = { ...box("parent"), name };
		const { container } = tree([parent, box("child", "parent")]);
		const link = screen.getByRole("link", { name });
		expect(link.querySelector("bdi")?.textContent).toBe(name);
		expect(link.querySelector("bdi")?.children).toHaveLength(0);
		expect(container.querySelector("img, script")).toBeNull();
		expect(disclosure(name)).toHaveAccessibleName(`Fold ${name}`);
		fireEvent.click(disclosure(name));
		expect(disclosure(name, false)).toHaveAccessibleName(`Unfold ${name}`);
		expect(screen.queryByRole("link", { name: "child" })).toBeNull();
	});
}
