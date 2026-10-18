-- 工作站鎖定時間，供鎖定 TTL 判斷呆鎖
ALTER TABLE orders ADD COLUMN IF NOT EXISTS locked_at timestamptz;
