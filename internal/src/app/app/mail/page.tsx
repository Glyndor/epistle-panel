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
import { parseMailParams } from "@/features/mail/schemas/mail-input";
import { requireSession } from "@/lib/auth/require-session";
import { cn } from "@/lib/class-names";

/**
 * The webmail: folders, message list and reader. The frame of the three panes
 * is sent at once; each pane then streams its own data behind a skeleton (the
 * folder tree, the open folder's page, the open message), read on the server
 * and owned by Query in the browser from then on. The view lives in the
 * address (`?box=&page=&filter=&q=&msg=`), each parameter checked on its own.
 * Below 1024 px the panes become one column: the list, or the reader when a
 * message is open, and the folders in a sheet.
 */
export default async function MailPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const t = await getTranslations("mail");
	const params = parseMailParams(await searchParams);
	const folders = (
		<Suspense fallback={<FolderSkeleton />}>
			<FoldersBoundary asked={params.box} />
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
					params.msg !== undefined && "max-lg:hidden",
				)}
			>
				<div className="flex items-center gap-2 p-2 lg:hidden">
					<WriteLink />
					<FolderSheet>{folders}</FolderSheet>
				</div>
				<Suspense fallback={<ListPaneSkeleton />}>
					<ListBoundary
						asked={params.box}
						page={params.page}
						filter={params.filter}
						q={params.q}
						selectedId={params.msg}
					/>
				</Suspense>
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
					<Suspense key={params.msg} fallback={<ReaderSkeleton />}>
						<ReaderBoundary
							id={params.msg}
							asked={params.box}
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
