/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type Listener = (loading: boolean, success?: boolean) => void;

let loadingCount = 0;
const listeners: Set<Listener> = new Set();

export const globalLoading = {
  /** Register a listener for loading state changes */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Call when a QUERY request starts (triggers global loading bar) */
  startQuery(): void {
    loadingCount += 1;
    if (loadingCount === 1) {
      listeners.forEach((l) => l(true));
    }
  },

  /** Call when a QUERY request finishes */
  stopQuery(success = true): void {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0) {
      listeners.forEach((l) => l(false, success));
    }
  },

  /** Call when a MUTATION request starts (does NOT trigger global loading bar) */
  startMutation(): void {
    // Mutations don't affect global loading bar
  },

  /** Call when a MUTATION request finishes */
  stopMutation(): void {
    // Mutations don't affect global loading bar
  },

  /** Get current loading count (for debugging) */
  getCount(): number {
    return loadingCount;
  },

  /** Reset count (for testing/edge cases) */
  reset(): void {
    loadingCount = 0;
    listeners.forEach((l) => l(false, true));
  },
};