-- Safe orphan couple cleanup for Couple Dates.
-- Deletes couple rows that have ZERO members. Does not merge spaces or guess partners.
-- Review the SELECT first, then run the DELETE inside a transaction.

-- Preview memberless couples
SELECT c.id, c.your_name, c.partner_name, c.invite_code
FROM couples c
LEFT JOIN couple_members m ON m.couple_id = c.id
GROUP BY c.id
HAVING COUNT(m.user_id) = 0
ORDER BY c.id;

BEGIN;

DELETE FROM space_subscriptions
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM billing_checkouts
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM date_plans
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM memories
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM check_ins
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM couple_uploads
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM date_assistant_turns
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM date_ai_usage
WHERE couple_id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

DELETE FROM couples
WHERE id IN (
  SELECT c.id FROM couples c
  LEFT JOIN couple_members m ON m.couple_id = c.id
  GROUP BY c.id HAVING COUNT(m.user_id) = 0
);

-- COMMIT;  -- uncomment after reviewing row counts from the DELETE output
ROLLBACK;
