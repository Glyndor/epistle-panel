"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
	startTransition,
	useActionState,
	useEffect,
	useRef,
	useState,
} from "react";
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
import { login } from "@/features/auth/actions/login";
import {
	isLoginErrorKey,
	LOGIN_NAME_MAX,
	LOGIN_PASSWORD_MAX,
	type LoginInput,
	loginSchema,
} from "@/features/auth/schemas/login";
import { INITIAL_LOGIN_STATE } from "@/features/auth/schemas/login-state";

/**
 * The admin sign-in form, on react-hook-form with the same schema the Server
 * Action enforces. Validation here is fail-fast help (it saves a request and
 * names the field); the action stays the gate and answers every failure with the
 * one generic message.
 *
 * It is still a real `<form action>`: without script the browser posts the
 * fields and the action runs, so sign-in does not depend on hydration. With
 * script, the submit handler validates first and calls the same action only when
 * the schema accepts, and the browser's own validation bubbles are switched off
 * (`noValidate`, set after hydration) so the messages next to the fields show.
 *
 * Re-renders: each field subscribes to its own state only (`useFormState({ name
 * })` inside the field), mode is `onSubmit` with `onChange` revalidation, so a
 * field stays quiet until the first submit and then corrects itself as you type.
 */
export function LoginForm() {
	const t = useTranslations("auth");
	const [state, formAction, pending] = useActionState(
		login,
		INITIAL_LOGIN_STATE,
	);
	const form = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
		defaultValues: { name: "", password: "" },
		mode: "onSubmit",
		reValidateMode: "onChange",
	});
	const formElement = useRef<HTMLFormElement>(null);
	const [hydrated, setHydrated] = useState(false);
	const rejected = state.outcome !== "idle";

	useEffect(() => setHydrated(true), []);

	// After a refusal, keep the name, clear the password and put the cursor there.
	// `state` is a new object for every answer, so a second refusal runs this too.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `form` is stable
	useEffect(() => {
		if (state.outcome !== "idle") {
			form.resetField("password");
			form.setFocus("password");
		}
	}, [state]);

	const submit = form.handleSubmit(() => {
		const data = formElement.current
			? new FormData(formElement.current)
			: new FormData();
		startTransition(() => formAction(data));
	});

	const message = (key: string) => (isLoginErrorKey(key) ? t(key) : key);
	const serverError = rejected
		? ({ "aria-invalid": true, "aria-describedby": "login-error" } as const)
		: {};

	return (
		<Form {...form}>
			<form
				ref={formElement}
				action={formAction}
				onSubmit={submit}
				noValidate={hydrated}
				className="flex flex-col gap-4"
			>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("name")}</FormLabel>
							<FormControl {...serverError}>
								<Input
									{...field}
									type="text"
									autoComplete="username"
									autoCapitalize="none"
									spellCheck={false}
									required
									maxLength={LOGIN_NAME_MAX}
								/>
							</FormControl>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name="password"
					render={({ field }) => (
						<FormItem>
							<FormLabel>{t("password")}</FormLabel>
							<FormControl {...serverError}>
								<Input
									{...field}
									type="password"
									autoComplete="current-password"
									required
									maxLength={LOGIN_PASSWORD_MAX}
								/>
							</FormControl>
							<FormMessage render={message} />
						</FormItem>
					)}
				/>
				{rejected ? (
					<Alert id="login-error" variant="destructive">
						<AlertDescription>{t("error")}</AlertDescription>
					</Alert>
				) : null}
				<Button type="submit" disabled={pending} aria-busy={pending}>
					{pending ? t("pending") : t("submit")}
				</Button>
			</form>
		</Form>
	);
}
