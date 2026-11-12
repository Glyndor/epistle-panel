/**
 * Runs once when the server starts. It warns about `EPISTLE_PANEL_` variables
 * the panel does not read; it never stops the start.
 */
export async function register(): Promise<void> {
	if (process.env["NEXT_RUNTIME"] !== "nodejs") {
		return;
	}
	const { warnUnknownPanelVariables } = await import(
		"@/lib/config/panel-variables"
	);
	warnUnknownPanelVariables();
}
