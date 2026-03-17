CREATE TABLE wallet_balances (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wallet_id        UUID        NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    currency         CHAR(3)     NOT NULL,
    total_amount     BIGINT      NOT NULL DEFAULT 0,
    available_amount BIGINT      NOT NULL DEFAULT 0,

    CONSTRAINT chk_amounts CHECK (total_amount >= available_amount AND available_amount >= 0)
);

CREATE UNIQUE INDEX idx_wallet_currency ON wallet_balances (wallet_id, currency);
