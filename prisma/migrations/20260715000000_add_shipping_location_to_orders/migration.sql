ALTER TABLE "Order"
ADD COLUMN "shippingLocationProvider" "ShippingProvider",
ADD COLUMN "shippingDistrictId" INTEGER,
ADD COLUMN "shippingDistrictName" TEXT,
ADD COLUMN "shippingCityId" INTEGER,
ADD COLUMN "shippingCityName" TEXT;
