import { describe, expect, it } from "bun:test";
import { code, elements } from "../source";
import { utilityFailures } from "../utilities";
import { contentFailures, selectionFailures } from ".";

const BUTTON = 'import { Button } from "@/components/ui/button";';
const failures = (source: string) =>
	selectionFailures("fixture.tsx", code(source), false);

describe("cursor and selection source detector controls", () => {
	it("checks every hand-made button, link and interactive role individually", () => {
		for (const opening of [
			"button",
			'a href="/"',
			'div role="button"',
			'div role={"tab"}',
			'div role="menuitem"',
		]) {
			expect(failures(`<${opening} />`)).toHaveLength(1);
			expect(failures(`<${opening} className="select-none" />`)).toEqual(
				[],
			);
		}
		expect(
			failures('<button className="select-none" /><button />'),
		).toHaveLength(1);
		expect(
			failures('<div className="select-none"><button /></div>'),
		).toHaveLength(1);
	});

	it("inherits only from real shared parts and respects the closing tag", () => {
		expect(
			failures(`${BUTTON}<Button asChild><a href="/" /></Button>`),
		).toEqual([]);
		expect(failures(`${BUTTON}<Button /><a href="/" />`)).toHaveLength(1);
		expect(failures("<Button><button /></Button>")).toHaveLength(1);
		expect(
			failures(
				'import { Button } from "@/components/ui/unrelated"; <Button><button /></Button>',
			),
		).toHaveLength(1);
		expect(
			failures(
				'import { Button as Control } from "@/components/ui/button"; <Control><a href="/" /></Control>',
			),
		).toEqual([]);
	});

	it("resolves local base constants and cva without accepting conditional or variant-only selection", () => {
		expect(
			failures(
				'const BASE = "select-none"; <button className={cn(BASE, className)} />',
			),
		).toEqual([]);
		expect(
			failures(
				'<button className={cn(active && "select-none", className)} />',
			),
		).toHaveLength(1);
		expect(
			failures(
				'const buttonVariants = cva("flex", { variants: { size: { sm: "select-none" } } }); const Comp = "button"; <Comp className={buttonVariants()} />',
			),
		).toHaveLength(1);
		expect(
			failures(
				'const tabVariants = cva("select-none", {}); const Comp = "button"; <Comp className={tabVariants()} />',
			),
		).toEqual([]);
	});

	it("finds controls in new UI files, including Radix tabs and menu items", () => {
		for (const tag of [
			"button",
			"TabsPrimitive.Trigger",
			"MenuPrimitive.Item",
			"MenuPrimitive.CheckboxItem",
		]) {
			expect(
				selectionFailures(
					"components/ui/new-part/index.tsx",
					`<${tag} />`,
					true,
				),
			).toHaveLength(1);
		}
		expect(
			selectionFailures(
				"components/ui/new-link/index.tsx",
				"<a {...props} />",
				true,
			),
		).toHaveLength(1);
	});

	it("does not let comments or quoted examples supply a selection class or a control", () => {
		expect(
			failures("/** select-none <button /> */ <button />"),
		).toHaveLength(1);
		expect(
			failures('const example = "<button />"; // <button />\n<div />'),
		).toEqual([]);
	});

	it("handles arrows, quoted angle brackets, prop JSX, generics and nested classes", () => {
		expect(
			failures(
				'<button onClick={() => setValue(x => x > 1)} className={cn("select-none", active && "bg-accent")} />',
			),
		).toEqual([]);
		expect(failures("<Notice action={<button />} />")).toHaveLength(1);
		expect(
			elements(
				'type Props = React.ComponentProps<typeof Button>; <button title="a > b" />',
			),
		).toHaveLength(1);
	});

	it("rejects selection on the reader body, the table cell and their containers", () => {
		for (const source of [
			'<pre className="select-none">body</pre>',
			'<td className="select-none">id</td>',
			'<div className="select-none"><pre>body</pre></div>',
			'<td className={cn(active && "select-none")}>id</td>',
		]) {
			expect(contentFailures("content.tsx", source)).toHaveLength(1);
		}
		expect(
			contentFailures(
				"content.tsx",
				`${BUTTON}<div><Button /><pre>body</pre></div>`,
			),
		).toEqual([]);
	});

	it("flags conflicting utilities on controls, including constants and conditional variants", () => {
		for (const token of [
			"hover:cursor-pointer",
			"cursor-default",
			"hover:cursor-default",
		]) {
			expect(
				utilityFailures(
					"fixture.tsx",
					`<button className="${token}" />`,
				),
			).toHaveLength(1);
			expect(
				utilityFailures(
					"fixture.tsx",
					`const BASE = "${token}"; <button className={BASE} />`,
				),
			).toHaveLength(1);
		}
		expect(
			utilityFailures(
				"fixture.tsx",
				'<button className={cn(active && "hover:cursor-pointer")} />',
			),
		).toHaveLength(1);
		expect(
			utilityFailures(
				"fixture.tsx",
				'const buttonVariants = cva("flex", { variants: { size: { sm: "cursor-default" } } }); const Comp = "button"; <Comp className={buttonVariants()} />',
			),
		).toHaveLength(1);
		expect(
			utilityFailures(
				"fixture.tsx",
				'<div className="cursor-pointer" /><button className="cursor-help" />',
			),
		).toEqual([]);
	});
});
