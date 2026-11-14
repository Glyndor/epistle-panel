import { PaperclipIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { attachmentHref } from "@/features/mail/links/mail-href";
import type { AttachmentView } from "@/features/mail/schemas/mail-view";

/** The size in kilobytes, or megabytes from a thousand of them, in the reader's number format. */
function useSize() {
	const format = useFormatter();
	return (bytes: number) =>
		bytes >= 1_000_000
			? `${format.number(Math.round(bytes / 100_000) / 10)} MB`
			: `${format.number(Math.max(1, Math.round(bytes / 1000)))} KB`;
}

/**
 * The attachments of a message, each a download link to the panel's own route
 * (never a link to the mail server). The name is the cleaned one, the type
 * what the message says it is; opening the link saves the file, it does not
 * show it.
 */
export function AttachmentList({
	messageId,
	attachments,
}: {
	messageId: string;
	attachments: readonly AttachmentView[];
}) {
	const t = useTranslations("mail");
	const size = useSize();

	if (attachments.length === 0) {
		return null;
	}
	return (
		<section aria-label={t("attachmentsLabel")} className="p-4">
			<h3 className="mb-2 font-medium text-sm">
				{t("attachmentCount", { count: attachments.length })}
			</h3>
			<ul className="flex flex-wrap gap-2">
				{attachments.map((attachment) => (
					<li key={attachment.part}>
						<a
							href={attachmentHref(messageId, attachment.part)}
							aria-label={t("download", {
								name: attachment.name,
							})}
							className="inline-flex min-h-8 max-w-full items-center gap-2 rounded-lg bg-muted px-3 py-1 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
						>
							<PaperclipIcon
								aria-hidden="true"
								className="size-4 shrink-0"
							/>
							<bdi className="truncate">{attachment.name}</bdi>
							<span className="shrink-0 text-muted-foreground text-xs">
								{size(attachment.size)}
							</span>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}
