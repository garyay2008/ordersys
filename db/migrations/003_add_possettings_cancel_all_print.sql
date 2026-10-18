-- 整單取消自動印單：取消整張單時，收銀機（收據印表機）固定出單，廚房出單依此開關（cancelAllPrint.kitchen）
ALTER TABLE possettings ADD COLUMN IF NOT EXISTS cancel_all_print jsonb;
