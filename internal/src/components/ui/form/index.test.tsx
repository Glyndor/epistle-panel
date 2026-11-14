import { afterEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { type Resolver, useForm } from "react-hook-form";

import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
} from ".";

afterEach(cleanup);

interface Values {
	email: string;
}

/** A resolver that wants an email: the error carries a message key, as the schemas' do. */
const resolve = (async (values: Values) =>
	values.email
		? { values, errors: {} }
		: {
				values: {},
				errors: { email: { type: "required", message: "needEmail" } },
			}) as unknown as Resolver<Values>;

function Harness() {
	const form = useForm<Values>({
		defaultValues: { email: "" },
		resolver: resolve,
	});
	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(() => {})}>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<input {...field} />
							</FormControl>
							<FormMessage
								render={(key) => `translated:${key}`}
							/>
						</FormItem>
					)}
				/>
				<button type="submit">go</button>
			</form>
		</Form>
	);
}

/** The same field with a help text, and one whose item forgot to say it has one. */
function Described({ marked }: { marked: boolean }) {
	const form = useForm<Values>({
		defaultValues: { email: "" },
		resolver: resolve,
	});
	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(() => {})}>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem described={marked}>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<input {...field} />
							</FormControl>
							<FormDescription>
								Where we write to.
							</FormDescription>
							<FormMessage
								render={(key) => `translated:${key}`}
							/>
						</FormItem>
					)}
				/>
				<button type="submit">go</button>
			</form>
		</Form>
	);
}

function Orphan() {
	useFormField();
	return null;
}

describe("Form", () => {
	it("ties the label to the control and gives it no description until there is an error", () => {
		render(<Harness />);

		const input = screen.getByLabelText("Email");
		expect(input).not.toHaveAttribute("aria-describedby");
		expect(input).not.toHaveAttribute("aria-invalid");
	});

	it("shows the translated error as an alert, names it as the control's description, and marks the control invalid", async () => {
		render(<Harness />);

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "go" }));
		});

		const message = await screen.findByRole("alert");
		expect(message).toHaveTextContent("translated:needEmail");
		const input = screen.getByLabelText("Email");
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveAttribute("aria-describedby", message.id);
		expect(screen.getByText("Email")).toHaveAttribute("data-error", "true");
	});

	it("takes the error away once the field is valid", async () => {
		render(<Harness />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "go" }));
		});
		await screen.findByRole("alert");

		await act(async () => {
			fireEvent.change(screen.getByLabelText("Email"), {
				target: { value: "a@b" },
			});
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "go" }));
		});

		await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
	});

	it("describes the control by its help text from the start, and by the help and the error once there is one", async () => {
		render(<Described marked />);

		const input = screen.getByLabelText("Email");
		const help = screen.getByText("Where we write to.");
		expect(input).toHaveAttribute("aria-describedby", help.id);
		expect(input).toHaveAccessibleDescription("Where we write to.");

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "go" }));
		});
		const message = await screen.findByRole("alert");
		expect(input).toHaveAttribute(
			"aria-describedby",
			`${help.id} ${message.id}`,
		);
	});

	it("refuses a help text whose item does not say it has one, since the control would not point at it", () => {
		const original = console.error;
		console.error = () => {};
		try {
			expect(() => render(<Described marked={false} />)).toThrow(
				"described",
			);
		} finally {
			console.error = original;
		}
	});

	it("throws when a field part is used outside a field", () => {
		const original = console.error;
		console.error = () => {};
		try {
			expect(() => render(<Orphan />)).toThrow("useFormField");
		} finally {
			console.error = original;
		}
	});
});
