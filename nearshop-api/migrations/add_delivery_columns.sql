-- Add delivery fee configuration columns to shops table
-- Run on VM: psql "$DATABASE_URL" -f migrations/add_delivery_columns.sql

ALTER TABLE shops ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS free_delivery_above NUMERIC(10, 2);

-- Set reasonable defaults for existing shops that have delivery enabled
UPDATE shops
SET delivery_fee = 30, free_delivery_above = 500
WHERE 'delivery' = ANY(delivery_options)
  AND delivery_fee = 0;
