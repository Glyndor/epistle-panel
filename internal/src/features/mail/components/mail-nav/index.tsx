import { PenLineIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { SidebarGroup } from "@/components/ui/sidebar/group";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { FolderSkeleton } from "@/features/mail/components/folder-skeleton";
import { FoldersBoundary } from "@/features/mail/components/folders-boundary";
import { composeHref } from "@/features/mail/links/mail-href";

/**
 * The navigation of the mail area's sidebar: the way into the composer, then
 * the account's folders, which stream in behind their skeleton. Collapsed to
 * icons the composer is its icon with a tooltip, like every other entry.
 */
export async function MailNav() {
	const t = await getTranslations("mail");

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
			<Suspense fallback={<FolderSkeleton />}>
				<FoldersBoundary />
			</Suspense>
		</>
	);
}
