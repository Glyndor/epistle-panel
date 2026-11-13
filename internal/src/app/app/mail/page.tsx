import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { FolderPane } from "@/features/mail/components/folder-pane";
import { FolderSheet } from "@/features/mail/components/folder-sheet";
import { ListToolbar } from "@/features/mail/components/list-toolbar";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { MessageList } from "@/features/mail/components/message-list";
import { MessageReader } from "@/features/mail/components/message-reader";
import { ShortcutsHelp } from "@/features/mail/components/shortcuts-help";
import { WriteLink } from "@/features/mail/components/write-link";
import { currentMailSession } from "@/features/mail/jmap/credentials";
import { loadMailboxes } from "@/features/mail/queries/load-mailboxes";
import { loadMessage } from "@/features/mail/queries/load-message";
import { loadMessageList } from "@/features/mail/queries/load-message-list";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import {
	mailboxesQueryOptions,
	messageListQueryOptions,
	messageQueryOptions,
} from "@/features/mail/queries/mail-query-options";
import { parseMailParams } from "@/features/mail/schemas/mail-input";
import type { MailboxView } from "@/features/mail/schemas/mail-view";
import { requireSession } from "@/lib/auth/require-session";
import { cn } from "@/lib/class-names";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The folder shown when the address names none and the server has no mailbox with the inbox role. */
const FALLBACK_BOX = "INBOX";

/**
 * The webmail: folders, message list and reader. The folder tree, the open
 * folder's page and the open message are prefetched on the server and then
 * owned by Query in the browser. The view lives in the address
 * (`?box=&page=&filter=&q=&msg=`), each parameter checked on its own. Below
 * 1024 px the panes become one column: the list, or the reader when a message
 * is open, and the folders in a sheet.
 */
export default async function MailPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const t = await getTranslations("mail");
	const params = parseMailParams(await searchParams);
	const client = getServerQueryClient();
	const session = await currentMailSession();

	let box = params.box ?? FALLBACK_BOX;
	if (session !== null) {
		await prefetch(
			client,
			mailboxesQueryOptions(() => loadMailboxes(session)),
			"mail mailboxes",
		);
		const boxes = client.getQueryData<MailboxView[]>(mailKeys.mailboxes);
		box = params.box ?? boxes?.find((b) => b.role === "inbox")?.id ?? box;
		const view = {
			box,
			page: params.page,
			filter: params.filter,
			q: params.q,
		};
		await prefetch(
			client,
			messageListQueryOptions(view, (input) =>
				loadMessageList(session, input),
			),
			"mail list",
		);
		if (params.msg !== undefined) {
			await prefetch(
				client,
				messageQueryOptions(params.msg, (id) =>
					loadMessage(session, id),
				),
				"mail message",
			);
		}
	}
	const view = { box, page: params.page, filter: params.filter, q: params.q };

	return (
		<HydrationBoundary state={dehydrate(client)}>
			<div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2 p-2 lg:grid-cols-[14rem_minmax(18rem,26rem)_minmax(0,1fr)]">
				<div className="relative hidden min-h-0 overflow-y-auto rounded-2xl bg-background lg:block">
					<div className="p-2">
						<WriteLink />
					</div>
					<FolderPane activeId={box} />
				</div>
				<section
					aria-label={t("listLabel")}
					className={cn(
						"flex min-h-0 flex-col rounded-2xl bg-background",
						params.msg !== undefined && "max-lg:hidden",
					)}
				>
					<div className="flex items-center gap-2 p-2 lg:hidden">
						<WriteLink />
						<FolderSheet>
							<FolderPane activeId={box} />
						</FolderSheet>
					</div>
					<ListToolbar
						box={box}
						filter={params.filter}
						q={params.q}
					/>
					<div className="relative min-h-0 flex-1 overflow-y-auto">
						<MessageList view={view} selectedId={params.msg} />
					</div>
					<ShortcutsHelp />
				</section>
				<section
					aria-label={t("readerLabel")}
					className={cn(
						"relative min-h-0 overflow-y-auto rounded-2xl bg-background",
						params.msg === undefined && "max-lg:hidden",
					)}
				>
					{params.msg !== undefined ? (
						<MessageReader
							key={params.msg}
							id={params.msg}
							view={view}
						/>
					) : (
						<MailNotice tone="empty">{t("readerEmpty")}</MailNotice>
					)}
				</section>
			</div>
		</HydrationBoundary>
	);
}
