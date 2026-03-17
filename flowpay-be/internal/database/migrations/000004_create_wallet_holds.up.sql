CREATE TABLE wallet_holds (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wallet_balance_id UUID        NOT NULL REFERENCES wallet_balances(id),
    transaction_id    UUID        NOT NULL,
    amount            BIGINT      NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at        TIMESTAMPTZ
);

CREATE INDEX idx_wallet_holds_wallet_balance_id ON wallet_holds (wallet_balance_id);
CREATE INDEX idx_wallet_holds_transaction_id    ON wallet_holds (transaction_id);
CREATE INDEX idx_wallet_holds_balance_status    ON wallet_holds (wallet_balance_id, status);
