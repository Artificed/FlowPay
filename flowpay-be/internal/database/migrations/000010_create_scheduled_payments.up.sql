CREATE TABLE scheduled_payments (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id              UUID        NOT NULL REFERENCES users(id),
    recipient_wallet_id  UUID        NOT NULL REFERENCES wallets(id),
    amount               BIGINT      NOT NULL CHECK (amount > 0),
    currency             CHAR(3)     NOT NULL,
    note                 VARCHAR(500),
    interval_days        INT         NOT NULL CHECK (interval_days > 0),
    next_run_at          TIMESTAMPTZ NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'cancelled')),
    workflow_id          VARCHAR(255) NOT NULL
);
CREATE INDEX idx_scheduled_payments_user_id ON scheduled_payments (user_id);
