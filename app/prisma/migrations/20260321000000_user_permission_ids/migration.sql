-- Add column: users store permission IDs in an array (no join table)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permission_ids" INTEGER[] DEFAULT '{}';

-- Migrate from _PermissionToUser: for each user (B), set permission_ids to that user's permission IDs (A)
UPDATE "users" u
SET "permission_ids" = COALESCE(
  (SELECT array_agg(j."A" ORDER BY j."A") FROM "_PermissionToUser" j WHERE j."B" = u.id),
  '{}'
);

-- Drop the join table
DROP TABLE IF EXISTS "_PermissionToUser";
