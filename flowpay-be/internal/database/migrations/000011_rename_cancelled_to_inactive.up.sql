ALTER TABLE scheduled_payments DROP CONSTRAINT scheduled_payments_status_check;
UPDATE scheduled_payments SET status = 'inactive' WHERE status = 'cancelled';
ALTER TABLE scheduled_payments ADD CONSTRAINT scheduled_payments_status_check
    CHECK (status IN ('active', 'inactive'));
