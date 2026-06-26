/**
 * Property-based tests for toast notification queue.
 *
 * **Validates: Requirements 11.5**
 *
 * Tests that the toast queue management logic correctly enforces:
 * 1. At most 3 toasts are visible simultaneously (any queue of N notifications → max 3 visible)
 * 2. Overflow notifications are queued in FIFO order
 * 3. When a toast is dismissed, the next queued item promotes to visible
 * 4. Total toasts (visible + queued) never exceeds input count
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  MAX_VISIBLE,
  createEmptyState,
  addNotification,
  addMultipleNotifications,
  dismissToast,
  type ToastQueueState,
} from "@/lib/toastQueue";

/**
 * Generate a list of unique notification IDs.
 */
const notificationIdsArb = (minLength = 0, maxLength = 50) =>
  fc.uniqueArray(fc.uuid(), { minLength, maxLength });

describe("Property 18: Toast notification queue", () => {
  it("at most 3 toasts are visible simultaneously after adding N notifications", () => {
    fc.assert(
      fc.property(notificationIdsArb(0, 100), (ids) => {
        const state = addMultipleNotifications(createEmptyState(), ids);
        expect(state.visible.length).toBeLessThanOrEqual(MAX_VISIBLE);
      }),
      { numRuns: 500 }
    );
  });

  it("overflow notifications are queued in FIFO order", () => {
    fc.assert(
      fc.property(notificationIdsArb(4, 50), (ids) => {
        const state = addMultipleNotifications(createEmptyState(), ids);

        // First MAX_VISIBLE ids should be visible
        const expectedVisible = ids.slice(0, MAX_VISIBLE);
        expect(state.visible).toEqual(expectedVisible);

        // Remaining ids should be queued in original order (FIFO)
        const expectedQueued = ids.slice(MAX_VISIBLE);
        expect(state.queued).toEqual(expectedQueued);
      }),
      { numRuns: 500 }
    );
  });

  it("when a toast is dismissed, the next queued item promotes to visible", () => {
    fc.assert(
      fc.property(
        notificationIdsArb(4, 30),
        fc.integer({ min: 0, max: 2 }),
        (ids, dismissIndex) => {
          const state = addMultipleNotifications(createEmptyState(), ids);

          // Dismiss one of the visible toasts
          const toastToDismiss = state.visible[dismissIndex];
          const newState = dismissToast(state, toastToDismiss);

          // The first queued item should now be in visible
          const expectedPromoted = ids[MAX_VISIBLE]; // first overflow item
          expect(newState.visible).toContain(expectedPromoted);

          // Visible count should be back to MAX_VISIBLE (since queue was non-empty)
          expect(newState.visible.length).toBe(MAX_VISIBLE);

          // The dismissed toast should not be in visible anymore
          expect(newState.visible).not.toContain(toastToDismiss);

          // Queue should have one fewer item
          expect(newState.queued.length).toBe(state.queued.length - 1);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("total toasts (visible + queued) never exceeds input count", () => {
    fc.assert(
      fc.property(notificationIdsArb(0, 100), (ids) => {
        const state = addMultipleNotifications(createEmptyState(), ids);
        const total = state.visible.length + state.queued.length;
        expect(total).toBeLessThanOrEqual(ids.length);
        // Since all unique, total should equal input count exactly
        expect(total).toBe(ids.length);
      }),
      { numRuns: 500 }
    );
  });

  it("visible count is exactly min(N, MAX_VISIBLE) for N notifications", () => {
    fc.assert(
      fc.property(notificationIdsArb(0, 100), (ids) => {
        const state = addMultipleNotifications(createEmptyState(), ids);
        const expectedVisible = Math.min(ids.length, MAX_VISIBLE);
        expect(state.visible.length).toBe(expectedVisible);
      }),
      { numRuns: 500 }
    );
  });

  it("dismissing all visible toasts with a non-empty queue promotes items correctly", () => {
    fc.assert(
      fc.property(notificationIdsArb(5, 30), (ids) => {
        let state = addMultipleNotifications(createEmptyState(), ids);

        // Dismiss all visible toasts one by one
        const originalVisible = [...state.visible];
        for (const toastId of originalVisible) {
          state = dismissToast(state, toastId);
          // Invariant: visible never exceeds MAX_VISIBLE
          expect(state.visible.length).toBeLessThanOrEqual(MAX_VISIBLE);
        }

        // After dismissing all original visible toasts, promoted items should come from the queue in FIFO order
        // The new visible items should be the items that were at the front of the queue
        const expectedNewVisible = ids.slice(MAX_VISIBLE, MAX_VISIBLE + Math.min(MAX_VISIBLE, ids.length - MAX_VISIBLE));
        expect(state.visible).toEqual(expectedNewVisible);
      }),
      { numRuns: 500 }
    );
  });

  it("dismissing a non-existent toast id leaves state unchanged", () => {
    fc.assert(
      fc.property(
        notificationIdsArb(1, 20),
        fc.uuid(),
        (ids, nonExistentId) => {
          // Ensure the random UUID is not in the ids
          fc.pre(!ids.includes(nonExistentId));

          const state = addMultipleNotifications(createEmptyState(), ids);
          const newState = dismissToast(state, nonExistentId);

          expect(newState.visible).toEqual(state.visible);
          expect(newState.queued).toEqual(state.queued);
        }
      ),
      { numRuns: 500 }
    );
  });
});
