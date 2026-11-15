import { PenLineIcon } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SidebarGroup } from "@/components/ui/sidebar/group";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { DayPickerNav } from "@/features/mail/components/day-picker-nav";
import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { FoldersBoundary } from "@/features/mail/components/folders-boundary";
import { LabelsNav } from "@/features/mail/components/labels-nav";
import { firstDayOfWeek } from "@/features/mail/day-picker/week-start";
import { composeHref } from "@/features/mail/links/mail-href";
import type { TimeZone } from "@/features/time-zone/config/zones";
import { dayInZone } from "@/features/time-zone/format/day";

/**
 * The navigation of the mail area's sidebar: the way into the composer, then
 * the account's folders, which stream in behind their skeleton, the calendar
 * that lists the messages of a day, and the labels of the latest messages, which
 * the browser fills from the lists it loads (they are not in the page the
 * server sends). Collapsed to icons the composer is its icon with a tooltip,
 * like every other entry, and the calendar is not drawn.
 *
 * The calendar's first paint is made here, with what only the server knows
 * for certain: today in the person's zone and the day their language starts
 * the week on. The browser takes the same values, so nothing moves on
 * hydration.
 */
export async function MailNav({
	foldersOpen = true,
	timeZone,
}: {
	/** Whether the folders start open, as the layout read it: their placeholder is drawn the same way. */
	foldersOpen?: boolean;
	/** The zone the person reads dates in: the calendar's today is the day it is there. */
	timeZone: TimeZone;
}) {
	const t = await getTranslations("mail");
	const locale = await getLocale();

	return (
		<>
			<SidebarGroup>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							tooltip={t("compose")}
							className="bg-primary font-medium text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus-visible:outline-offset-2 active:bg-primary/80"
						>
							<Link href={composeHref()}>
								<PenLineIcon aria-hidden="true" />
								<span>{t("compose")}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
			<Suspense fallback={<FolderSkeleton open={foldersOpen} />}>
				<FoldersBoundary />
			</Suspense>
			<DayPickerNav
				today={dayInZone(new Date(), timeZone)}
				timeZone={timeZone}
				weekStartsOn={firstDayOfWeek(locale)}
			/>
			<LabelsNav />
		</>
	);
}
