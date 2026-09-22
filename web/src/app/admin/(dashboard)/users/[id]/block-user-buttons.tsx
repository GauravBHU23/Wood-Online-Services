"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockUserAction, unblockUserAction } from "@/lib/admin/user-actions";
import { useConfirm } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";

export function BlockUserButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();
  const toast = useToast();

  async function handleClick() {
    const ok = await confirm({
      title: "Block customer",
      message: "This customer will not be able to sign in until you unblock them. Continue?",
      tone: "danger",
      confirmLabel: "Block",
    });
    if (!ok) return;

    startTransition(async () => {
      const result = await blockUserAction(userId);
      if (result.success) {
        toast.success(result.message ?? "Blocked.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not block.");
      }
    });
  }

  return (
    <button type="button" className={`btn btn-outline-danger w-100${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending ? "Blocking..." : "Block this customer"}
    </button>
  );
}

export function UnblockUserButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function handleClick() {
    startTransition(async () => {
      const result = await unblockUserAction(userId);
      if (result.success) {
        toast.success(result.message ?? "Unblocked.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Could not unblock.");
      }
    });
  }

  return (
    <button type="button" className={`btn btn-wood w-100${pending ? " is-busy" : ""}`} disabled={pending} onClick={handleClick}>
      {pending ? "Unblocking..." : "Unblock this customer"}
    </button>
  );
}
