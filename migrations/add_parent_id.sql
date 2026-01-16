-- Product Variation Feature - Database Migration
-- Run this SQL in Supabase Console (SQL Editor)

-- Add parent_id column for self-referencing relationship
-- Products with parent_id = NULL are categories/parents
-- Products with parent_id = <uuid> are variations

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_parent_id ON products(parent_id);

-- To convert existing products to variations:
-- 1. First create a parent product (category):
--    INSERT INTO products (name, description, price, is_active, parent_id)
--    VALUES ('ChatGpt', 'Nogar & Garansi', 0, true, NULL);
--
-- 2. Then update existing products to be variations:
--    UPDATE products SET parent_id = '<parent-uuid>' WHERE id = '<variation-uuid>';
