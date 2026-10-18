-- 舊資料只有 category 字串，依分類名稱補齊 category_id
UPDATE commodities c
SET category_id = cat._id
FROM categories cat
WHERE c.category_id IS NULL
  AND c.category = cat.cname;
