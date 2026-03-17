CREATE TABLE transactions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference_code       VARCHAR(64)  NOT NULL,
    sender_wallet_id     UUID         NOT NULL REFERENCES wallets(id),
    recipient_wallet_id  UUID         NOT NULL REFERENCES wallets(id),
    amount               BIGINT       NOT NULL,
    currency             CHAR(3)      NOT NULL,
    note                 VARCHAR(500),
    status               VARCHAR(20)  NOT NULL DEFAULT 'pending'
);

CREATE UNIQUE INDEX idx_transactions_reference_code      ON transactions (reference_code);
CREATE INDEX        idx_transactions_sender_wallet_id    ON transactions (sender_wallet_id);
CREATE INDEX        idx_transactions_recipient_wallet_id ON transactions (recipient_wallet_id);
CREATE INDEX        idx_transactions_status              ON transactions (status);
