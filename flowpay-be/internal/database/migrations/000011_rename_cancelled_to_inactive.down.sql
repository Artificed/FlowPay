ALTER TABLE scheduled_payments DROP CONSTRAINT scheduled_payments_status_check;
UPDATE scheduled_payments SET status = 'cancelled' WHERE status = 'inactive';
ALTER TABLE scheduled_payments ADD CONSTRAINT scheduled_payments_status_check
    CHECK (status IN ('active', 'cancelled'));
