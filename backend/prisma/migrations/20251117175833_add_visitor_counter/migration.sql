-- CreateTable
CREATE TABLE "visitor_count" (
    "id" BIGSERIAL NOT NULL,
    "total" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_count_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_daily_stats" (
    "id" BIGSERIAL NOT NULL,
    "day" DATE NOT NULL,
    "total" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_daily_stats_day_key" ON "visitor_daily_stats"("day");
