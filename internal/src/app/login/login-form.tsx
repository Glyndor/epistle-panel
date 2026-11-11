"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { type LoginState, login } from "@/lib/auth/actions";

const INITIAL: LoginState = { error: false };

/** The admin login form; the interactive leaf of the login page. */
export function LoginForm() {
	const t = useTranslations("auth");
	const [state, action, pending] = useActionState(login, INITIAL);

	return (
		<form action={action} className="flex flex-col gap-4">
			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium text-zinc-700 dark:text-zinc-300">
					{t("name")}
				</span>
				<input
					name="name"
					type="text"
					autoComplete="username"
					required
					className="min-h-11 rounded border border-zinc-300 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
				/>
			</label>
			<label className="flex flex-col gap-1 text-sm">
				<span className="font-medium text-zinc-700 dark:text-zinc-300">
					{t("password")}
				</span>
				<input
					name="password"
					type="password"
					autoComplete="current-password"
					required
					className="min-h-11 rounded border border-zinc-300 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
				/>
			</label>
			{state.error ? (
				<p
					role="alert"
					className="text-red-600 text-sm dark:text-red-400"
				>
					{t("error")}
				</p>
			) : null}
			<button
				type="submit"
				disabled={pending}
				className="min-h-11 rounded bg-zinc-900 px-4 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
			>
				{t("submit")}
			</button>
		</form>
	);
}
