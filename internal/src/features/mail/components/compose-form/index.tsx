"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import {
	checkRecipients,
	RECIPIENT_FIELDS,
	type RecipientField,
} from "@/features/mail/components/compose-form/check-recipients";
import { ComposeActions } from "@/features/mail/components/compose-form/compose-actions";
import { fieldMessage } from "@/features/mail/components/compose-form/field-message";
import { RecipientInput } from "@/features/mail/components/compose-form/recipient-input";
import {
	type ComposeOrigin,
	useComposeSubmit,
} from "@/features/mail/components/compose-form/use-compose-submit";
import { MailTextarea } from "@/features/mail/components/mail-textarea";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	type ComposeFormValues,
	composeFormSchema,
} from "@/features/mail/schemas/compose-form";
import type { ComposeLimits } from "@/features/mail/schemas/compose-input-limits";
import { fieldLength } from "@/lib/field-length";

/** What opens the composer: empty, or filled for a reply, a forward or a stored draft. */
export interface ComposeInitial extends ComposeFormValues {
	readonly draftId?: string | undefined;
	readonly inReplyTo?: string | undefined;
	readonly references?: string[] | undefined;
	/** The message a reply or a forward came from, to be marked once this one is sent. */
	readonly origin?: ComposeOrigin | undefined;
	readonly attachments?: ComposeAttachment[] | undefined;
}

/**
 * The composer: recipients, subject, body, attachments, and the three ways out
 * (save draft, send, discard). The form checks sizes and reads the recipients
 * (naming the pieces that are not addresses) as fail-fast help; the route is the
 * gate and parses the structured message again. Saving replaces the previous
 * draft, so what is open is always the latest copy; sending that the server
 * refuses leaves the work as a draft and says why. It needs script: unlike
 * sign-in there is no form post to fall back to.
 *
 * The limits are the ones the mail server publishes, given by the page: the
 * browser's attributes, the form's schema and the route all hold the same
 * numbers.
 */
export function ComposeForm({
	initial,
	limits,
}: {
	initial: ComposeInitial;
	limits: ComposeLimits;
}) {
	const t = useTranslations("mail");
	const { submit, pending, outcome } = useComposeSubmit(limits);
	const [draftId, setDraftId] = useState(initial.draftId);
	const [attachments, setAttachments] = useState<ComposeAttachment[]>(
		initial.attachments ?? [],
	);
	const [showCopies, setShowCopies] = useState(
		initial.cc !== "" || initial.bcc !== "",
	);
	const schema = useMemo(() => composeFormSchema(limits), [limits]);
	const form = useForm<ComposeFormValues>({
		resolver: zodResolver(schema),
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
			const { parsed, problems } = checkRecipients(values, op);
			for (const problem of problems) {
				form.setError(problem.field, {
					message:
						problem.kind === "invalid"
							? t("invalidRecipients", { list: problem.list })
							: t("needRecipient"),
				});
			}
			if (problems.length > 0) {
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
				origin: initial.origin,
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
	// A size message arrives as its key; a recipient message is already a sentence.
	const translate = (message: string) => fieldMessage(message, t);

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
				<RecipientInput
					control={form.control}
					name="to"
					label={t("fieldTo")}
					limits={limits}
					translate={translate}
				/>
				{showCopies ? (
					RECIPIENT_FIELDS.slice(1).map((name) => (
						<RecipientInput
							key={name}
							control={form.control}
							name={name as RecipientField}
							label={t(name === "cc" ? "fieldCc" : "fieldBcc")}
							limits={limits}
							translate={translate}
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
									maxLength={fieldLength(limits.maxSubject)}
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
								<MailTextarea
									{...field}
									rows={14}
									maxLength={fieldLength(limits.maxText)}
								/>
							</FormControl>
							<FormMessage render={translate} />
						</FormItem>
					)}
				/>
				<ComposeAttachments
					attachments={attachments}
					limits={limits}
					onChange={setAttachments}
				/>
				<ComposeActions
					pending={pending}
					onSaveDraft={() => void run("draft")()}
				/>
			</form>
		</Form>
	);
}
