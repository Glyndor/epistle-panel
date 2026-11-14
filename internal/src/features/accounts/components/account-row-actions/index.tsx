"use client";

import { MoreHorizontalIcon, Trash2Icon, UserCogIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { DeleteAccountDialog } from "@/features/accounts/components/delete-account-dialog";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { isAccountName } from "@/lib/api/account-name-pattern";

/**
 * What can be done with one account, in a menu at the end of its row: open
 * it, and delete it when the API manages it. The menu's button is an icon
 * alone, so a tooltip names it; each action carries its icon. An account declared in the
 * configuration file says so in place of the delete action, since the API
 * cannot remove it. A name the pages would not accept gets no action that
 * would put it in an address or an API path.
 */
export function AccountRowActions({ row }: { row: AccountRow }) {
	const t = useTranslations("accounts");
	const routes = useAdminRoutes();
	const [deleting, setDeleting] = useState(false);
	// The page's `main`, found when the menu opens: the list is rendered there
	// so the table's scroll box does not clip it, and it stays inside a landmark.
	const [main, setMain] = useState<HTMLElement | null>(null);
	const named = isAccountName(row.name);
	/** The menu's button: where the focus returns when the delete dialog closes. */
	const trigger = useRef<HTMLButtonElement>(null);

	return (
		<>
			<DropdownMenu
				onOpenChange={(open) => {
					if (open) {
						setMain(document.getElementById("main-content"));
					}
				}}
			>
				<DropdownMenuTrigger asChild>
					<Tooltip
						label={t("actionsFor", { name: row.name })}
						align="end"
					>
						<Button
							ref={trigger}
							variant="ghost"
							size="icon"
							aria-label={t("actionsFor", { name: row.name })}
						>
							<MoreHorizontalIcon aria-hidden="true" />
						</Button>
					</Tooltip>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" container={main}>
					{named ? (
						<DropdownMenuItem asChild>
							<Link href={routes.accountDetail(row.name)}>
								<UserCogIcon aria-hidden="true" />
								{t("open")}
							</Link>
						</DropdownMenuItem>
					) : null}
					{named && row.dynamic ? (
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setDeleting(true)}
						>
							<Trash2Icon aria-hidden="true" />
							{t("delete")}
						</DropdownMenuItem>
					) : (
						<DropdownMenuLabel>
							{t("managedInFile")}
						</DropdownMenuLabel>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			{deleting ? (
				<DeleteAccountDialog
					name={row.name}
					open
					onOpenChange={setDeleting}
					returnFocus={trigger}
				/>
			) : null}
		</>
	);
}
