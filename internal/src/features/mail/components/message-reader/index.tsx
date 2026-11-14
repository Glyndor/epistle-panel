"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
	useEffect,
	useId,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import { getMailboxesAction } from "@/features/mail/actions/get-mailboxes";
import { getMessageAction } from "@/features/mail/actions/get-message";
import { AttachmentList } from "@/features/mail/components/attachment-list";
import { BodyView } from "@/features/mail/components/body-view";
import { HeadersDisclosure } from "@/features/mail/components/headers-disclosure";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { handFocusToList } from "@/features/mail/components/message-list/use-kept-focus";
import { ReaderHeader } from "@/features/mail/components/reader-header";
import { ReaderSkeleton } from "@/features/mail/components/reader-skeleton";
import { ReaderToolbar } from "@/features/mail/components/reader-toolbar";
import { type ListAddress, mailHref } from "@/features/mail/links/mail-href";
import {
	mailboxesQueryOptions,
	messageQueryOptions,
} from "@/features/mail/queries/mail-query-options";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());
const fetchMessage = async (id: string) =>
	unwrap(await getMessageAction({ id }));

/** Whether the reader is the only pane in view, so it must take the focus the list has lost. */
function readerIsAlone(): boolean {
	return window.matchMedia("(max-width: 1023px)").matches;
}

const never = () => () => {};

/**
 * Whether this reader came with the page, drawn first on the server, and not
 * from something the person did in the page (a press on a row, a key). React
 * answers the server's value only while it takes over the server's markup;
 * the first answer is kept, since the next render gets the browser's.
 */
function useCameWithThePage(): boolean {
	const takingOver = useSyncExternalStore(
		never,
		() => false,
		() => true,
	);
	const [cameWithThePage] = useState(takingOver);
	return cameWithThePage;
}

/**
 * The open message: headers, attachments, body and the full header list. When
 * the person opens a message (a press on its row, Enter, `j` or `k`), the
 * focus goes to its title at every width: it is where reading starts, and the
 * shortcuts listen on the page, so they carry on from there. Left on the row
 * it was lost to the page when the list was beside the reader. A message that
 * comes with the page takes the focus only where the reader is the one pane
 * in view, with a link back to the list. The title takes the focus once per
 * message, not again each time the message is read from the server. Every state has its own text: waiting,
 * unreachable (with a retry) and a message that no longer exists.
 */
export function MessageReader({ id, view }: { id: string; view: ListAddress }) {
	const t = useTranslations("mail");
	const headingId = useId();
	const backLink = useRef<HTMLAnchorElement>(null);
	const article = useRef<HTMLElement>(null);
	const { data, isPending, isError, refetch, isFetching } = useQuery(
		messageQueryOptions(id, fetchMessage),
	);

	const mailboxes = useQuery(mailboxesQueryOptions(fetchMailboxes)).data;
	const roleOf = (boxId: string | null) =>
		mailboxes?.find((box) => box.id === boxId)?.role;

	const cameWithThePage = useCameWithThePage();
	const shown = data !== undefined && data !== null;
	useEffect(() => {
		if (shown && (!cameWithThePage || readerIsAlone())) {
			document.getElementById(headingId)?.focus();
		}
	}, [shown, headingId, cameWithThePage]);

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
		<article
			ref={article}
			aria-labelledby={headingId}
			className="flex flex-col"
		>
			{back}
			<ReaderToolbar
				message={data}
				onLeft={() => {
					// The reader goes with the message: the focus, when it
					// is in here, is left to the list.
					if (article.current?.contains(document.activeElement)) {
						handFocusToList(id);
					}
					backLink.current?.click();
				}}
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
