import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getPublicCaptcha } from "@/features/auth/captcha/config";
import { LoginForm } from "@/features/auth/components/login-form";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The sign-in page, at the root, for every account whatever its role: the only
 * page that answers without a session. A visitor who already holds a session
 * goes on to the mail area, where an admin finds the way to the admin panel.
 */
export default async function LoginPage() {
	if (await verifySession((await cookies()).get(SESSION_COOKIE)?.value)) {
		redirect(PUBLIC_ROUTES.mail);
	}
	const t = await getTranslations("auth");
	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<LoginForm captcha={getPublicCaptcha()} />
		</>
	);
}
