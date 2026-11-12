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
import { getDomains } from "@/lib/api/client";
import { logApiFailure } from "@/lib/api/log-failure";
import { requireSession } from "@/lib/auth/require-session";

async function loadDomains(): Promise<string[] | null> {
	try {
		return (await getDomains()).domains;
	} catch (error) {
		logApiFailure("domains fetch", error);
		return null;
	}
}

export default async function DomainsPage() {
	await requireSession();
	const t = await getTranslations("domains");
	const domains = await loadDomains();

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			{domains === null ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : domains.length === 0 ? (
				<p className="text-muted-foreground">{t("empty")}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">{t("name")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{domains.map((domain) => (
							<TableRow key={domain}>
								<TableCell className="break-all font-mono">
									{domain}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</>
	);
}
