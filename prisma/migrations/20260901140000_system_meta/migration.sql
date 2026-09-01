-- Platform key/value store (worker heartbeat, etc.)
CREATE TABLE "SystemMeta" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemMeta_pkey" PRIMARY KEY ("key")
);
