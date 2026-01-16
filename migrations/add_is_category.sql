-- Category System Fix - Database Migration
-- Run this SQL in Supabase Console (SQL Editor)

-- Add is_category column to distinguish categories from products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_category BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_is_category ON products(is_category);

-- NOTE: After running this, existing products will have is_category = false
-- Categories you create via admin will have is_category = true
