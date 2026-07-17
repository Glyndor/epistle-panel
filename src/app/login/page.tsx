import { getTranslations } from "next-intl/server";

import { LoginForm } from "./login-form";

/** The admin login page — the only route reachable without a session. */
export default async function LoginPage() {
	const t = await getTranslations("auth");
	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-4"
		>
			<h1 className="font-semibold text-2xl text-zinc-900 dark:text-zinc-100">
				{t("heading")}
			</h1>
			<LoginForm />
		</main>
	);
}
