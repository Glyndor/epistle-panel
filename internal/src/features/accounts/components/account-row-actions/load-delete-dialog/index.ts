/**
 * The code of the delete dialog, asked for when it is needed. It is a module of
 * its own so that a test can make the download fail without touching the
 * dialog's own module, which other tests import.
 */
export const loadDeleteDialog = () =>
	import("@/features/accounts/components/delete-account-dialog").then(
		(module) => module.DeleteAccountDialog,
	);
