"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { getMessageAction } from "@/features/mail/actions/get-message";
import { AttachmentList } from "@/features/mail/components/attachment-list";
import { BodyView } from "@/features/mail/components/body-view";
import { HeadersDisclosure } from "@/features/mail/components/headers-disclosure";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { ReaderHeader } from "@/features/mail/components/reader-header";
import { ReaderSkeleton } from "@/features/mail/components/reader-skeleton";
import { ReaderToolbar } from "@/features/mail/components/reader-toolbar";
import { mailHref } from "@/features/mail/links/mail-href";
import {
	mailboxesQueryOptions,
	messageQueryOptions,
} from "@/features/mail/queries/mail-query-options";
import type { ListFilter } from "@/features/mail/schemas/mail-input";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());
const fetchMessage = async (id: string) =>
	unwrap(await getMessageAction({ id }));

/** Whether the reader is the only pane in view, so it must take the focus the list has lost. */
function readerIsAlone(): boolean {
	return window.matchMedia("(max-width: 1023px)").matches;
}

/**
 * The open message: headers, attachments, body and the full header list. On a
 * narrow screen the reader replaces the list, so it takes the focus when it
 * opens and offers a link back; on a wide one the list keeps the focus, so
 * the keyboard shortcuts can carry on. Every state has its own text: waiting,
 * unreachable (with a retry) and a message that no longer exists.
 */
export function MessageReader({
	id,
	view,
}: {
	id: string;
	view: { box: string; page: number; filter: ListFilter; q: string };
}) {
	const t = useTranslations("mail");
	const headingId = useId();
	const backLink = useRef<HTMLAnchorElement>(null);
	const { data, isPending, isError, refetch, isFetching } = useQuery(
		messageQueryOptions(id, fetchMessage),
	);

	const mailboxes = useQuery(mailboxesQueryOptions(fetchMailboxes)).data;
	const roleOf = (boxId: string | null) =>
		mailboxes?.find((box) => box.id === boxId)?.role;

	useEffect(() => {
		if (data && readerIsAlone()) {
			document.getElementById(headingId)?.focus();
		}
	}, [data, headingId]);

	const back = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="m-2 self-start lg:hidden"
		>
			<Link
				ref={backLink}
				href={mailHref(view)}
				scroll={false}
				data-mail-back=""
			>
				<ArrowLeftIcon aria-hidden="true" />
				{t("back")}
			</Link>
		</Button>
	);

	if (isPending) {
		return <ReaderSkeleton>{back}</ReaderSkeleton>;
	}
	if (isError) {
		return (
			<div className="flex flex-col">
				{back}
				<MailNotice
					tone="error"
					action={
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isFetching}
							onClick={() => void refetch()}
						>
							{t("retry")}
						</Button>
					}
				>
					{t("unavailable")}
				</MailNotice>
			</div>
		);
	}
	if (data === null || data === undefined) {
		return (
			<div className="flex flex-col">
				{back}
				<MailNotice tone="empty">{t("readerNotFound")}</MailNotice>
			</div>
		);
	}
	return (
		<article aria-labelledby={headingId} className="flex flex-col">
			{back}
			<ReaderToolbar
				message={data}
				onLeft={() => backLink.current?.click()}
				inTrash={roleOf(data.mailboxId) === "trash"}
				inDrafts={roleOf(data.mailboxId) === "drafts"}
			/>
			<ReaderHeader message={data} headingId={headingId} />
			<AttachmentList
				messageId={data.id}
				attachments={data.attachments}
			/>
			<BodyView key={data.id} message={data} />
			<HeadersDisclosure headers={data.headers} />
		</article>
	);
}
