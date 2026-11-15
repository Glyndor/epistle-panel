import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";

import { Form } from "@/components/ui/form";

import { PreferenceField } from ".";

afterEach(cleanup);

const OPTIONS = [
	{ value: "a", label: "Alpha" },
	{ value: "b", label: "Beta", lang: "de" },
] as const;

function Harness({
	error,
	refusal,
}: {
	error?: string;
	refusal?: "required" | "notInList";
}) {
	const form = useForm<{ pick: string }>({
		defaultValues: { pick: "b" },
		errors:
			error === undefined ? {} : { pick: { type: "x", message: error } },
	});
	return (
		<Form {...form}>
			<form>
				<PreferenceField
					control={form.control}
					name="pick"
					label="Pick"
					help="Help text"
					options={OPTIONS}
					refusal={refusal}
					renderMessage={(message) => `says ${message}`}
				/>
			</form>
		</Form>
	);
}

describe("PreferenceField", () => {
	it("is a real select, named by its label and described by its help, holding only its own options", () => {
		render(<Harness />);

		const select = screen.getByLabelText("Pick");
		expect(select.tagName).toBe("SELECT");
		expect(select).toHaveAttribute("name", "pick");
		expect(select).toBeRequired();
		expect(select).toHaveAccessibleDescription("Help text");
		expect(
			screen.getAllByRole("option").map((option) => option.textContent),
		).toEqual(["Alpha", "Beta"]);
		expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute(
			"lang",
			"de",
		);
		expect(
			screen.getByRole("option", { name: "Alpha" }),
		).not.toHaveAttribute("lang");
	});

	it("shows the value the form holds and follows a change", () => {
		render(<Harness />);
		const select = screen.getByLabelText("Pick") as HTMLSelectElement;

		expect(select.value).toBe("b");
		fireEvent.change(select, { target: { value: "a" } });

		expect(select.value).toBe("a");
	});

	it("says its message, as the sentence the caller makes of it, and ties it to the control", () => {
		render(<Harness error="notInList" />);

		const select = screen.getByLabelText("Pick");
		expect(screen.getByRole("alert")).toHaveTextContent("says notInList");
		expect(select).toHaveAttribute("aria-invalid", "true");
		expect(select).toHaveAccessibleDescription("Help text says notInList");
	});

	it("says what the server refused, with no script at all and no error of the form's own, and ties it to the control", () => {
		render(<Harness refusal="notInList" />);

		const select = screen.getByLabelText("Pick");
		expect(screen.getByRole("alert")).toHaveTextContent("says notInList");
		expect(select).toHaveAttribute("aria-invalid", "true");
		expect(select).toHaveAccessibleDescription("Help text says notInList");
	});

	it("says one message when the form and the server both refused, the form's own first", () => {
		render(<Harness error="required" refusal="notInList" />);

		expect(screen.getAllByRole("alert")).toHaveLength(1);
		expect(screen.getByRole("alert")).toHaveTextContent("says required");
	});

	it("shows no message while there is none", () => {
		render(<Harness />);

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByLabelText("Pick")).not.toHaveAttribute(
			"aria-invalid",
		);
	});
});
