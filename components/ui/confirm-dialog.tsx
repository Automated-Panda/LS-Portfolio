"use client";

import { useCallback, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ResolvedOptions = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Drop-in replacement for window.confirm() that uses an in-app AlertDialog
 * instead of the browser-native one (which always prefixes with the
 * hostname — bad UX).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Delete?", description: "..." });
 *   if (!ok) return;
 *
 * Mount <ConfirmDialogHost /> ONCE in the app shell (already done in
 * AppShell) and the hook will render the dialog when invoked.
 */
let _showConfirm:
  | ((opts: ResolvedOptions) => void)
  | null = null;

export function useConfirm() {
  return useCallback((opts: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (!_showConfirm) {
        // Fallback if host isn't mounted yet — at least don't lose the click.
        resolve(window.confirm(opts.description ?? opts.title ?? "Confirm?"));
        return;
      }
      _showConfirm({ ...opts, resolve });
    });
  }, []);
}

export function ConfirmDialogHost() {
  const [opts, setOpts] = useState<ResolvedOptions | null>(null);

  // Register on mount, deregister on unmount.
  useState(() => {
    _showConfirm = (next) => setOpts(next);
    return () => {
      _showConfirm = null;
    };
  });

  const handle = (ok: boolean) => {
    opts?.resolve(ok);
    setOpts(null);
  };

  return (
    <AlertDialog
      open={opts !== null}
      onOpenChange={(o) => {
        if (!o && opts) handle(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title ?? "Are you sure?"}</AlertDialogTitle>
          {opts?.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handle(false)}>
            {opts?.cancelText ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handle(true)}
            className={
              opts?.destructive
                ? "bg-red-500 text-white hover:bg-red-600"
                : undefined
            }
          >
            {opts?.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
