import "server-only";

import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ListBoundary } from "@/features/mail/components/list-boundary";
import { ListPaneSkeleton } from "@/features/mail/components/list-skeleton";
import { MailNotice } from "@/features/mail/components/mail-notice";
import { folderName } from "@/features/mail/components/mail-place/place-name";
import { ReaderBoundary } from "@/features/mail/components/reader-boundary";
import { ReaderSkeleton } from "@/features/mail/components/reader-skeleton";
import { ShortcutsHelp } from "@/features/mail/components/shortcuts-help";
import { WriteLink } from "@/features/mail/components/write-link";
import { readListDensity } from "@/features/mail/queries/list-density";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import { parseListParams } from "@/features/mail/schemas/mail-input";
import { requireSession } from "@/lib/auth/require-session";
import { cn } from "@/lib/class-names";

/**
 * A folder of the webmail as a page: its message list and the reader, two
 * panels raised off the canvas, each scrolling on its own. The folders are in
 * the sidebar of the area. The folder is the page's path and so is the open
 * message; what narrows the list (`?page=&filter=&q=`) is read here, each
 * parameter checked on its own. The frame of the panes is sent at once; each
 * pane then streams its own data behind a skeleton, read on the server and
 * owned by Query in the browser from then on. Below 1024 px the panes become
 * one column: the list, or the reader when a message is open. The list pane
 * carries the density the reader chose, from its cookie, for the rows and
 * their skeleton to read.
 *
 * The page's one `h1` names the folder. It is not drawn: the trail of the
 * header already shows where the person is.
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
	const [params, density] = await Promise.all([
		searchParams.then(parseListParams),
		readListDensity(),
	]);
	const name =
		"role" in place ? t(`role_${place.role}`) : folderName(place.box);

	return (
		<div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-2 p-2 lg:grid-cols-[minmax(18rem,26rem)_minmax(0,1fr)]">
			<h1 className="sr-only">
				{"role" in place ? name : <bdi>{name || t("heading")}</bdi>}
			</h1>
			<section
				aria-label={t("listLabel")}
				data-density={density}
				className={cn(
					"group/list flex min-h-0 flex-col rounded-2xl bg-surface",
					message !== undefined && "max-lg:hidden",
				)}
			>
				{/* Below 768 px the sidebar is a sheet, so the way into the composer is kept in reach here. */}
				<div className="flex items-center gap-2 p-2 md:hidden">
					<WriteLink />
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
					"relative min-h-0 overflow-y-auto rounded-2xl bg-surface",
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
