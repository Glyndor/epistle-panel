"use client";

import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import {
	Controller,
	type ControllerProps,
	type FieldPath,
	type FieldValues,
	FormProvider,
	useFormContext,
	useFormState,
} from "react-hook-form";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/class-names";

/** The form's context provider; every field reads it through `useFormField`. */
const Form = FormProvider;

interface FormFieldContextValue {
	name: string;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
	null,
);
const FormItemContext = React.createContext<{ id: string } | null>(null);

/** One field of the form, wired to react-hook-form through a `Controller`. */
function FormField<
	TFieldValues extends FieldValues = FieldValues,
	TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
	return (
		<FormFieldContext.Provider value={{ name: props.name }}>
			<Controller {...props} />
		</FormFieldContext.Provider>
	);
}

/** The field and item around a part, or an error when the part is outside them. */
function useFieldParts() {
	const field = React.useContext(FormFieldContext);
	const item = React.useContext(FormItemContext);
	if (!field || !item) {
		throw new Error(
			"useFormField must be used inside a FormField and a FormItem.",
		);
	}
	return { field, item };
}

/**
 * The ids and the error of the field around it. It subscribes to the state of
 * its own field only (`useFormState({ name })`), so typing in one field does not
 * re-render the others.
 */
function useFormField() {
	const { field, item } = useFieldParts();
	const { getFieldState } = useFormContext();
	const formState = useFormState({ name: field.name });
	return {
		id: item.id,
		name: field.name,
		formItemId: `${item.id}-form-item`,
		formMessageId: `${item.id}-form-item-message`,
		...getFieldState(field.name, formState),
	};
}

/** Groups a label, a control and a message with one shared id. */
function FormItem({ className, ...props }: React.ComponentProps<"div">) {
	const id = React.useId();

	return (
		<FormItemContext.Provider value={{ id }}>
			<div
				data-slot="form-item"
				className={cn("grid gap-2", className)}
				{...props}
			/>
		</FormItemContext.Provider>
	);
}

/** The label of the field; it names the control and turns to the error colour. */
function FormLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>) {
	const { error, formItemId } = useFormField();

	return (
		<Label
			data-slot="form-label"
			data-error={!!error}
			className={cn("data-[error=true]:text-destructive", className)}
			htmlFor={formItemId}
			{...props}
		/>
	);
}

/**
 * The control itself. It gets the field's id, `aria-invalid` and an
 * `aria-describedby` that names the message only while there is one, so a screen
 * reader is not pointed at an element that does not exist. Props passed to it
 * win, so a caller can point the control at a message of its own.
 */
function FormControl(props: React.ComponentProps<typeof Slot>) {
	const { error, formItemId, formMessageId } = useFormField();

	return (
		<Slot
			data-slot="form-control"
			id={formItemId}
			aria-describedby={error ? formMessageId : undefined}
			aria-invalid={error ? true : undefined}
			{...props}
		/>
	);
}

/**
 * The error of the field, as text. `render` turns the schema's message (a key)
 * into the translated sentence; the paragraph is a polite live region, so the
 * error is announced when it appears and stays out of the way otherwise.
 */
function FormMessage({
	className,
	render,
	...props
}: Omit<React.ComponentProps<"p">, "children"> & {
	render: (message: string) => string;
}) {
	const { error, formMessageId } = useFormField();
	if (!error?.message) {
		return null;
	}

	return (
		<p
			data-slot="form-message"
			id={formMessageId}
			role="alert"
			className={cn("text-destructive text-xs", className)}
			{...props}
		>
			{render(String(error.message))}
		</p>
	);
}

export {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	useFormField,
};
