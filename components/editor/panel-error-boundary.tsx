import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the PanelErrorBoundary component.
 *
 * @property name - Display name for the panel (e.g., "Preview", "Code Editor")
 * @property children - The panel content to wrap
 */
interface PanelErrorBoundaryProps {
    name: string;
    children: ReactNode;
}

/**
 * State for the error boundary.
 *
 * @property hasError - Whether an error has been caught
 * @property error - The caught error (for display)
 */
interface PanelErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * PanelErrorBoundary wraps editor panels to catch rendering errors.
 * When an error occurs, it shows an inline error message instead
 * of crashing the entire editor. The user can click "Try again"
 * to attempt re-rendering the panel.
 */
export class PanelErrorBoundary extends Component<
    PanelErrorBoundaryProps,
    PanelErrorBoundaryState
> {
    constructor(props: PanelErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    /**
     * Called when a child component throws an error during rendering.
     * Updates state to show the error UI on the next render.
     */
    static getDerivedStateFromError(
        error: Error
    ): PanelErrorBoundaryState {
        return { hasError: true, error };
    }

    /**
     * Called after an error is caught. Logs the error for debugging.
     */
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error(
            `[${this.props.name}] Panel error:`,
            error,
            errorInfo
        );
    }

    /**
     * Resets the error state so the panel re-renders.
     */
    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-4">
                    <AlertTriangle className="size-6 text-destructive" />

                    <div className="space-y-1">
                        <p className="text-sm font-medium">
                            Something went wrong in {this.props.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {this.state.error?.message}
                        </p>
                    </div>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={this.handleReset}
                        className="gap-1.5"
                    >
                        <RotateCcw className="size-3.5" />
                        Try again
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}