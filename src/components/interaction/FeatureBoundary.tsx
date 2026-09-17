"use client";

import { Component, type ReactNode } from "react";

/** Keep shell/composer ownership outside a feature that may fail rendering. */
export class FeatureBoundary extends Component<{ children: ReactNode; label: string; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: Readonly<{ resetKey: string }>) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) return <section role="alert" aria-label={`${this.props.label} unavailable`}>
      <h2>{this.props.label} could not open</h2><p>Your draft is preserved. Retry this view or choose another destination.</p>
      <button type="button" onClick={() => this.setState({ failed: false })}>Retry {this.props.label.toLowerCase()}</button>
    </section>;
    return this.props.children;
  }
}
