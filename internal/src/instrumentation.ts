/**
 * Runs once when the server starts. It warns about `EPISTLE_PANEL_` variables
 * the panel does not read, and settles the admin area: an id that is set but
 * unusable stops the start with a message naming the variable, and no id at all
 * starts the panel with the admin area off and says so.
 */
export async function register(): Promise<void> {
	if (process.env["NEXT_RUNTIME"] !== "nodejs") {
		return;
	}
	const { warnUnknownPanelVariables } = await import(
		"@/lib/config/panel-variables"
	);
	warnUnknownPanelVariables();

	const { checkAdminIdAtStart } = await import(
		"@/lib/config/admin-id-start-check"
	);
	await checkAdminIdAtStart();
}
