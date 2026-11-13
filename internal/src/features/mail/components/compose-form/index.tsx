"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SendIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import {
	type ComposeAttachment,
	ComposeAttachments,
} from "@/features/mail/components/compose-attachments";
import { useComposeSubmit } from "@/features/mail/components/compose-form/use-compose-submit";
import { MailTextarea } from "@/features/mail/components/mail-textarea";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	type ComposeFormValues,
	composeFormSchema,
} from "@/features/mail/schemas/compose-form";
import { parseRecipients } from "@/features/mail/schemas/recipients";

/** What opens the composer: empty, or filled for a reply, a forward or a stored draft. */
export interface ComposeInitial extends ComposeFormValues {
	readonly draftId?: string | undefined;
	readonly inReplyTo?: string | undefined;
	readonly references?: string[] | undefined;
	readonly attachments?: ComposeAttachment[] | undefined;
}

type RecipientField = "to" | "cc" | "bcc";
const RECIPIENT_FIELDS: readonly RecipientField[] = ["to", "cc", "bcc"];

/**
 * The composer: recipients, subject, body, attachments, and the three ways out
 * (save draft, send, discard). The form checks sizes and reads the recipients
 * (naming the pieces that are not addresses) as fail-fast help; the route is the
 * gate and parses the structured message again. Saving replaces the previous
 * draft, so what is open is always the latest copy; sending that the server
 * refuses leaves the work as a draft and says why. It needs script: unlike
 * sign-in there is no form post to fall back to.
 */
export function ComposeForm({ initial }: { initial: ComposeInitial }) {
	const t = useTranslations("mail");
	const { submit, pending, outcome } = useComposeSubmit();
	const [draftId, setDraftId] = useState(initial.draftId);
	const [attachments, setAttachments] = useState<ComposeAttachment[]>(
		initial.attachments ?? [],
	);
	const [showCopies, setShowCopies] = useState(
		initial.cc !== "" || initial.bcc !== "",
	);
	const form = useForm<ComposeFormValues>({
		resolver: zodResolver(composeFormSchema),
		defaultValues: {
			to: initial.to,
			cc: initial.cc,
			bcc: initial.bcc,
			subject: initial.subject,
			text: initial.text,
		},
		mode: "onSubmit",
		reValidateMode: "onChange",
	});

	const run = (op: "draft" | "send") =>
		form.handleSubmit(async (values) => {
			const parsed = Object.fromEntries(
				RECIPIENT_FIELDS.map((field) => [
					field,
					parseRecipients(values[field]),
				]),
			) as Record<RecipientField, ReturnType<typeof parseRecipients>>;
			let refused = false;
			for (const field of RECIPIENT_FIELDS) {
				const { invalid } = parsed[field];
				if (invalid.length > 0) {
					form.setError(field, {
						message: t("invalidRecipients", {
							list: invalid.join(", "),
						}),
					});
					refused = true;
				}
			}
			const count = RECIPIENT_FIELDS.reduce(
				(total, field) => total + parsed[field].recipients.length,
				0,
			);
			if (op === "send" && count === 0 && !refused) {
				form.setError("to", { message: t("needRecipient") });
				refused = true;
			}
			if (refused) {
				return;
			}
			const result = await submit({
				op,
				draftId,
				to: parsed.to.recipients,
				cc: parsed.cc.recipients,
				bcc: parsed.bcc.recipients,
				subject: values.subject,
				text: values.text,
				attachments: attachments.map(({ blobId, name, type }) => ({
					blobId,
					name,
					type,
				})),
				inReplyTo: initial.inReplyTo,
				references: initial.references,
			});
			if (result.kind === "draft") {
				setDraftId(result.id);
				toast.success(t("draftSaved"));
			} else if (result.kind === "sent") {
				toast.success(t("sentOk"));
				window.location.assign(mailHref({}));
			} else if (result.kind === "refused" && result.draftId !== null) {
				setDraftId(result.draftId);
			}
		});

	const problem =
		outcome.kind === "refused"
			? t(`refusal_${outcome.reason}`)
			: outcome.kind === "noSender"
				? t("noSender")
				: outcome.kind === "unavailable"
					? t("unavailableCompose")
					: null;
	const translate = (key: string) =>
		key === "subjectTooLong" || key === "bodyTooLong" ? t(key) : key;

	return (
		<Form {...form}>
			<form
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void run("send")(event);
				}}
				className="flex flex-col gap-4 p-4"
			>
				{problem === null ? null : (
					<Alert variant="warning">
						<AlertDescription>{problem}</AlertDescription>
					</Alert>
				)}
				<FormField
					control={form.control}
					name="to"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("fieldTo")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									type="text"
									autoComplete="off"
									spellCheck={false}
								/>
							</FormControl>
							<FormMessage render={translate} />
						</FormItem>
					)}
				/>
				{showCopies ? (
					RECIPIENT_FIELDS.slice(1).map((name) => (
						<FormField
							key={name}
							control={form.control}
							name={name}
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t(
											name === "cc"
												? "fieldCc"
												: "fieldBcc",
										)}
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											type="text"
											autoComplete="off"
											spellCheck={false}
										/>
									</FormControl>
									<FormMessage render={translate} />
								</FormItem>
							)}
						/>
					))
				) : (
					<Button
						type="button"
						variant="link"
						size="sm"
						className="self-start"
						onClick={() => setShowCopies(true)}
					>
						{t("showCcBcc")}
					</Button>
				)}
				<p className="text-muted-foreground text-xs">
					{t("recipientsHint")}
				</p>
				<FormField
					control={form.control}
					name="subject"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("fieldSubject")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									type="text"
									autoComplete="off"
								/>
							</FormControl>
							<FormMessage render={translate} />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="text"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("fieldBody")}</FormLabel>
							<FormControl>
								<MailTextarea {...field} rows={14} />
							</FormControl>
							<FormMessage render={translate} />
						</FormItem>
					)}
				/>
				<ComposeAttachments
					attachments={attachments}
					onChange={setAttachments}
				/>
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="submit"
						disabled={pending !== null}
						aria-busy={pending === "send"}
					>
						<SendIcon aria-hidden="true" />
						{t("send")}
					</Button>
					<Button
						type="button"
						variant="secondary"
						disabled={pending !== null}
						aria-busy={pending === "draft"}
						onClick={() => void run("draft")()}
					>
						{pending === "draft"
							? t("savingDraft")
							: t("saveDraft")}
					</Button>
					<Button asChild variant="ghost">
						<Link href={mailHref({})}>{t("discard")}</Link>
					</Button>
				</div>
			</form>
		</Form>
	);
}
