import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { getQueue } from "@/lib/api/client";
import { logApiFailure } from "@/lib/api/log-failure";
import type { QueuePage as QueuePageData } from "@/lib/api/schemas";
import { requireSession } from "@/lib/auth/require-session";
import { RemoveButton } from "./_components/remove-button";
import { parseCursor } from "./_params/cursor";

async function loadQueue(cursor?: string): Promise<QueuePageData | null> {
	try {
		return await getQueue(cursor ? { cursor } : undefined);
	} catch (error) {
		logApiFailure("queue fetch", error);
		return null;
	}
}

export default async function QueuePage({
	searchParams,
}: {
	searchParams: Promise<{ cursor?: string | string[] }>;
}) {
	await requireSession();
	const t = await getTranslations("queue");
	const { cursor } = await searchParams;
	const page = await loadQueue(parseCursor(cursor));

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			{page === null ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : page.entries.length === 0 ? (
				<p className="text-muted-foreground">{t("empty")}</p>
			) : (
				<>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead scope="col">{t("from")}</TableHead>
								<TableHead scope="col">{t("to")}</TableHead>
								<TableHead scope="col" className="text-right">
									<span className="sr-only">
										{t("actions")}
									</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{page.entries.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell className="break-all font-mono">
										{entry.reverse_path || "<>"}
									</TableCell>
									<TableCell className="break-all text-muted-foreground">
										{entry.recipients.join(", ")}
									</TableCell>
									<TableCell className="text-right">
										<RemoveButton
											id={entry.id}
											recipients={entry.recipients.join(
												", ",
											)}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{page.next_cursor && (
						<Button asChild variant="link" className="self-start">
							<a
								href={`/queue?cursor=${encodeURIComponent(page.next_cursor)}`}
							>
								{t("next")}
							</a>
						</Button>
					)}
				</>
			)}
		</>
	);
}
