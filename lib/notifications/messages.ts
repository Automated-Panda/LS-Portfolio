// lib/notifications/messages.ts
// Pure builders for notification payloads (no I/O).

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export function creditAdjustmentNotification(
  delta: number,
  newTotal: number,
): NotificationPayload {
  const isGift = delta > 0;
  return {
    type: "credit_adjustment",
    title: isGift ? "🎁 You received credits!" : "Credit balance updated",
    body: isGift
      ? `An admin added ${delta} credits to your account. You now have ${newTotal}.`
      : `An admin adjusted your credits by ${delta}. You now have ${newTotal}.`,
    data: { delta, newTotal },
  };
}
