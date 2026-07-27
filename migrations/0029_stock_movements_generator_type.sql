ALTER TABLE stock_movements ADD COLUMN generator_type TEXT;
CREATE INDEX IF NOT EXISTS idx_stock_movements_generator_type ON stock_movements(generator_type);
