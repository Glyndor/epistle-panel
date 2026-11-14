"use client";

import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderPicker } from "@/features/mail/components/mail-search/form/folder-picker";
import type { ListConditions } from "@/features/mail/schemas/list-conditions-model";
import { MAX_CONDITION_TEXT } from "@/features/mail/schemas/list-conditions-model";
import { isSearchFormMessage } from "@/features/mail/schemas/search-form";
import { fieldLength } from "@/lib/field-length";

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

	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-from">{t("from")}</Label>
				<Input
					id="mail-condition-from"
					name="from"
					type="text"
					defaultValue={conditions.from}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("from")}
					aria-describedby={
						message("from") === null
							? undefined
							: "mail-condition-from-message"
					}
				/>
				{message("from") === null ? null : (
					<p
						id="mail-condition-from-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("from")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-to">{t("to")}</Label>
				<Input
					id="mail-condition-to"
					name="to"
					type="text"
					defaultValue={conditions.to}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("to")}
					aria-describedby={
						message("to") === null
							? undefined
							: "mail-condition-to-message"
					}
				/>
				{message("to") === null ? null : (
					<p
						id="mail-condition-to-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("to")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-subject">
					{t("fieldSubject")}
				</Label>
				<Input
					id="mail-condition-subject"
					name="subject"
					type="text"
					defaultValue={conditions.subject}
					maxLength={fieldLength(MAX_CONDITION_TEXT)}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("subject")}
					aria-describedby={
						message("subject") === null
							? undefined
							: "mail-condition-subject-message"
					}
				/>
				{message("subject") === null ? null : (
					<p
						id="mail-condition-subject-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("subject")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-after">
					{t("conditionAfter")}
				</Label>
				<Input
					id="mail-condition-after"
					name="after"
					type="date"
					defaultValue={conditions.after ?? ""}
					aria-invalid={invalid("after")}
					aria-describedby={
						message("after") === null
							? undefined
							: "mail-condition-after-message"
					}
				/>
				{message("after") === null ? null : (
					<p
						id="mail-condition-after-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("after")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-before">
					{t("conditionBefore")}
				</Label>
				<Input
					id="mail-condition-before"
					name="before"
					type="date"
					defaultValue={conditions.before ?? ""}
					aria-invalid={invalid("before")}
					aria-describedby={
						message("before") === null
							? undefined
							: "mail-condition-before-message"
					}
				/>
				{message("before") === null ? null : (
					<p
						id="mail-condition-before-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("before")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-folder">
					{t("conditionFolder")}
				</Label>
				<FolderPicker value={conditions.folder ?? ""} />
				{message("folder") === null ? null : (
					<p
						id="mail-condition-folder-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("folder")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="mail-condition-label">
					{t("conditionLabel")}
				</Label>
				<Input
					id="mail-condition-label"
					name="label"
					type="text"
					defaultValue={conditions.label ?? ""}
					maxLength={65}
					autoComplete="off"
					spellCheck={false}
					aria-invalid={invalid("label")}
					aria-describedby={
						message("label") === null
							? undefined
							: "mail-condition-label-message"
					}
				/>
				{message("label") === null ? null : (
					<p
						id="mail-condition-label-message"
						role="alert"
						className="text-destructive text-xs"
					>
						{message("label")}
					</p>
				)}
			</div>
			<div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
				<Label htmlFor="mail-condition-attachment">
					{t("hasAttachment")}
				</Label>
				<div className="flex items-center gap-2">
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
		</div>
	);
}
