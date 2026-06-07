-- 0045_support_ticket_read_at.sql
-- Admin read/unread tracking for the support inbox. NULL = unread (the default
-- for newly-submitted tickets); set to now() when an admin opens the ticket.
-- Independent of workflow status, so an admin can read a ticket and still leave
-- it "New". The redesigned inbox drives its per-category unread badges off this.
--
-- 'closed' status is retired from the UI (folded into the resolved bucket) but
-- left valid in the check constraint so existing closed tickets stay intact.
-- Idempotent.

alter table public.support_tickets
  add column if not exists read_at timestamptz;
