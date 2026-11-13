"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import { DISPLAY_NAME_MAX } from "@/features/account-detail/schemas/display-name-form";
import {
	PASSWORD_MAX,
	PASSWORD_MIN,
} from "@/features/account-detail/schemas/password-form";
import { createAccountAction } from "@/features/accounts/actions/create-account";
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import {
	ACCOUNT_NAME_HTML_PATTERN,
	ACCOUNT_NAME_MAX,
	ADDRESSES_MAX,
	CREATE_ACCOUNT_ERROR_KEYS,
	type CreateAccountFormInput,
	createAccountFormSchema,
	splitAddresses,
} from "@/features/accounts/schemas/account-create-form";
import { isOneOf } from "@/lib/is-one-of";
import { ActionError } from "@/lib/query/action-result";

/** What the mail server refused, as the message key that says it. */
type Refusal = "createRefused" | "createCap";

/**
 * The new-account form. Each field is checked three times: by the browser
 * (`required`, `pattern`, the length attributes), by the schema here as the
 * person types after a first attempt, and by the Server Action, which parses
 * the same rules again before the mail server decides what only it knows. The
 * password goes straight from the field to the action and the field is emptied
 * as soon as the answer is in. `onDone` runs once the account exists.
 */
export function CreateAccountForm({ onDone }: { onDone: () => void }) {
	const t = useTranslations("accounts");
	const client = useQueryClient();
	const [refusal, setRefusal] = useState<Refusal | null>(null);
	const form = useForm<CreateAccountFormInput>({
		resolver: zodResolver(createAccountFormSchema),
		defaultValues: {
			name: "",
			displayName: "",
			addresses: "",
			password: "",
		},
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const message = (key: string) =>
		isOneOf(CREATE_ACCOUNT_ERROR_KEYS, key)
			? t(key, { max: ADDRESSES_MAX })
			: key;

	const submit = form.handleSubmit(async (values) => {
		setRefusal(null);
		try {
			const result = await createAccountAction({
				name: values.name,
				displayName: values.displayName,
				addresses: splitAddresses(values.addresses),
				password: values.password,
			});
			form.resetField("password");
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
				return;
			}
			if (result.data.kind === "done") {
				toast.success(t("created", { name: result.data.value }));
				await client.invalidateQueries({ queryKey: accountsKeys.all });
				onDone();
				return;
			}
			setRefusal(
				result.data.kind === "conflict" ? "createCap" : "createRefused",
			);
		} catch (error) {
			form.resetField("password");
			reportFailure(error, t("unavailable"));
		}
	});
	const pending = form.formState.isSubmitting;

	return (
		<Form {...form}>
			<form onSubmit={submit} className="flex flex-col gap-4">
				{refusal === null ? null : (
					<Alert variant="destructive" role="alert">
						<AlertDescription>{t(refusal)}</AlertDescription>
					</Alert>
				)}
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem described>
							<FormLabel>{t("nameLabel")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									required
									maxLength={ACCOUNT_NAME_MAX}
									pattern={ACCOUNT_NAME_HTML_PATTERN}
									title={t("nameInvalid")}
									autoCapitalize="none"
									autoComplete="off"
									autoCorrect="off"
									spellCheck={false}
								/>
							</FormControl>
							<FormDescription>{t("nameHelp")}</FormDescription>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="displayName"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("displayNameLabel")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									maxLength={DISPLAY_NAME_MAX}
									autoComplete="off"
								/>
							</FormControl>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="addresses"
					render={({ field }) => (
						<FormItem described>
							<FormLabel>{t("addressesLabel")}</FormLabel>
							<FormControl>
								<Textarea
									{...field}
									required
									rows={3}
									autoCapitalize="none"
									autoComplete="off"
									autoCorrect="off"
									spellCheck={false}
									inputMode="email"
								/>
							</FormControl>
							<FormDescription>
								{t("addressesHelp")}
							</FormDescription>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem described>
							<FormLabel>{t("passwordLabel")}</FormLabel>
							<FormControl>
								<Input
									{...field}
									type="password"
									required
									minLength={PASSWORD_MIN}
									maxLength={PASSWORD_MAX}
									autoComplete="new-password"
								/>
							</FormControl>
							<FormDescription>
								{t("passwordHelp")}
							</FormDescription>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				<Button
					type="submit"
					className="self-end"
					disabled={pending}
					aria-busy={pending}
				>
					{pending ? t("createSubmitting") : t("createSubmit")}
				</Button>
			</form>
		</Form>
	);
}
