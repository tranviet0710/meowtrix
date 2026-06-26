/**
 * Pure toast notification queue management logic.
 *
 * Extracted from the ToastQueue React component for testability.
 * The key invariant is: visible.length <= MAX_VISIBLE at all times.
 */

export const MAX_VISIBLE = 3;

export interface ToastQueueState {
  visible: string[];
  queued: string[];
}

/**
 * Create an initial empty queue state.
 */
export function createEmptyState(): ToastQueueState {
  return { visible: [], queued: [] };
}

/**
 * Add a notification to the queue.
 * If there are fewer than MAX_VISIBLE visible toasts, add directly to visible.
 * Otherwise, add to the queued list (FIFO).
 */
export function addNotification(
  state: ToastQueueState,
  notificationId: string
): ToastQueueState {
  if (state.visible.length < MAX_VISIBLE) {
    return {
      visible: [...state.visible, notificationId],
      queued: [...state.queued],
    };
  }
  return {
    visible: [...state.visible],
    queued: [...state.queued, notificationId],
  };
}

/**
 * Dismiss a visible toast and promote the next queued item (if any) to visible.
 * If the id is not in visible, the state is returned unchanged.
 */
export function dismissToast(
  state: ToastQueueState,
  toastId: string
): ToastQueueState {
  const visibleIndex = state.visible.indexOf(toastId);
  if (visibleIndex === -1) {
    return state;
  }

  const newVisible = state.visible.filter((id) => id !== toastId);
  const newQueued = [...state.queued];

  // Promote from queue to fill the available slot
  while (newVisible.length < MAX_VISIBLE && newQueued.length > 0) {
    const promoted = newQueued.shift()!;
    newVisible.push(promoted);
  }

  return {
    visible: newVisible,
    queued: newQueued,
  };
}

/**
 * Process a batch of notifications, applying them sequentially to the queue.
 * Returns the final state after all notifications are added.
 */
export function addMultipleNotifications(
  state: ToastQueueState,
  notificationIds: string[]
): ToastQueueState {
  let current = state;
  for (const id of notificationIds) {
    current = addNotification(current, id);
  }
  return current;
}
