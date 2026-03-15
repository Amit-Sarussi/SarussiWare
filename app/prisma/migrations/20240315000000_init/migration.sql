-- CreateTable (IF NOT EXISTS so existing DBs from postgres-init are not broken)
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
