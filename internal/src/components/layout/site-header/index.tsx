import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/layout/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import type { SessionRole } from "@/lib/auth/session";

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
 * The middle cell is drawn from 1024 px, with twice the trail's share of the
 * room, when the area says it has a search (`reserveSearch`), also while there
 * is nothing in it yet: the trail then never grows into the place the search
 * will take.
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
		<header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 bg-header px-2 py-1 pointer-coarse:min-h-14 md:px-4">
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
			{reserveSearch ? (
				<div
					data-slot="header-search"
					className="min-w-0 flex-2 basis-0 max-lg:hidden"
				>
					{search}
				</div>
			) : null}
			<HeaderActions
				name={user.name}
				sessionRole={user.role}
				adminHref={adminHref}
			/>
		</header>
	);
}
