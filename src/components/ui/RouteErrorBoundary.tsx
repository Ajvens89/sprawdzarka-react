import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Route chunk failed to load:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="ui-empty-state" role="alert">
          <p>Nie udało się wczytać modułu.</p>
          <p className="settings-muted" style={{ marginTop: "0.5rem", fontSize: "0.86rem" }}>
            Może to być problem sieci lub cache po aktualizacji aplikacji.
          </p>
          <button className="btn-search" type="button" style={{ marginTop: "1rem" }} onClick={this.handleRetry}>
            Odśwież stronę
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
