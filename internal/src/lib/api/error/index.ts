/** Raised for any non-2xx response from the Epistle management API. */
export class EpistleApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "EpistleApiError";
		this.status = status;
		this.code = code;
	}
}

/** Raised when the API does not answer within the time budget of the call. */
export class EpistleApiTimeoutError extends Error {
	constructor() {
		super("Epistle API request timed out");
		this.name = "EpistleApiTimeoutError";
	}
}

/** Raised when an API response body is larger than the panel will buffer. */
export class EpistleApiResponseTooLargeError extends Error {
	constructor() {
		super("Epistle API response is too large");
		this.name = "EpistleApiResponseTooLargeError";
	}
}
