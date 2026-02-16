-- Seed data for packages table
-- This file can be used to insert package data into both Docker PostgreSQL and Supabase

-- Insert Pelajar Pemula package (1 bulan)
INSERT INTO packages (name, description, price_label, price, validity_day)
VALUES (
  'Pelajar Pemula',
  'Paket 1 bulan untuk pelajar pemula yang ingin mulai belajar dengan BangSoal',
  '24.999',
  24999,
  30
)
ON CONFLICT (name) DO NOTHING;

-- Insert Pelajar Setia package (3 bulan)
INSERT INTO packages (name, description, price_label, price, validity_day)
VALUES (
  'Pelajar Setia',
  'Paket 3 bulan untuk pelajar setia dengan diskon 10%',
  '69.999',
  69999,
  90
)
ON CONFLICT (name) DO NOTHING;

-- Insert Pelajar Ambis package (6 bulan)
INSERT INTO packages (name, description, price_label, price, validity_day)
VALUES (
  'Pelajar Ambis',
  'Paket 6 bulan untuk pelajar ambis dengan diskon 20%',
  '129.999',
  129999,
  180
)
ON CONFLICT (name) DO NOTHING;
