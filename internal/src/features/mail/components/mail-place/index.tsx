import "server-only";

import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { FolderSheet } from "@/features/mail/components/folder-sheet";
import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { FoldersBoundary } from "@/features/mail/components/folders-boundary";
import { ListBoundary } from "@/features/mail/components/list-boundary";
import { ListPaneSkeleton } from "@/features/mail/components/list-skeleton";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { ReaderBoundary } from "@/features/mail/components/reader-boundary";
import { ReaderSkeleton } from "@/features/mail/components/reader-skeleton";
import { ShortcutsHelp } from "@/features/mail/components/shortcuts-help";
import { WriteLink } from "@/features/mail/components/write-link";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import { parseListParams } from "@/features/mail/schemas/mail-input";
import { requireSession } from "@/lib/auth/require-session";
import { cn } from "@/lib/class-names";

/**
 * A folder of the webmail as a page: its folders, its message list and the
 * reader. The folder is the page's path and so is the open message; what
 * narrows the list (`?page=&filter=&q=`) is read here, each parameter checked
 * on its own. The frame of the three panes is sent at once; each pane then
 * streams its own data behind a skeleton, read on the server and owned by
 * Query in the browser from then on. Below 1024 px the panes become one
 * column: the list, or the reader when a message is open, and the folders in
 * a sheet.
 */
export async function MailPlace({
	place,
	message,
	searchParams,
}: {
	place: PlaceRef;
	/** The open message, already checked to be an id. */
	message: string | undefined;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const t = await getTranslations("mail");
	const params = parseListParams(await searchParams);
	const folders = (
		<Suspense fallback={<FolderSkeleton />}>
			<FoldersBoundary place={place} />
		</Suspense>
	);

	return (
		<div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2 p-2 lg:grid-cols-[14rem_minmax(18rem,26rem)_minmax(0,1fr)]">
			<div className="relative hidden min-h-0 overflow-y-auto rounded-2xl bg-background lg:block">
				<div className="p-2">
					<WriteLink />
				</div>
				{folders}
			</div>
			<section
				aria-label={t("listLabel")}
				className={cn(
					"flex min-h-0 flex-col rounded-2xl bg-background",
					message !== undefined && "max-lg:hidden",
				)}
			>
				<div className="flex items-center gap-2 p-2 lg:hidden">
					<WriteLink />
					<FolderSheet>{folders}</FolderSheet>
				</div>
				<Suspense fallback={<ListPaneSkeleton />}>
					<ListBoundary
						place={place}
						page={params.page}
						filter={params.filter}
						q={params.q}
						selectedId={message}
					/>
				</Suspense>
				<ShortcutsHelp />
			</section>
			<section
				aria-label={t("readerLabel")}
				className={cn(
					"relative min-h-0 overflow-y-auto rounded-2xl bg-background",
					message === undefined && "max-lg:hidden",
				)}
			>
				{message !== undefined ? (
					<Suspense key={message} fallback={<ReaderSkeleton />}>
						<ReaderBoundary
							id={message}
							place={place}
							page={params.page}
							filter={params.filter}
							q={params.q}
						/>
					</Suspense>
				) : (
					<MailNotice tone="empty">{t("readerEmpty")}</MailNotice>
				)}
			</section>
		</div>
	);
}
