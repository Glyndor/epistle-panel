import type { DeliveryTimeline } from "@/features/overview/queries/bucket-deliveries";
import type { OutcomeCounts } from "@/features/overview/queries/count-outcomes";
import type { QueueAges } from "@/features/overview/queries/queue-ages";
import type { TopDomains } from "@/features/overview/queries/top-domains";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";

/** The API did not answer, or answered something the panel could not read. */
export interface Unreachable {
	readonly kind: "unreachable";
}

/** What the delivery charts of the overview draw. */
export type DeliveryOverview =
	| Unreachable
	/** The API answered 404: the server keeps no delivery log. */
	| { readonly kind: "disabled" }
	| {
			readonly kind: "data";
			readonly period: OverviewPeriod;
			/** When the records were read, epoch seconds. */
			readonly readAt: number;
			/** The answer came back at the API's limit, so the period holds more records. */
			readonly full: boolean;
			readonly outcomes: OutcomeCounts;
			readonly timeline: DeliveryTimeline;
	  };

/** What the queue chart of the overview draws. */
export type QueueOverview =
	| Unreachable
	| {
			readonly kind: "data";
			readonly ages: QueueAges;
			/** The queue holds more messages than were read; the ones not read are newer. */
			readonly capped: boolean;
	  };

/** What the suppression chart of the overview draws. */
export type SuppressionOverview =
	| Unreachable
	| {
			readonly kind: "data";
			readonly domains: TopDomains;
			/** The list holds more addresses than were read. */
			readonly capped: boolean;
	  };
