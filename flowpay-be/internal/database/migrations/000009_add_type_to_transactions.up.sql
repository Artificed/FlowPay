ALTER TABLE transactions
  ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'transfer';

ALTER TABLE transactions
  ALTER COLUMN sender_wallet_id DROP NOT NULL;

ALTER TABLE transactions
  ADD CONSTRAINT chk_transaction_type CHECK (type IN ('transfer', 'deposit'));
