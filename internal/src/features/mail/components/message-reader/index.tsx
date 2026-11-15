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
import {
	handFocusToList,
	listMemory,
} from "@/features/mail/components/message-list/list-memory";
import { ReaderHeader } from "@/features/mail/components/reader-header";
import { ReaderSkeleton } from "@/features/mail/components/reader-skeleton";
import { ReaderToolbar } from "@/features/mail/components/reader-toolbar";
import type { RemoteImageMode } from "@/features/mail/config/remote-images";
import { type ListAddress, mailHref } from "@/features/mail/links/mail-href";
import { MAIL_REFRESH_MS } from "@/features/mail/queries/mail-query-keys";
import {
	mailboxesQueryOptions,
	messageQueryOptions,
} from "@/features/mail/queries/mail-query-options";
import { useRefreshInterval } from "@/features/refresh/components/refresh-provider";
import { unwrap } from "@/lib/query/action-result";

const fetchMailboxes = async () => unwrap(await getMailboxesAction());
const fetchMessage = async (id: string) =>
	unwrap(await getMessageAction({ id }));

/** Whether the reader is the only pane in view, so it must take the focus the list has lost. */
function readerIsAlone(): boolean {
	return window.matchMedia("(max-width: 1023px)").matches;
}

/**
 * Whether the focus is the reader's to take: on the page, or in the rows of
 * the list. Anywhere else the person put it there (the search field, a
 * dialog, the sidebar), and the keys typed there must stay text: with the
 * focus moved to the title they became shortcuts, and `s` starred the
 * message and `e` archived it. The search field goes with its page when a
 * message opens, which leaves the focus on the page while the person is
 * still typing: the list remembers that, and the title stays out of it.
 */
function focusIsFree(): boolean {
	const active = document.activeElement;
	return (
		listMemory.search === null &&
		(active === null ||
			active === document.body ||
			active.closest("[data-slot='message-list']") !== null)
	);
}

/**
 * Whether the focus is the reader's to give to the list: on the page, in the
 * reader (its link back is drawn in every state of it), or in the dialog
 * that asks before deleting for good, which is opened from the reader and
 * drawn outside it. Any other dialog or field is the person's.
 */
function focusIsOurs(reader: HTMLElement | null): boolean {
	const active = document.activeElement;
	return (
		listMemory.search === null &&
		(active === null ||
			active === document.body ||
			reader?.contains(active) === true ||
			active.closest("a[data-mail-back], [role='alertdialog']") !== null)
	);
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
export function MessageReader({
	id,
	view,
	remoteImagesMode = "ask",
}: {
	id: string;
	view: ListAddress;
	remoteImagesMode?: RemoteImageMode;
}) {
	const t = useTranslations("mail");
	const headingId = useId();
	const backLink = useRef<HTMLAnchorElement>(null);
	const article = useRef<HTMLElement>(null);
	const { data, isPending, isError, refetch, isFetching } = useQuery(
		messageQueryOptions(id, fetchMessage),
	);

	const refreshMs = useRefreshInterval(MAIL_REFRESH_MS);
	const mailboxes = useQuery(
		mailboxesQueryOptions(fetchMailboxes, refreshMs),
	).data;
	const roleOf = (boxId: string | null) =>
		mailboxes?.find((box) => box.id === boxId)?.role;

	const cameWithThePage = useCameWithThePage();
	const shown = data !== undefined && data !== null;
	useEffect(() => {
		if (shown && focusIsFree() && (!cameWithThePage || readerIsAlone())) {
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
				// Back at the list, the focus is on the row of this message,
				// or on the row after it when the message has left. The
				// link is followed by the person and by the reader itself.
				onClick={() => {
					if (focusIsOurs(article.current)) {
						handFocusToList(id);
					}
				}}
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
				// The reader goes with the message, through its own link.
				onLeft={() => backLink.current?.click()}
				inTrash={roleOf(data.mailboxId) === "trash"}
				inDrafts={roleOf(data.mailboxId) === "drafts"}
			/>
			<ReaderHeader message={data} headingId={headingId} />
			<AttachmentList
				messageId={data.id}
				attachments={data.attachments}
			/>
			<BodyView
				key={data.id}
				message={data}
				remoteImagesMode={remoteImagesMode}
			/>
			<HeadersDisclosure headers={data.headers} />
		</article>
	);
}
