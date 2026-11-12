import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { getBrand } from "@/features/branding/queries/brand";
import { isThemeConfigured } from "@/features/theme/queries/theme-css";

import { pickClientMessages } from "@/i18n/messages";

import "./globals.css";

/**
 * The panel is never indexed. Next renders these as a `robots` meta tag; the
 * `X-Robots-Tag` header (see `lib/security-headers`) says the same on every
 * response, including the ones that carry no HTML. There is deliberately no
 * description, canonical link, Open Graph or Twitter metadata.
 */
export async function generateMetadata(): Promise<Metadata> {
	const brand = getBrand();
	return {
		title: brand.name,
		// The operator's favicon, when set; otherwise the file Next serves for
		// `favicon.ico` in this folder.
		...(brand.hasFavicon && { icons: { icon: "/brand/favicon" } }),
		robots: {
			index: false,
			follow: false,
			noarchive: true,
			nosnippet: true,
			noimageindex: true,
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const locale = await getLocale();
	// Client components get only their namespaces; the server pages read the rest.
	const messages = await getMessages();
	return (
		<html lang={locale} className="h-full antialiased">
			{isThemeConfigured() && (
				<head>
					{/* The operator's override, after the panel's own stylesheet.
					    Same origin, so `style-src 'self'` allows it. */}
					<link
						rel="stylesheet"
						href="/theme.css"
						precedence="theme"
					/>
				</head>
			)}
			<body className="min-h-full text-sm">
				<NextIntlClientProvider messages={pickClientMessages(messages)}>
					{children}
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
