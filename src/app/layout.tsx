import type { Metadata } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { SiteNav } from "@/components/site-nav";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("app");
	return {
		title: t("title"),
		description: t("description"),
	};
}

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	const t = await getTranslations("nav");
	const session = await verifySession(
		(await cookies()).get(SESSION_COOKIE)?.value,
	);
	return (
		<html lang={locale} className="h-full antialiased">
			<body className="flex min-h-full flex-col">
				<NextIntlClientProvider>
					{session ? (
						<>
							<a
								href="#main-content"
								className="sr-only rounded bg-zinc-900 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10"
							>
								{t("skip")}
							</a>
							<SiteNav />
						</>
					) : null}
					{children}
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
