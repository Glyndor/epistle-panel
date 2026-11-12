/**
 * Minimal frame of the pages reachable without a session: no sidebar, only the
 * `main` landmark the skip target and the page content need.
 */
export default function AuthLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<main
			id="main-content"
			className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-4 p-4"
		>
			{children}
		</main>
	);
}
