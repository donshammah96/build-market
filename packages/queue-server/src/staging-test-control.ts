/**
 * Narrow, backend-neutral envelope accepted by staging test jobs. It carries
 * ownership and a bounded fault policy only; callers cannot override queue
 * names, payloads, retry counts, or processor selection.
 */
export type StagingTestFault = "TRANSIENT_ERROR";

export interface StagingTestControlEnvelope {
  stagingTestRunId: string;
  scenario: "queue-recovery";
  simulateFailure: StagingTestFault;
  /** Number of initial attempts allowed to fail, constrained to one or two. */
  failAttempts: 1 | 2;
}

export function shouldInjectStagingFault(
  control: StagingTestControlEnvelope | undefined,
  attemptsMade: number,
): boolean {
  return Boolean(control && attemptsMade < control.failAttempts);
}
