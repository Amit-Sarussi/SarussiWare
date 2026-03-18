-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);
