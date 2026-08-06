-- CreateEnum
CREATE TYPE "LocationModel" AS ENUM ('PHYSICAL_BRANCHES', 'DISTRIBUTED_NETWORK', 'ONLINE_ONLY', 'MOBILE_SERVICE', 'NO_FIXED_LOCATION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('ONLINE', 'PHYSICAL', 'BOTH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GeographicScope" AS ENUM ('NATIONWIDE', 'PROVINCES', 'BRANCHES', 'SERVICE_AREA', 'NO_GEOGRAPHIC_RESTRICTION', 'UNKNOWN');

-- AlterTable
ALTER TABLE "commerces" ADD COLUMN     "locationModel" "LocationModel" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "promos" ADD COLUMN     "geographicScope" "GeographicScope" NOT NULL DEFAULT 'UNKNOWN',
DROP COLUMN "salesChannel",
ADD COLUMN     "salesChannel" "SalesChannel" NOT NULL DEFAULT 'UNKNOWN';
