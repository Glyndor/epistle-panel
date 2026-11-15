declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The static origin this build was made for. `next.config.ts` writes it
		 * in when `EPISTLE_PANEL_STATIC_ORIGIN` is set during the build, and Next
		 * replaces every read of it with that value; with no static origin nothing
		 * replaces it and it reads as unset.
		 */
		PANEL_BUILT_STATIC_ORIGIN?: string;
	}
}
