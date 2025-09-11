-- ============================================
-- FIX UPDATE HISTORY FUNCTION
-- Run this to fix the type mismatch error
-- ============================================

-- Drop and recreate the function with correct types
DROP FUNCTION IF EXISTS get_update_history();

CREATE OR REPLACE FUNCTION get_update_history()
RETURNS TABLE(
    snapshot_date DATE,
    total_items BIGINT,  -- Changed from INTEGER to BIGINT
    new_candidates BIGINT,  -- Changed from INTEGER to BIGINT
    watching BIGINT,  -- Changed from INTEGER to BIGINT
    removed BIGINT,  -- Changed from INTEGER to BIGINT
    back_in_feed BIGINT,  -- Changed from INTEGER to BIGINT
    acquired BIGINT,  -- Changed from INTEGER to BIGINT
    days_since_previous INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH snapshot_summary AS (
        SELECT 
            wt.snapshot_date,
            COUNT(*) as total_items,
            COUNT(CASE WHEN status = 'NEW_CANDIDATE' THEN 1 END) as new_candidates,
            COUNT(CASE WHEN status = 'WATCHING' THEN 1 END) as watching,
            COUNT(CASE WHEN status = 'REMOVED' THEN 1 END) as removed,
            COUNT(CASE WHEN status = 'BACK_IN_FEED' THEN 1 END) as back_in_feed,
            COUNT(CASE WHEN status = 'ACQUIRED' THEN 1 END) as acquired
        FROM watchlist_tracking wt
        GROUP BY wt.snapshot_date
    )
    SELECT 
        ss.*,
        (ss.snapshot_date - LAG(ss.snapshot_date) OVER (ORDER BY ss.snapshot_date))::INTEGER as days_since_previous
    FROM snapshot_summary ss
    ORDER BY ss.snapshot_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_update_history() TO authenticated;

-- Now test it
SELECT * FROM get_update_history();

-- Show current status summary
SELECT status, COUNT(*) as count 
FROM watchlist_tracking 
WHERE snapshot_date = CURRENT_DATE 
GROUP BY status
ORDER BY count DESC;

-- Show when updates occurred
SELECT 
    snapshot_date,
    COUNT(DISTINCT upc) as items_tracked,
    MIN(created_at) as update_started,
    MAX(created_at) as update_completed
FROM watchlist_tracking
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 10;