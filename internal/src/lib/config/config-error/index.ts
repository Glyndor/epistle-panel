/**
 * Raised when the panel's own configuration is unusable.
 *
 * The message is written by the panel, names the variable at fault and never
 * carries a configured value, a path or a secret, so it is safe to log as is.
 * Errors from the API or from the network are not `ConfigError`s: their text is
 * not under the panel's control and must not be logged.
 */
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}
