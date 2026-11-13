"use client";

import { MoreHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAccountDialog } from "@/features/accounts/components/delete-account-dialog";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { isAccountName } from "@/lib/api/account-name-pattern";

/**
 * What can be done with one account, in a menu at the end of its row: open
 * it, and delete it when the API manages it. An account declared in the
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
					<Button
						variant="ghost"
						size="icon"
						aria-label={t("actionsFor", { name: row.name })}
					>
						<MoreHorizontalIcon aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" container={main}>
					{named ? (
						<DropdownMenuItem asChild>
							<Link href={routes.accountDetail(row.name)}>
								{t("open")}
							</Link>
						</DropdownMenuItem>
					) : null}
					{named && row.dynamic ? (
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => setDeleting(true)}
						>
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
				/>
			) : null}
		</>
	);
}
