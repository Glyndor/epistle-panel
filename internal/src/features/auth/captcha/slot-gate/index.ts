export interface SlotGateLimits {
	/** Slots that may be held at once. */
	max: number;
	/** Callers that may wait for a slot at once; more are refused. */
	queueMax: number;
	/** Longest a caller waits for a slot, in milliseconds. */
	waitMs: number;
}

export interface SlotGate {
	/** Take a slot, waiting in line if needed. `false`: refused, hold nothing. */
	acquire(): Promise<boolean>;
	/** Give a slot back; the longest-waiting caller gets it. */
	release(): void;
}

interface Waiter {
	grant(): void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * A counting gate with a short, bounded, first-in-first-out line. A burst above
 * `max` is absorbed for up to `waitMs` instead of being refused at once; the
 * line itself is capped, so sustained load above the limits is still refused.
 * Every `true` from `acquire` must be paired with one `release`.
 */
export function createSlotGate(limits: SlotGateLimits): SlotGate {
	let held = 0;
	const line: Waiter[] = [];
	return {
		acquire() {
			if (held < limits.max) {
				held += 1;
				return Promise.resolve(true);
			}
			if (line.length >= limits.queueMax) {
				return Promise.resolve(false);
			}
			return new Promise<boolean>((resolve) => {
				const waiter: Waiter = {
					grant: () => {
						clearTimeout(waiter.timer);
						resolve(true);
					},
					timer: setTimeout(() => {
						line.splice(line.indexOf(waiter), 1);
						resolve(false);
					}, limits.waitMs),
				};
				line.push(waiter);
			});
		},
		release() {
			const next = line.shift();
			if (next) {
				// The slot passes straight to the next caller: `held` is unchanged.
				next.grant();
			} else {
				held -= 1;
			}
		},
	};
}
