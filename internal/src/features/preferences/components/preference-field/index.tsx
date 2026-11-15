"use client";

import type { Control, FieldValues, Path } from "react-hook-form";

import {
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	useFormField,
} from "@/components/ui/form";
import { FIELD_CLASS } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import type { PreferenceErrorKey } from "@/features/preferences/schemas/preferences";
import { cn } from "@/lib/class-names";

/** One choice of a field: the value the list spells, and how it reads. */
export interface PreferenceOption {
	readonly value: string;
	readonly label: string;
	/** The language the label is written in, when it is not the page's. */
	readonly lang?: string;
}

/**
 * The control, the help and the message of one field, inside its item. A field is
 * invalid when the form's schema refused it or when the server did (`refusal`,
 * which is also what a page rendered with no script shows, since the schema
 * runs in the browser only), and either way the select says so and the message
 * is the one it points to.
 */
function SelectAndMessage({
	name,
	help,
	options,
	refusal,
	renderMessage,
	field,
}: {
	name: string;
	help: string;
	options: readonly PreferenceOption[];
	refusal: PreferenceErrorKey | undefined;
	renderMessage: (message: string) => string;
	field: {
		value: string | undefined;
		onChange: React.ChangeEventHandler<HTMLSelectElement>;
		onBlur: () => void;
		ref: React.Ref<HTMLSelectElement>;
	};
}) {
	const { error, formItemId, formMessageId, formDescriptionId } =
		useFormField();
	const message = error?.message ?? refusal;
	const describedBy = [formDescriptionId, message ? formMessageId : undefined]
		.filter((id) => id !== undefined)
		.join(" ");

	return (
		<>
			<NativeSelect
				id={formItemId}
				name={name}
				ref={field.ref}
				value={field.value}
				onChange={field.onChange}
				onBlur={field.onBlur}
				required
				aria-invalid={message ? true : undefined}
				aria-describedby={describedBy === "" ? undefined : describedBy}
			>
				{options.map((option) => (
					<NativeSelectOption
						key={option.value}
						value={option.value}
						lang={option.lang}
					>
						{option.label}
					</NativeSelectOption>
				))}
			</NativeSelect>
			<FormDescription>{help}</FormDescription>
			{message ? (
				<p
					id={formMessageId}
					role="alert"
					className="text-destructive text-xs"
				>
					{renderMessage(String(message))}
				</p>
			) : null}
		</>
	);
}

export function ReadOnlyPreferenceField<TValues extends FieldValues>({
	control,
	name,
	label,
	help,
	value,
}: {
	control: Control<TValues>;
	name: Path<TValues>;
	label: string;
	help: string;
	value: string;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={() => (
				<FormItem described>
					<ReadOnlyValue label={label} value={value} />
					<FormDescription>{help}</FormDescription>
				</FormItem>
			)}
		/>
	);
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
	const { formItemId, formDescriptionId } = useFormField();

	return (
		<fieldset
			aria-describedby={formDescriptionId}
			className="grid gap-2 border-0 p-0"
		>
			<legend className="mb-2 font-medium text-sm leading-none">
				{label}
			</legend>
			<p
				id={formItemId}
				className={cn(
					FIELD_CLASS,
					"flex items-center bg-field text-muted-foreground hover:bg-field",
				)}
			>
				{value}
			</p>
		</fieldset>
	);
}

/**
 * One field of the preferences form: a label, a real `select` of the closed
 * list, a help text and the field's message. A native `select` posts its value
 * with no script, so the form works before anything loads, and it can hold
 * nothing but one of its own options. The control is the one element the
 * label, the help and the message are tied to.
 */
export function PreferenceField<TValues extends FieldValues>({
	control,
	name,
	label,
	help,
	options,
	refusal,
	renderMessage,
}: {
	control: Control<TValues>;
	name: Path<TValues>;
	label: string;
	help: string;
	options: readonly PreferenceOption[];
	/** What the server said about this field, when it refused it. */
	refusal?: PreferenceErrorKey | undefined;
	/** Turns a message (a key) into the sentence. */
	renderMessage: (message: string) => string;
}) {
	return (
		<FormField
			control={control}
			name={name}
			render={({ field }) => (
				<FormItem described>
					<FormLabel>{label}</FormLabel>
					<SelectAndMessage
						name={field.name}
						options={options}
						refusal={refusal}
						renderMessage={renderMessage}
						field={field}
						help={help}
					/>
				</FormItem>
			)}
		/>
	);
}
