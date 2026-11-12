import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getAccounts } from "@/lib/api/client";
import { logApiFailure } from "@/lib/api/log-failure";
import type { Accounts } from "@/lib/api/schemas";
import { requireSession } from "@/lib/auth/require-session";

async function loadAccounts(): Promise<Accounts["accounts"] | null> {
	try {
		return (await getAccounts()).accounts;
	} catch (error) {
		logApiFailure("accounts fetch", error);
		return null;
	}
}

export default async function AccountsPage() {
	await requireSession();
	const t = await getTranslations("accounts");
	const accounts = await loadAccounts();

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			{accounts === null ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : accounts.length === 0 ? (
				<p className="text-muted-foreground">{t("empty")}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">{t("name")}</TableHead>
							<TableHead scope="col">{t("addresses")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{accounts.map((account) => (
							<TableRow key={account.name}>
								<TableCell className="break-all font-semibold">
									{account.name}
								</TableCell>
								<TableCell className="break-all font-mono text-muted-foreground">
									{account.addresses.join(", ")}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</>
	);
}
