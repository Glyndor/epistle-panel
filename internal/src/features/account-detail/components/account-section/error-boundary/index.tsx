import { Component, type ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface AccountSectionErrorBoundaryProps {
	children: ReactNode;
	failedMessage: string;
	retryLabel: string;
	onRetry: () => void;
}

interface AccountSectionErrorBoundaryState {
	failed: boolean;
}

export class AccountSectionErrorBoundary extends Component<
	AccountSectionErrorBoundaryProps,
	AccountSectionErrorBoundaryState
> {
	override state: AccountSectionErrorBoundaryState = { failed: false };

	static getDerivedStateFromError(): AccountSectionErrorBoundaryState {
		return { failed: true };
	}

	override render() {
		if (this.state.failed) {
			return (
				<Alert variant="destructive">
					<AlertDescription className="flex flex-col items-start gap-3">
						<span>{this.props.failedMessage}</span>
						<Button
							type="button"
							variant="outline"
							onClick={this.props.onRetry}
						>
							{this.props.retryLabel}
						</Button>
					</AlertDescription>
				</Alert>
			);
		}
		return this.props.children;
	}
}
