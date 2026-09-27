-- Availability Management: config + members + requests + slots
CREATE TABLE "AvailabilityConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'WEEKLY',
    "createDay" INTEGER NOT NULL DEFAULT 3,
    "periodKind" TEXT NOT NULL DEFAULT 'NEXT_WEEK',
    "deadlineDayOffset" INTEGER NOT NULL DEFAULT 1,
    "deadlineMinutes" INTEGER NOT NULL DEFAULT 900,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilityMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "configId" TEXT NOT NULL,

    CONSTRAINT "AvailabilityMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilityRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AvailabilitySlot" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- indexes & constraints
CREATE UNIQUE INDEX "AvailabilityConfig_orgId_key" ON "AvailabilityConfig"("orgId");
CREATE UNIQUE INDEX "AvailabilityMember_orgId_userId_key" ON "AvailabilityMember"("orgId", "userId");
CREATE UNIQUE INDEX "AvailabilityRequest_userId_periodStart_periodEnd_key" ON "AvailabilityRequest"("userId", "periodStart", "periodEnd");
CREATE INDEX "AvailabilityRequest_status_deadline_idx" ON "AvailabilityRequest"("status", "deadline");
CREATE INDEX "AvailabilitySlot_requestId_date_idx" ON "AvailabilitySlot"("requestId", "date");

ALTER TABLE "AvailabilityConfig" ADD CONSTRAINT "AvailabilityConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityMember" ADD CONSTRAINT "AvailabilityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityMember" ADD CONSTRAINT "AvailabilityMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityMember" ADD CONSTRAINT "AvailabilityMember_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AvailabilityConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityRequest" ADD CONSTRAINT "AvailabilityRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityRequest" ADD CONSTRAINT "AvailabilityRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailabilityRequest" ADD CONSTRAINT "AvailabilityRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvailabilityRequest" ADD CONSTRAINT "AvailabilityRequest_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AvailabilityConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AvailabilityRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
