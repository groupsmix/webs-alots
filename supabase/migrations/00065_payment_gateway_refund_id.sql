-- Migration: 00065_payment_gateway_refund_id.sql
--
-- Adds a gateway_refund_id column to the payments table to store the
-- external refund identifier returned by the payment gateway (e.g. Stripe's
-- re_... refund ID). This allows staff and support to cross-reference DB
-- refunds with the gateway's own refund record without hunting through logs.
--
-- The column is nullable because:
--   - Offline payments (cash, cheque, insurance) have no gateway refund ID.
--   - CMI refunds are processed manually; no programmatic ID is available.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS gateway_refund_id TEXT;

COMMENT ON COLUMN payments.gateway_refund_id IS
  'External refund identifier from the payment gateway (e.g. Stripe re_...). '
  'NULL for offline/CMI payments where the refund is processed manually.';
