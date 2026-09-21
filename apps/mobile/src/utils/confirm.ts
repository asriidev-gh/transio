type ConfirmKind = 'confirm' | 'alert';

export interface ConfirmRequest {
  id: number;
  kind: ConfirmKind;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (request: ConfirmRequest | null) => void;

let nextId = 1;
let queue: ConfirmRequest[] = [];
let current: ConfirmRequest | null = null;
let listener: Listener | null = null;

function publish() {
  listener?.(current);
}

function dequeueNext() {
  current = queue.shift() ?? null;
  publish();
}

/** Wired by ConfirmHost — do not call from screens. */
export function setConfirmListener(next: Listener | null) {
  listener = next;
  publish();
}

function enqueue(request: Omit<ConfirmRequest, 'id'>) {
  const full: ConfirmRequest = { ...request, id: nextId++ };
  if (!current) {
    current = full;
    publish();
  } else {
    queue.push(full);
  }
}

export function settleConfirm(id: number, ok: boolean) {
  if (!current || current.id !== id) return;
  current.resolve(ok);
  dequeueNext();
}

/** Confirm with Cancel + action. Destructive uses danger styling on the confirm button. */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'Confirm',
  options?: { cancelLabel?: string; destructive?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      cancelLabel: options?.cancelLabel ?? 'Cancel',
      destructive: options?.destructive ?? false,
      resolve,
    });
  });
}

/** Destructive confirm (Delete / Discard / Sign out). */
export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel = 'Delete',
): Promise<boolean> {
  return confirmAction(title, message, confirmLabel, { destructive: true });
}

/** Single-button notice (replaces Alert.alert with one OK). */
export function showAlert(title: string, message: string, okLabel = 'OK'): Promise<void> {
  return new Promise((resolve) => {
    enqueue({
      kind: 'alert',
      title,
      message,
      confirmLabel: okLabel,
      cancelLabel: 'Cancel',
      destructive: false,
      resolve: () => resolve(),
    });
  });
}
