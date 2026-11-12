"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { createMaskedAction } from "@/features/account-detail/actions/create-masked";
import { getMaskedAction } from "@/features/account-detail/actions/get-masked";
import { RemoveMaskedButton } from "@/features/account-detail/components/remove-masked-button";
import { SectionCard } from "@/features/account-detail/components/section-card";
import {
	accountDetailKeys,
	maskedQueryOptions,
} from "@/features/account-detail/queries/account-queries";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import {
	fromEpochSeconds,
	MOMENT_FORMAT,
} from "@/features/account-detail/queries/time-format";
import {
	MASKED_LABEL_ERROR_KEYS,
	MASKED_LABEL_MAX,
	type MaskedLabelFormInput,
	maskedLabelFormSchema,
} from "@/features/account-detail/schemas/masked-label-form";
import { isOneOf } from "@/lib/is-one-of";
import { unwrap } from "@/lib/query/action-result";

/**
 * The masked addresses of the account: the list with a remove control on each,
 * and a form that mints a new one from a label. The server picks the random
 * part, so the new address is only known from its answer.
 */
export function MaskedSection({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const format = useFormatter();
	const client = useQueryClient();
	const { data, isPending } = useQuery(
		maskedQueryOptions(name, async () =>
			unwrap(await getMaskedAction({ name })),
		),
	);
	const form = useForm<MaskedLabelFormInput>({
		resolver: zodResolver(maskedLabelFormSchema),
		defaultValues: { label: "" },
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const create = useMutation({
		mutationFn: async (label: string) =>
			unwrap(await createMaskedAction({ name, label })),
		onSuccess: (outcome) => {
			switch (outcome.kind) {
				case "done":
					toast.success(
						t("maskedCreated", { address: outcome.value.address }),
					);
					form.reset({ label: "" });
					break;
				case "conflict":
					form.setError("label", { message: "maskedLimit" });
					break;
				case "rejected":
					form.setError("label", { message: "maskedRefused" });
					break;
				case "notFound":
					toast.error(t("refusedGone"));
					break;
			}
		},
		onError: (error) => reportFailure(error, t("unavailable")),
		onSettled: () =>
			client.invalidateQueries({
				queryKey: accountDetailKeys.masked(name),
			}),
	});
	const message = (key: string) =>
		isOneOf(MASKED_LABEL_ERROR_KEYS, key) ? t(key) : key;
	const moment = (seconds: number) =>
		format.dateTime(fromEpochSeconds(seconds), MOMENT_FORMAT);

	return (
		<SectionCard
			id="masked"
			title={t("maskedTitle")}
			description={t("maskedHelp")}
		>
			{isPending ? (
				<Skeleton className="h-12" aria-busy="true" />
			) : data === undefined ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : data.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("maskedEmpty")}
				</p>
			) : (
				<ul className="flex flex-col divide-y">
					{data.map((row) => (
						<li
							key={row.address}
							className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
						>
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="break-all font-mono text-sm">
									{row.address}
								</span>
								<span className="text-muted-foreground text-xs">
									{row.label} ·{" "}
									{t("maskedMeta", {
										created: moment(row.createdAt),
										used:
											row.lastUsedAt === null
												? t("maskedNeverUsed")
												: t("maskedUsed", {
														date: moment(
															row.lastUsedAt,
														),
													}),
									})}
									{row.enabled
										? ""
										: ` · ${t("maskedDisabled")}`}
								</span>
							</div>
							{row.removable ? (
								<RemoveMaskedButton
									name={name}
									address={row.address}
								/>
							) : null}
						</li>
					))}
				</ul>
			)}
			<Form {...form}>
				<form
					onSubmit={form.handleSubmit((values) =>
						create.mutate(values.label),
					)}
					className="flex flex-col gap-4"
				>
					<FormField
						control={form.control}
						name="label"
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t("maskedLabelLabel")}</FormLabel>
								<FormControl>
									<Input
										{...field}
										type="text"
										autoComplete="off"
										spellCheck={false}
										maxLength={MASKED_LABEL_MAX}
									/>
								</FormControl>
								<FormMessage render={message} />
							</FormItem>
						)}
					/>
					<Button
						type="submit"
						className="self-start"
						disabled={create.isPending}
						aria-busy={create.isPending}
					>
						{create.isPending
							? t("maskedCreating")
							: t("maskedCreate")}
					</Button>
				</form>
			</Form>
		</SectionCard>
	);
}
