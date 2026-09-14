/** Immutable ownership token for one asynchronous view-data load. */
export interface ViewLoadToken<TTarget extends object> {
  readonly generation: number;
  readonly target: TTarget | null;
  readonly targetIdentity: string | null;
}

/** Invalidates stale async continuations, including A→B→A navigation. */
export class ViewLoadGeneration<TTarget extends object> {
  private generation = 0;

  public begin(
    target: TTarget | null,
    targetIdentity: string | null,
  ): ViewLoadToken<TTarget> {
    return {
      generation: ++this.generation,
      target,
      targetIdentity,
    };
  }

  public invalidate(): void {
    this.generation += 1;
  }

  public isCurrent(
    token: ViewLoadToken<TTarget>,
    target: TTarget | null,
    targetIdentity: string | null,
  ): boolean {
    return (
      token.generation === this.generation &&
      token.target === target &&
      token.targetIdentity === targetIdentity
    );
  }
}
