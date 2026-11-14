"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPicker } from "@/features/mail/components/mail-search/form/folder-picker";
import {
	type ListConditions,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";
import { isSearchFormMessage } from "@/features/mail/schemas/search-form";
import { fieldLength } from "@/lib/field-length";

export function FieldError({
	id,
	error,
}: {
	id: string;
	error: string | null;
}) {
	if (error === null) {
		return null;
	}
	return (
		<p
			id={`${id}-message`}
			role="alert"
			className="text-destructive text-xs"
		>
			{error}
		</p>
	);
}

/**
 * A field of the search, with its name and the message of what is wrong with
 * it, if there is one. The message names the field, and the field says that
 * it is the one that is wrong.
 */
function Field({
	id,
	label,
	error,
	children,
}: {
	id: string;
	/** The name of the field, already translated. */
	label: string;
	/** The message of what is wrong, already translated; null when there is none. */
	error: string | null;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={id}>{label}</Label>
			{children}
			<FieldError id={id} error={error} />
		</div>
	);
}

/**
 * The fields of the search, beside the words: who wrote it, who it went to,
 * what its subject says, the days it is kept between, whether it carries an
 * attachment, the folder it is in and the label it holds.
 *
 * Every field carries the length of its schema, one character more, so a
 * value the browser cuts is over the limit and the form names it instead of
 * sending it short. The day's field is the browser's own: it takes a day and
 * gives one back, and refuses a day that is not one.
 */
export function SearchFields({
	conditions,
	errors,
}: {
	/** What the address holds, as the server read it. */
	conditions: ListConditions;
	/** The field that is wrong, and the key of its message. */
	errors: Record<string, string>;
}) {
	const t = useTranslations("mail");
	const message = (field: string) => {
		const key = errors[field];
		return key !== undefined && isSearchFormMessage(key) ? t(key) : null;
	};
	const invalid = (field: string) =>
		errors[field] !== undefined ? true : undefined;
	const described = (field: string, id: string) =>
		message(field) === null ? undefined : `${id}-message`;

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<Field
				id="mail-condition-from"
				label={t("from")}
				error={message("from")}
			>
				<Input
					id="mail-condition-from"
					name="from"
					type="text"
					defaultValue={conditions.from}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("from")}
					aria-describedby={described("from", "mail-condition-from")}
				/>
			</Field>
			<Field id="mail-condition-to" label={t("to")} error={message("to")}>
				<Input
					id="mail-condition-to"
					name="to"
					type="text"
					defaultValue={conditions.to}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("to")}
					aria-describedby={described("to", "mail-condition-to")}
				/>
			</Field>
			<Field
				id="mail-condition-subject"
				label={t("fieldSubject")}
				error={message("subject")}
			>
				<Input
					id="mail-condition-subject"
					name="subject"
					type="text"
					defaultValue={conditions.subject}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("subject")}
					aria-describedby={described(
						"subject",
						"mail-condition-subject",
					)}
				/>
			</Field>
			<Field
				id="mail-condition-after"
				label={t("conditionAfter")}
				error={message("after")}
			>
				<Input
					id="mail-condition-after"
					name="after"
					type="date"
					defaultValue={conditions.after ?? ""}
					aria-invalid={invalid("after")}
					aria-describedby={described(
						"after",
						"mail-condition-after",
					)}
				/>
			</Field>
			<Field
				id="mail-condition-before"
				label={t("conditionBefore")}
				error={message("before")}
			>
				<Input
					id="mail-condition-before"
					name="before"
					type="date"
					defaultValue={conditions.before ?? ""}
					aria-invalid={invalid("before")}
					aria-describedby={described(
						"before",
						"mail-condition-before",
					)}
				/>
			</Field>
			<Field
				id="mail-condition-folder"
				label={t("conditionFolder")}
				error={message("folder")}
			>
				<FolderPicker value={conditions.folder ?? ""} />
			</Field>
			<Field
				id="mail-condition-label"
				label={t("conditionLabel")}
				error={message("label")}
			>
				<Input
					id="mail-condition-label"
					name="label"
					type="text"
					defaultValue={conditions.label ?? ""}
					maxLength={65}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("label")}
					aria-describedby={described(
						"label",
						"mail-condition-label",
					)}
				/>
			</Field>
			<div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
				<Label htmlFor="mail-condition-attachment">
					{t("hasAttachment")}
				</Label>
				<input
					id="mail-condition-attachment"
					name="attachment"
					type="checkbox"
					value="1"
					defaultChecked={conditions.attachment}
					className="size-4 accent-primary"
				/>
			</div>
		</div>
	);
}
