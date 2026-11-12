"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { logout } from "@/lib/auth/actions/logout";

/** Primary navigation across the admin views, marking the active route. */
export function SiteNav() {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const links = [
		{ href: "/", label: t("status") },
		{ href: "/domains", label: t("domains") },
		{ href: "/accounts", label: t("accounts") },
		{ href: "/queue", label: t("queue") },
	];
	return (
		<header className="border-zinc-200 border-b dark:border-zinc-800">
			<nav
				aria-label={t("label")}
				className="mx-auto flex w-full max-w-3xl flex-wrap items-center px-2 py-1.5"
			>
				{links.map((link) => {
					const active =
						link.href === "/"
							? pathname === "/"
							: pathname.startsWith(link.href);
					return (
						<Link
							key={link.href}
							href={link.href}
							aria-current={active ? "page" : undefined}
							className={`inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 ${
								active
									? "font-semibold text-zinc-900 dark:text-zinc-100"
									: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
							}`}
						>
							{link.label}
						</Link>
					);
				})}
				<form action={logout} className="ml-auto">
					<button
						type="submit"
						className="inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded px-2 text-sm text-zinc-600 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100"
					>
						{t("logout")}
					</button>
				</form>
			</nav>
		</header>
	);
}
