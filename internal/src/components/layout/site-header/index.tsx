import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/layout/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import type { SessionRole } from "@/lib/auth/session";
import { cn } from "@/lib/class-names";

/**
 * The bar above the content, the same in the administration and in the mail:
 * the sidebar toggle, the trail to the current page, a cell in the middle that
 * an area keeps for its search and, at the far end, the theme button and the
 * profile menu. It is a surface of its own (`bg-header`) and does not move
 * when the content scrolls. The page's own heading stays in the page.
 *
 * It is one row of one least height in both areas. The trail never takes a
 * second line: its steps are cut short where the bar has no room. What can
 * wrap is the far end, on a narrow window without script, where the plain
 * link and form of `HeaderActions` are shown as well, so the page is not
 * pushed sideways.
 *
 * From 1024 px up, in the area that has a search, the bar is three columns:
 * the trail, the search in the middle and the far end. The two outer columns
 * are the same, so the search sits in the middle of the bar and not beside
 * it. The area with no search keeps the row it had.
 *
 * Below 1024 px the cell holds only what the area draws there, which in the
 * mail area is the icon that opens the search over the bar.
 */
export async function SiteHeader({
	trail,
	search,
	reserveSearch = false,
	user,
	adminHref,
}: {
	/** The trail to the current page. */
	trail?: React.ReactNode;
	/** The search of the area. */
	search?: React.ReactNode;
	/** Keep the middle of the bar for the search, even before there is one. */
	reserveSearch?: boolean;
	/** The account of the session, as the layout read it. */
	user: { name: string; role: SessionRole };
	/** The address of the administration, for an admin session only. */
	adminHref?: string | undefined;
}) {
	const t = await getTranslations("nav");

	return (
		<header
			className={cn(
				"relative flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 bg-header px-2 py-1 pointer-coarse:min-h-14 md:px-4",
				reserveSearch &&
					"lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)_minmax(0,1fr)]",
			)}
		>
			<div className="flex min-w-0 flex-1 basis-0 items-center gap-x-2 lg:col-start-1 lg:row-start-1">
				<SidebarTrigger
					label={t("toggle")}
					shortcut={t("toggleShortcut")}
				/>
				<div
					data-slot="header-trail"
					className="flex min-w-0 flex-1 basis-0"
				>
					{trail}
				</div>
			</div>
			{reserveSearch ? (
				<div
					data-slot="header-search"
					// From 1024 px up the cell holds the search, wide. Below it
					// the cell holds only the icon that opens the search over
					// the bar, and the trail keeps the room.
					className="min-w-0 max-lg:flex-none max-lg:w-auto lg:col-start-2 lg:row-start-1"
				>
					{search}
				</div>
			) : null}
			<div className="lg:col-start-3 lg:row-start-1 lg:justify-self-end">
				<HeaderActions
					name={user.name}
					sessionRole={user.role}
					adminHref={adminHref}
				/>
			</div>
		</header>
	);
}
