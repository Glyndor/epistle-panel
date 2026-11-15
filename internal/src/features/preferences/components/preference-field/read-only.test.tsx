import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { ReadOnlyPreferenceField } from ".";

afterEach(cleanup);
function Harness() {
	const form = useForm({ defaultValues: { remoteImages: "ask" } });
	return (
		<Form {...form}>
			<form>
				<ReadOnlyPreferenceField
					control={form.control}
					name="remoteImages"
					label="Remote images"
					help="Policy help"
					value="Set by the operator: Never"
				/>
			</form>
		</Form>
	);
}
it("exposes a labelled described statement with no editable or posted control", () => {
	const { container } = render(<Harness />);
	const group = screen.getByRole("group", { name: "Remote images" });
	expect(group).toHaveAccessibleDescription("Policy help");
	expect(group).toHaveTextContent("Set by the operator: Never");
	expect(screen.queryByRole("combobox")).toBeNull();
	expect(container.querySelector('[name="remoteImages"]')).toBeNull();
	expect(
		new FormData(container.querySelector("form") as HTMLFormElement).has(
			"remoteImages",
		),
	).toBe(false);
});
