ALTER TABLE transactions DROP CONSTRAINT chk_transaction_type;
ALTER TABLE transactions ALTER COLUMN sender_wallet_id SET NOT NULL;
ALTER TABLE transactions DROP COLUMN type;
