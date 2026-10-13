BEGIN;
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'GUEST_ORDER_ACCESS');

-- CreateEnum
CREATE TYPE "FacetKind" AS ENUM ('GOAL', 'DISCIPLINE');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('FRONT', 'NUTRITION', 'GALLERY');

-- CreateEnum
CREATE TYPE "ProductRelationKind" AS ENUM ('RELATED', 'CROSS_SELL');

-- CreateEnum
CREATE TYPE "ExpiryPrecision" AS ENUM ('DAY', 'MONTH');

-- CreateEnum
CREATE TYPE "InventoryMovementKind" AS ENUM ('RECEIPT', 'RESERVE', 'RELEASE', 'SALE', 'ADJUSTMENT', 'WASTE', 'RETURN_SELLABLE', 'RETURN_NON_SELLABLE');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'MERGED', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CartItemState" AS ENUM ('ACTIVE', 'SAVED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('AVAILABLE', 'ACCEPTED', 'EXPIRED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "MoneyStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'NOT_REQUIRED', 'RECONCILING');

-- CreateEnum
CREATE TYPE "OrderLineKind" AS ENUM ('VARIANT', 'BUNDLE');

-- CreateEnum
CREATE TYPE "ReservationState" AS ENUM ('ACTIVE', 'RECONCILING', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "CouponKind" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('CATALOG', 'PRODUCTS', 'CATEGORIES');

-- CreateEnum
CREATE TYPE "ResourceState" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

-- CreateEnum
CREATE TYPE "LoyaltyEntryKind" AS ENUM ('EARN', 'REDEEM', 'RESTORE', 'REVERSE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SESSION_CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'RECONCILING');

-- CreateEnum
CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundKind" AS ENUM ('CANCELLATION', 'RETURN', 'PRICE_MATCH', 'COMPENSATION');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SETTLED', 'FAILED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "RefundAllocationKind" AS ENUM ('UNIT', 'SHIPPING');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('VOLUNTARY', 'DAMAGED_ON_RECEIPT', 'BROKEN_SEAL', 'WRONG_LOT');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReturnCostPayer" AS ENUM ('CUSTOMER', 'STORE');

-- CreateEnum
CREATE TYPE "ReturnItemState" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ProductCondition" AS ENUM ('SEALED', 'OPENED', 'DAMAGED', 'EXPIRED', 'WRONG_LOT', 'UNVERIFIABLE');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('SELLABLE', 'NON_SELLABLE', 'QUARANTINE');

-- CreateEnum
CREATE TYPE "PriceMatchStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReviewModerationAction" AS ENUM ('HIDE', 'RESTORE');

-- CreateEnum
CREATE TYPE "RestockState" AS ENUM ('ACTIVE', 'PROCESSING', 'NOTIFIED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OutboxKind" AS ENUM ('EMAIL', 'CREATE_PAYMENT', 'REFUND', 'RECONCILE_PAYMENT', 'RESTOCK_NOTICE');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "authVersion" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenFamilyId" UUID NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshCredential" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RefreshCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" UUID NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "userId" UUID,
    "orderId" UUID,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'MX',
    "postalCode" VARCHAR(5) NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "exteriorNumber" TEXT NOT NULL,
    "interiorNumber" TEXT,
    "references" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "brandId" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "usageInstructions" TEXT,
    "ingredients" TEXT,
    "allergenInformation" TEXT,
    "featuredPosition" INTEGER,
    "publishedAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "Facet" (
    "id" UUID NOT NULL,
    "kind" "FacetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Facet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFacet" (
    "productId" UUID NOT NULL,
    "facetId" UUID NOT NULL,

    CONSTRAINT "ProductFacet_pkey" PRIMARY KEY ("productId","facetId")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "flavor" TEXT NOT NULL,
    "flavorNormalized" TEXT NOT NULL,
    "presentationLabel" TEXT NOT NULL,
    "presentationNormalized" TEXT NOT NULL,
    "contentAmount" DECIMAL(14,4) NOT NULL,
    "contentUnit" TEXT NOT NULL,
    "servings" DECIMAL(14,4),
    "servingAmount" DECIMAL(14,4),
    "servingUnit" TEXT,
    "nutritionData" JSONB,
    "ingredientsOverride" TEXT,
    "priceCents" BIGINT NOT NULL,
    "compareAtPriceCents" BIGINT,
    "priceVersion" INTEGER NOT NULL DEFAULT 1,
    "weightGrams" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "checksum" TEXT NOT NULL,
    "originalName" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "variantId" UUID,
    "assetId" UUID NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "altText" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductRelation" (
    "sourceProductId" UUID NOT NULL,
    "targetProductId" UUID NOT NULL,
    "kind" "ProductRelationKind" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductRelation_pkey" PRIMARY KEY ("sourceProductId","targetProductId","kind")
);

-- CreateTable
CREATE TABLE "Bundle" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" BIGINT NOT NULL,
    "compositionVersion" INTEGER NOT NULL DEFAULT 1,
    "imageAssetId" UUID,
    "featuredPosition" INTEGER,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleComponent" (
    "bundleId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "BundleComponent_pkey" PRIMARY KEY ("bundleId","variantId")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" UUID NOT NULL,
    "singletonKey" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'MX',
    "postalCode" VARCHAR(5) NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "exteriorNumber" TEXT NOT NULL,
    "interiorNumber" TEXT,
    "references" TEXT,
    "contactName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "configurationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageType" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "innerLengthMm" INTEGER NOT NULL,
    "innerWidthMm" INTEGER NOT NULL,
    "innerHeightMm" INTEGER NOT NULL,
    "outerLengthMm" INTEGER NOT NULL,
    "outerWidthMm" INTEGER NOT NULL,
    "outerHeightMm" INTEGER NOT NULL,
    "tareWeightGrams" INTEGER NOT NULL,
    "maxGrossWeightGrams" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PackageType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "lotCode" TEXT NOT NULL,
    "expiresOn" DATE,
    "expiryPrecision" "ExpiryPrecision",
    "importedOn" DATE,
    "customsEntry" TEXT,
    "origin" TEXT,
    "certificateAssetId" UUID,
    "onHandQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "nonSellableQty" INTEGER NOT NULL DEFAULT 0,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "kind" "InventoryMovementKind" NOT NULL,
    "onHandDelta" INTEGER NOT NULL DEFAULT 0,
    "reservedDelta" INTEGER NOT NULL DEFAULT 0,
    "nonSellableDelta" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL,
    "reservationStockId" UUID,
    "orderUnitId" UUID,
    "returnInspectionId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "guestTokenHash" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "selectedCouponId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "variantId" UUID,
    "bundleId" UUID,
    "quantity" INTEGER NOT NULL,
    "state" "CartItemState" NOT NULL DEFAULT 'ACTIVE',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingQuote" (
    "id" UUID NOT NULL,
    "cartId" UUID,
    "orderId" UUID,
    "requestFingerprint" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ENVIA',
    "providerQuoteId" TEXT,
    "carrierCode" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "quotedAmountCents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "estimatedDeliveryFrom" TIMESTAMPTZ(3),
    "estimatedDeliveryTo" TIMESTAMPTZ(3),
    "quotedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "originSnapshot" JSONB NOT NULL,
    "destinationSnapshot" JSONB NOT NULL,
    "packageSnapshot" JSONB NOT NULL,
    "sanitizedResponse" JSONB NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ShippingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" UUID,
    "buyerEmail" TEXT NOT NULL,
    "buyerEmailNormalized" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "linkedAt" TIMESTAMPTZ(3),
    "sourceCartId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "moneyStatus" "MoneyStatus" NOT NULL DEFAULT 'PENDING',
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "goodsBeforeCouponCents" BIGINT NOT NULL,
    "couponDiscountCents" BIGINT NOT NULL,
    "goodsAfterCouponCents" BIGINT NOT NULL,
    "pointsAppliedTenths" BIGINT NOT NULL,
    "goodsMoneyCents" BIGINT NOT NULL,
    "shippingQuotedCents" BIGINT NOT NULL,
    "shippingChargedCents" BIGINT NOT NULL,
    "shippingSubsidyCents" BIGINT NOT NULL,
    "totalMoneyCents" BIGINT NOT NULL,
    "couponId" UUID,
    "couponSnapshot" JSONB,
    "policySnapshot" JSONB NOT NULL,
    "pricingVersion" INTEGER NOT NULL DEFAULT 1,
    "confirmedAt" TIMESTAMPTZ(3),
    "shippedAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAddress" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "sourceAddressId" UUID,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'MX',
    "postalCode" VARCHAR(5) NOT NULL,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "exteriorNumber" TEXT NOT NULL,
    "interiorNumber" TEXT,
    "references" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPackage" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "packageTypeId" UUID,
    "quoteId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "originSnapshot" JSONB NOT NULL,
    "packageCodeSnapshot" TEXT NOT NULL,
    "weightGrams" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "packingPlanSnapshot" JSONB NOT NULL,
    "carrierSnapshot" JSONB NOT NULL,
    "serviceSnapshot" JSONB NOT NULL,
    "deliveryEstimateSnapshot" JSONB NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "variantId" UUID,
    "bundleId" UUID,
    "kind" "OrderLineKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "skuOrCodeSnapshot" TEXT NOT NULL,
    "unitPriceCents" BIGINT NOT NULL,
    "lineBeforeCouponCents" BIGINT NOT NULL,
    "couponDiscountCents" BIGINT NOT NULL,
    "lineAfterCouponCents" BIGINT NOT NULL,
    "compositionVersionSnapshot" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderComponent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantityPerLineUnit" INTEGER NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "productSnapshot" JSONB NOT NULL,
    "variantSnapshot" JSONB NOT NULL,
    "referenceUnitPriceCents" BIGINT NOT NULL,
    "allocatedBaseCents" BIGINT NOT NULL,
    "allocatedCouponCents" BIGINT NOT NULL,
    "allocatedNetCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderUnit" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderComponentId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "unitOrdinal" INTEGER NOT NULL,
    "lotId" UUID,
    "lotSnapshot" JSONB,
    "baseCents" BIGINT NOT NULL,
    "couponCents" BIGINT NOT NULL,
    "netGoodsCents" BIGINT NOT NULL,
    "pointsTenths" BIGINT NOT NULL,
    "moneyCents" BIGINT NOT NULL,
    "returnedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSet" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "state" "ReservationState" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),
    "acceptedQuoteId" UUID NOT NULL,
    "checkoutFingerprint" TEXT NOT NULL,
    "acceptedCheckoutSnapshot" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReservationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationStock" (
    "id" UUID NOT NULL,
    "reservationSetId" UUID NOT NULL,
    "lotId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReservationStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL,
    "reason" TEXT,
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "codeNormalized" TEXT NOT NULL,
    "kind" "CouponKind" NOT NULL,
    "fixedAmountCents" BIGINT,
    "percentageBasisPoints" INTEGER,
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "minimumEligibleCents" BIGINT,
    "maxUses" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "allowOffers" BOOLEAN NOT NULL DEFAULT false,
    "allowBundles" BOOLEAN NOT NULL DEFAULT false,
    "scope" "CouponScope" NOT NULL DEFAULT 'CATALOG',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponProduct" (
    "couponId" UUID NOT NULL,
    "productId" UUID NOT NULL,

    CONSTRAINT "CouponProduct_pkey" PRIMARY KEY ("couponId","productId")
);

-- CreateTable
CREATE TABLE "CouponCategory" (
    "couponId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,

    CONSTRAINT "CouponCategory_pkey" PRIMARY KEY ("couponId","categoryId")
);

-- CreateTable
CREATE TABLE "CouponUsage" (
    "id" UUID NOT NULL,
    "couponId" UUID NOT NULL,
    "reservationSetId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "identityKey" TEXT NOT NULL,
    "userId" UUID,
    "emailNormalizedSnapshot" TEXT NOT NULL,
    "state" "ResourceState" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CouponUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balanceTenths" BIGINT NOT NULL DEFAULT 0,
    "reservedTenths" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedgerEntry" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "orderId" UUID,
    "refundId" UUID,
    "kind" "LoyaltyEntryKind" NOT NULL,
    "deltaTenths" BIGINT NOT NULL,
    "balanceAfterTenths" BIGINT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "actorId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointReservation" (
    "id" UUID NOT NULL,
    "reservationSetId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "amountTenths" BIGINT NOT NULL,
    "state" "ResourceState" NOT NULL DEFAULT 'RESERVED',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "PointReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "reservationSetId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'STRIPE',
    "providerSessionId" TEXT,
    "providerPaymentIntentId" TEXT,
    "providerChargeId" TEXT,
    "amountCents" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "appliedToOrder" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "providerPaidAt" TIMESTAMPTZ(3),
    "lastReconciledAt" TIMESTAMPTZ(3),
    "failureCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'STRIPE',
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "payloadDigest" TEXT NOT NULL,
    "safePayload" JSONB NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentAttemptId" UUID,
    "returnRequestId" UUID,
    "priceMatchRequestId" UUID,
    "kind" "RefundKind" NOT NULL,
    "requestedMoneyCents" BIGINT NOT NULL,
    "requestedPointsTenths" BIGINT NOT NULL,
    "shippingRefundCents" BIGINT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundAllocation" (
    "id" UUID NOT NULL,
    "refundId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderUnitId" UUID,
    "kind" "RefundAllocationKind" NOT NULL,
    "moneyCents" BIGINT NOT NULL,
    "pointsTenths" BIGINT NOT NULL,
    "benefitReductionCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RefundAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestedByUserId" UUID,
    "guestProofId" UUID,
    "reasonCode" "ReturnReason" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "decisionReason" TEXT,
    "receivedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "storeFault" BOOLEAN NOT NULL DEFAULT false,
    "returnCostPayer" "ReturnCostPayer" NOT NULL,
    "returnCostCents" BIGINT,
    "returnLogisticsNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" UUID NOT NULL,
    "returnRequestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderUnitId" UUID NOT NULL,
    "state" "ReturnItemState" NOT NULL DEFAULT 'REQUESTED',
    "reportedCondition" "ProductCondition",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnInspection" (
    "id" UUID NOT NULL,
    "returnItemId" UUID NOT NULL,
    "inspectedById" UUID NOT NULL,
    "inspectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condition" "ProductCondition" NOT NULL,
    "disposition" "ReturnDisposition" NOT NULL,
    "notes" TEXT NOT NULL,
    "stockMovementKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReturnInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMatchRequest" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestedByUserId" UUID,
    "guestProofId" UUID,
    "status" "PriceMatchStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "decisionReason" TEXT,
    "comparisonSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PriceMatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceMatchItem" (
    "id" UUID NOT NULL,
    "priceMatchRequestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderUnitId" UUID NOT NULL,
    "competitorItemCents" BIGINT NOT NULL,
    "competitorShippingAllocatedCents" BIGINT NOT NULL,
    "approvedDifferenceCents" BIGINT,
    "moneyRefundCents" BIGINT,
    "pointsRefundTenths" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PriceMatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" UUID NOT NULL,
    "returnRequestId" UUID,
    "priceMatchRequestId" UUID,
    "assetId" UUID,
    "externalUrl" TEXT,
    "description" TEXT,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "verifiedOrderUnitId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMPTZ(3),
    "hiddenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewModeration" (
    "id" UUID NOT NULL,
    "reviewId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "action" "ReviewModerationAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewModeration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestockSubscription" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "userId" UUID,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "unsubscribeTokenHash" TEXT NOT NULL,
    "state" "RestockState" NOT NULL DEFAULT 'ACTIVE',
    "notifiedAt" TIMESTAMPTZ(3),
    "canceledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RestockSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxMessage" (
    "id" UUID NOT NULL,
    "kind" "OutboxKind" NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OutboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "reason" TEXT,
    "safeBefore" JSONB,
    "safeAfter" JSONB,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" UUID NOT NULL,
    "singletonKey" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "serviceHours" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "businessTimezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3),
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenFamilyId_key" ON "AuthSession"("tokenFamilyId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_absoluteExpiresAt_idx" ON "AuthSession"("userId", "revokedAt", "absoluteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_tokenHash_key" ON "RefreshCredential"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshCredential_replacedById_key" ON "RefreshCredential"("replacedById");

-- CreateIndex
CREATE INDEX "RefreshCredential_sessionId_idx" ON "RefreshCredential"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActionToken_purpose_expiresAt_consumedAt_idx" ON "ActionToken"("purpose", "expiresAt", "consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_id_orderId_key" ON "ActionToken"("id", "orderId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_position_idx" ON "Category"("parentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Product_deletedAt_publishedAt_idx" ON "Product"("deletedAt", "publishedAt");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Facet_kind_slug_key" ON "Facet"("kind", "slug");

-- CreateIndex
CREATE INDEX "ProductFacet_facetId_idx" ON "ProductFacet"("facetId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_priceCents_idx" ON "ProductVariant"("productId", "priceCents");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_productId_flavorNormalized_presentationNorma_key" ON "ProductVariant"("productId", "flavorNormalized", "presentationNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_id_productId_key" ON "ProductVariant"("id", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "ProductMedia_productId_position_idx" ON "ProductMedia"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductMedia_variantId_idx" ON "ProductMedia"("variantId");

-- CreateIndex
CREATE INDEX "ProductRelation_targetProductId_idx" ON "ProductRelation"("targetProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_code_key" ON "Bundle"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Bundle_slug_key" ON "Bundle"("slug");

-- CreateIndex
CREATE INDEX "BundleComponent_variantId_idx" ON "BundleComponent"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_singletonKey_key" ON "Warehouse"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "PackageType_code_key" ON "PackageType"("code");

-- CreateIndex
CREATE INDEX "InventoryLot_variantId_warehouseId_isBlocked_expiresOn_id_idx" ON "InventoryLot"("variantId", "warehouseId", "isBlocked", "expiresOn", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_variantId_warehouseId_lotCode_key" ON "InventoryLot"("variantId", "warehouseId", "lotCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_id_variantId_key" ON "InventoryLot"("id", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMovement_idempotencyKey_key" ON "InventoryMovement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "InventoryMovement_lotId_createdAt_id_idx" ON "InventoryMovement"("lotId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_guestTokenHash_key" ON "Cart"("guestTokenHash");

-- CreateIndex
CREATE INDEX "Cart_userId_status_idx" ON "Cart"("userId", "status");

-- CreateIndex
CREATE INDEX "CartItem_cartId_state_position_idx" ON "CartItem"("cartId", "state", "position");

-- CreateIndex
CREATE INDEX "ShippingQuote_cartId_requestFingerprint_idx" ON "ShippingQuote"("cartId", "requestFingerprint");

-- CreateIndex
CREATE INDEX "ShippingQuote_orderId_idx" ON "ShippingQuote"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingQuote_provider_providerQuoteId_key" ON "ShippingQuote"("provider", "providerQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_id_idx" ON "Order"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Order_buyerEmailNormalized_userId_idx" ON "Order"("buyerEmailNormalized", "userId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_id_userId_key" ON "Order"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAddress_orderId_key" ON "OrderAddress"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPackage_orderId_key" ON "OrderPackage"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_id_orderId_key" ON "OrderLine"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderLine_orderId_position_key" ON "OrderLine"("orderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "OrderComponent_orderLineId_variantId_key" ON "OrderComponent"("orderLineId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderComponent_id_orderId_key" ON "OrderComponent"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderComponent_id_variantId_key" ON "OrderComponent"("id", "variantId");

-- CreateIndex
CREATE INDEX "OrderUnit_lotId_idx" ON "OrderUnit"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderUnit_orderComponentId_unitOrdinal_key" ON "OrderUnit"("orderComponentId", "unitOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "OrderUnit_id_orderId_key" ON "OrderUnit"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSet_idempotencyKey_key" ON "ReservationSet"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ReservationSet_state_expiresAt_idx" ON "ReservationSet"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSet_orderId_attemptNumber_key" ON "ReservationSet"("orderId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSet_id_orderId_key" ON "ReservationSet"("id", "orderId");

-- CreateIndex
CREATE INDEX "ReservationStock_lotId_reservationSetId_idx" ON "ReservationStock"("lotId", "reservationSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationStock_reservationSetId_lotId_key" ON "ReservationStock"("reservationSetId", "lotId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderStatusHistory_eventKey_key" ON "OrderStatusHistory"("eventKey");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_codeNormalized_key" ON "Coupon"("codeNormalized");

-- CreateIndex
CREATE INDEX "CouponProduct_productId_idx" ON "CouponProduct"("productId");

-- CreateIndex
CREATE INDEX "CouponCategory_categoryId_idx" ON "CouponCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponUsage_reservationSetId_key" ON "CouponUsage"("reservationSetId");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_state_idx" ON "CouponUsage"("couponId", "state");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_identityKey_state_idx" ON "CouponUsage"("couponId", "identityKey", "state");

-- CreateIndex
CREATE INDEX "CouponUsage_couponId_emailNormalizedSnapshot_state_idx" ON "CouponUsage"("couponId", "emailNormalizedSnapshot", "state");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_userId_key" ON "LoyaltyAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_id_userId_key" ON "LoyaltyAccount"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyLedgerEntry_idempotencyKey_key" ON "LoyaltyLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_accountId_createdAt_id_idx" ON "LoyaltyLedgerEntry"("accountId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PointReservation_reservationSetId_key" ON "PointReservation"("reservationSetId");

-- CreateIndex
CREATE INDEX "PointReservation_accountId_state_idx" ON "PointReservation"("accountId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerSessionId_key" ON "PaymentAttempt"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerPaymentIntentId_key" ON "PaymentAttempt"("providerPaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerChargeId_key" ON "PaymentAttempt"("providerChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_status_idx" ON "PaymentAttempt"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_id_orderId_key" ON "PaymentAttempt"("id", "orderId");

-- CreateIndex
CREATE INDEX "ProviderEvent_status_receivedAt_idx" ON "ProviderEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderEvent_provider_externalEventId_key" ON "ProviderEvent"("provider", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerRefundId_key" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Refund_orderId_requestedAt_idx" ON "Refund"("orderId", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_orderId_key" ON "Refund"("id", "orderId");

-- CreateIndex
CREATE INDEX "RefundAllocation_orderUnitId_idx" ON "RefundAllocation"("orderUnitId");

-- CreateIndex
CREATE INDEX "RefundAllocation_refundId_idx" ON "RefundAllocation"("refundId");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_requestedAt_idx" ON "ReturnRequest"("orderId", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_id_orderId_key" ON "ReturnRequest"("id", "orderId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderUnitId_idx" ON "ReturnItem"("orderUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnItem_returnRequestId_orderUnitId_key" ON "ReturnItem"("returnRequestId", "orderUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnInspection_returnItemId_key" ON "ReturnInspection"("returnItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnInspection_stockMovementKey_key" ON "ReturnInspection"("stockMovementKey");

-- CreateIndex
CREATE INDEX "PriceMatchRequest_orderId_requestedAt_idx" ON "PriceMatchRequest"("orderId", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriceMatchRequest_id_orderId_key" ON "PriceMatchRequest"("id", "orderId");

-- CreateIndex
CREATE INDEX "PriceMatchItem_orderUnitId_idx" ON "PriceMatchItem"("orderUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceMatchItem_priceMatchRequestId_orderUnitId_key" ON "PriceMatchItem"("priceMatchRequestId", "orderUnitId");

-- CreateIndex
CREATE INDEX "Review_productId_hiddenAt_createdAt_idx" ON "Review"("productId", "hiddenAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_userId_productId_key" ON "Review"("userId", "productId");

-- CreateIndex
CREATE INDEX "ReviewModeration_reviewId_createdAt_idx" ON "ReviewModeration"("reviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RestockSubscription_unsubscribeTokenHash_key" ON "RestockSubscription"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "RestockSubscription_variantId_state_idx" ON "RestockSubscription"("variantId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxMessage_deduplicationKey_key" ON "OutboxMessage"("deduplicationKey");

-- CreateIndex
CREATE INDEX "OutboxMessage_state_nextAttemptAt_idx" ON "OutboxMessage"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoreSettings_singletonKey_key" ON "StoreSettings"("singletonKey");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "RefreshCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFacet" ADD CONSTRAINT "ProductFacet_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFacet" ADD CONSTRAINT "ProductFacet_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "Facet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_variantId_productId_fkey" FOREIGN KEY ("variantId", "productId") REFERENCES "ProductVariant"("id", "productId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_certificateAssetId_fkey" FOREIGN KEY ("certificateAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reservationStockId_fkey" FOREIGN KEY ("reservationStockId") REFERENCES "ReservationStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_orderUnitId_fkey" FOREIGN KEY ("orderUnitId") REFERENCES "OrderUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_returnInspectionId_fkey" FOREIGN KEY ("returnInspectionId") REFERENCES "ReturnInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_selectedCouponId_fkey" FOREIGN KEY ("selectedCouponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sourceCartId_fkey" FOREIGN KEY ("sourceCartId") REFERENCES "Cart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_sourceAddressId_fkey" FOREIGN KEY ("sourceAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPackage" ADD CONSTRAINT "OrderPackage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPackage" ADD CONSTRAINT "OrderPackage_packageTypeId_fkey" FOREIGN KEY ("packageTypeId") REFERENCES "PackageType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPackage" ADD CONSTRAINT "OrderPackage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "ShippingQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPackage" ADD CONSTRAINT "OrderPackage_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_orderLineId_orderId_fkey" FOREIGN KEY ("orderLineId", "orderId") REFERENCES "OrderLine"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_orderComponentId_variantId_fkey" FOREIGN KEY ("orderComponentId", "variantId") REFERENCES "OrderComponent"("id", "variantId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_orderComponentId_orderId_fkey" FOREIGN KEY ("orderComponentId", "orderId") REFERENCES "OrderComponent"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_lotId_variantId_fkey" FOREIGN KEY ("lotId", "variantId") REFERENCES "InventoryLot"("id", "variantId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReservationSet" ADD CONSTRAINT "ReservationSet_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSet" ADD CONSTRAINT "ReservationSet_acceptedQuoteId_fkey" FOREIGN KEY ("acceptedQuoteId") REFERENCES "ShippingQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStock" ADD CONSTRAINT "ReservationStock_reservationSetId_fkey" FOREIGN KEY ("reservationSetId") REFERENCES "ReservationSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationStock" ADD CONSTRAINT "ReservationStock_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "InventoryLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponProduct" ADD CONSTRAINT "CouponProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCategory" ADD CONSTRAINT "CouponCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_reservationSetId_orderId_fkey" FOREIGN KEY ("reservationSetId", "orderId") REFERENCES "ReservationSet"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_reservationSetId_orderId_fkey" FOREIGN KEY ("reservationSetId", "orderId") REFERENCES "ReservationSet"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_orderId_userId_fkey" FOREIGN KEY ("orderId", "userId") REFERENCES "Order"("id", "userId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_accountId_userId_fkey" FOREIGN KEY ("accountId", "userId") REFERENCES "LoyaltyAccount"("id", "userId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_reservationSetId_orderId_fkey" FOREIGN KEY ("reservationSetId", "orderId") REFERENCES "ReservationSet"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentAttemptId_orderId_fkey" FOREIGN KEY ("paymentAttemptId", "orderId") REFERENCES "PaymentAttempt"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_returnRequestId_orderId_fkey" FOREIGN KEY ("returnRequestId", "orderId") REFERENCES "ReturnRequest"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_priceMatchRequestId_orderId_fkey" FOREIGN KEY ("priceMatchRequestId", "orderId") REFERENCES "PriceMatchRequest"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_refundId_orderId_fkey" FOREIGN KEY ("refundId", "orderId") REFERENCES "Refund"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_orderUnitId_orderId_fkey" FOREIGN KEY ("orderUnitId", "orderId") REFERENCES "OrderUnit"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_guestProofId_orderId_fkey" FOREIGN KEY ("guestProofId", "orderId") REFERENCES "ActionToken"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnRequestId_orderId_fkey" FOREIGN KEY ("returnRequestId", "orderId") REFERENCES "ReturnRequest"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderUnitId_orderId_fkey" FOREIGN KEY ("orderUnitId", "orderId") REFERENCES "OrderUnit"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_returnItemId_fkey" FOREIGN KEY ("returnItemId") REFERENCES "ReturnItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnInspection" ADD CONSTRAINT "ReturnInspection_inspectedById_fkey" FOREIGN KEY ("inspectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatchRequest" ADD CONSTRAINT "PriceMatchRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatchRequest" ADD CONSTRAINT "PriceMatchRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatchRequest" ADD CONSTRAINT "PriceMatchRequest_guestProofId_orderId_fkey" FOREIGN KEY ("guestProofId", "orderId") REFERENCES "ActionToken"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PriceMatchRequest" ADD CONSTRAINT "PriceMatchRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatchItem" ADD CONSTRAINT "PriceMatchItem_priceMatchRequestId_orderId_fkey" FOREIGN KEY ("priceMatchRequestId", "orderId") REFERENCES "PriceMatchRequest"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PriceMatchItem" ADD CONSTRAINT "PriceMatchItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceMatchItem" ADD CONSTRAINT "PriceMatchItem_orderUnitId_orderId_fkey" FOREIGN KEY ("orderUnitId", "orderId") REFERENCES "OrderUnit"("id", "orderId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_priceMatchRequestId_fkey" FOREIGN KEY ("priceMatchRequestId") REFERENCES "PriceMatchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_verifiedOrderUnitId_fkey" FOREIGN KEY ("verifiedOrderUnitId") REFERENCES "OrderUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModeration" ADD CONSTRAINT "ReviewModeration_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModeration" ADD CONSTRAINT "ReviewModeration_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockSubscription" ADD CONSTRAINT "RestockSubscription_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestockSubscription" ADD CONSTRAINT "RestockSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Reviewed SQL invariants not represented by Prisma scalar types.

ALTER TABLE "User" ADD CONSTRAINT "User_nonnegative" CHECK (("authVersion" IS NULL OR "authVersion" >= 0));
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_nonnegative" CHECK (("attemptCount" IS NULL OR "attemptCount" >= 0));
ALTER TABLE "Address" ADD CONSTRAINT "Address_mexican_address" CHECK ("countryCode" = 'MX' AND "postalCode" ~ '^[0-9]{5}$');
ALTER TABLE "Category" ADD CONSTRAINT "Category_nonnegative" CHECK (("position" IS NULL OR "position" >= 0));
ALTER TABLE "Product" ADD CONSTRAINT "Product_nonnegative" CHECK (("featuredPosition" IS NULL OR "featuredPosition" >= 0));
ALTER TABLE "Facet" ADD CONSTRAINT "Facet_nonnegative" CHECK (("position" IS NULL OR "position" >= 0));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_nonnegative" CHECK (("priceCents" IS NULL OR "priceCents" >= 0) AND ("compareAtPriceCents" IS NULL OR "compareAtPriceCents" >= 0));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_positive" CHECK (("contentAmount" IS NULL OR "contentAmount" > 0) AND ("servings" IS NULL OR "servings" > 0) AND ("servingAmount" IS NULL OR "servingAmount" > 0) AND ("priceVersion" IS NULL OR "priceVersion" > 0) AND ("weightGrams" IS NULL OR "weightGrams" > 0) AND ("lengthMm" IS NULL OR "lengthMm" > 0) AND ("widthMm" IS NULL OR "widthMm" > 0) AND ("heightMm" IS NULL OR "heightMm" > 0));
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_nonnegative" CHECK (("byteSize" IS NULL OR "byteSize" >= 0));
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_nonnegative" CHECK (("position" IS NULL OR "position" >= 0));
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_nonnegative" CHECK (("position" IS NULL OR "position" >= 0));
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_nonnegative" CHECK (("priceCents" IS NULL OR "priceCents" >= 0) AND ("featuredPosition" IS NULL OR "featuredPosition" >= 0));
ALTER TABLE "Bundle" ADD CONSTRAINT "Bundle_positive" CHECK (("compositionVersion" IS NULL OR "compositionVersion" > 0));
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_positive" CHECK (("quantity" IS NULL OR "quantity" > 0));
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_positive" CHECK (("configurationVersion" IS NULL OR "configurationVersion" > 0));
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_mexican_address" CHECK ("countryCode" = 'MX' AND "postalCode" ~ '^[0-9]{5}$');
ALTER TABLE "PackageType" ADD CONSTRAINT "PackageType_positive" CHECK (("innerLengthMm" IS NULL OR "innerLengthMm" > 0) AND ("innerWidthMm" IS NULL OR "innerWidthMm" > 0) AND ("innerHeightMm" IS NULL OR "innerHeightMm" > 0) AND ("outerLengthMm" IS NULL OR "outerLengthMm" > 0) AND ("outerWidthMm" IS NULL OR "outerWidthMm" > 0) AND ("outerHeightMm" IS NULL OR "outerHeightMm" > 0) AND ("tareWeightGrams" IS NULL OR "tareWeightGrams" > 0) AND ("maxGrossWeightGrams" IS NULL OR "maxGrossWeightGrams" > 0) AND ("version" IS NULL OR "version" > 0));
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_positive" CHECK (("version" IS NULL OR "version" > 0));
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_positive" CHECK (("version" IS NULL OR "version" > 0));
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_nonnegative" CHECK (("position" IS NULL OR "position" >= 0));
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_positive" CHECK (("quantity" IS NULL OR "quantity" > 0));
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_nonnegative" CHECK (("quotedAmountCents" IS NULL OR "quotedAmountCents" >= 0));
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_currency_mxn" CHECK ("currency" = 'MXN');
ALTER TABLE "Order" ADD CONSTRAINT "Order_nonnegative" CHECK (("goodsBeforeCouponCents" IS NULL OR "goodsBeforeCouponCents" >= 0) AND ("couponDiscountCents" IS NULL OR "couponDiscountCents" >= 0) AND ("goodsAfterCouponCents" IS NULL OR "goodsAfterCouponCents" >= 0) AND ("pointsAppliedTenths" IS NULL OR "pointsAppliedTenths" >= 0) AND ("goodsMoneyCents" IS NULL OR "goodsMoneyCents" >= 0) AND ("shippingQuotedCents" IS NULL OR "shippingQuotedCents" >= 0) AND ("shippingChargedCents" IS NULL OR "shippingChargedCents" >= 0) AND ("shippingSubsidyCents" IS NULL OR "shippingSubsidyCents" >= 0) AND ("totalMoneyCents" IS NULL OR "totalMoneyCents" >= 0));
ALTER TABLE "Order" ADD CONSTRAINT "Order_positive" CHECK (("pricingVersion" IS NULL OR "pricingVersion" > 0));
ALTER TABLE "Order" ADD CONSTRAINT "Order_currency_mxn" CHECK ("currency" = 'MXN');
ALTER TABLE "OrderAddress" ADD CONSTRAINT "OrderAddress_mexican_address" CHECK ("countryCode" = 'MX' AND "postalCode" ~ '^[0-9]{5}$');
ALTER TABLE "OrderPackage" ADD CONSTRAINT "OrderPackage_positive" CHECK (("weightGrams" IS NULL OR "weightGrams" > 0) AND ("lengthMm" IS NULL OR "lengthMm" > 0) AND ("widthMm" IS NULL OR "widthMm" > 0) AND ("heightMm" IS NULL OR "heightMm" > 0));
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_nonnegative" CHECK (("position" IS NULL OR "position" >= 0) AND ("unitPriceCents" IS NULL OR "unitPriceCents" >= 0) AND ("lineBeforeCouponCents" IS NULL OR "lineBeforeCouponCents" >= 0) AND ("couponDiscountCents" IS NULL OR "couponDiscountCents" >= 0) AND ("lineAfterCouponCents" IS NULL OR "lineAfterCouponCents" >= 0));
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_positive" CHECK (("quantity" IS NULL OR "quantity" > 0) AND ("compositionVersionSnapshot" IS NULL OR "compositionVersionSnapshot" > 0));
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_nonnegative" CHECK (("referenceUnitPriceCents" IS NULL OR "referenceUnitPriceCents" >= 0) AND ("allocatedBaseCents" IS NULL OR "allocatedBaseCents" >= 0) AND ("allocatedCouponCents" IS NULL OR "allocatedCouponCents" >= 0) AND ("allocatedNetCents" IS NULL OR "allocatedNetCents" >= 0));
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_positive" CHECK (("quantityPerLineUnit" IS NULL OR "quantityPerLineUnit" > 0) AND ("totalQuantity" IS NULL OR "totalQuantity" > 0));
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_nonnegative" CHECK (("baseCents" IS NULL OR "baseCents" >= 0) AND ("couponCents" IS NULL OR "couponCents" >= 0) AND ("netGoodsCents" IS NULL OR "netGoodsCents" >= 0) AND ("pointsTenths" IS NULL OR "pointsTenths" >= 0) AND ("moneyCents" IS NULL OR "moneyCents" >= 0));
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_positive" CHECK (("unitOrdinal" IS NULL OR "unitOrdinal" > 0));
ALTER TABLE "ReservationSet" ADD CONSTRAINT "ReservationSet_positive" CHECK (("attemptNumber" IS NULL OR "attemptNumber" > 0));
ALTER TABLE "ReservationStock" ADD CONSTRAINT "ReservationStock_positive" CHECK (("quantity" IS NULL OR "quantity" > 0));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_nonnegative" CHECK (("fixedAmountCents" IS NULL OR "fixedAmountCents" >= 0) AND ("minimumEligibleCents" IS NULL OR "minimumEligibleCents" >= 0));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_positive" CHECK (("maxUses" IS NULL OR "maxUses" > 0) AND ("maxUsesPerCustomer" IS NULL OR "maxUsesPerCustomer" > 0) AND ("version" IS NULL OR "version" > 0));
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_nonnegative" CHECK (("reservedTenths" IS NULL OR "reservedTenths" >= 0));
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_positive" CHECK (("version" IS NULL OR "version" > 0));
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_nonnegative" CHECK (("amountTenths" IS NULL OR "amountTenths" >= 0));
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_nonnegative" CHECK (("amountCents" IS NULL OR "amountCents" >= 0));
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_currency_mxn" CHECK ("currency" = 'MXN');
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_nonnegative" CHECK (("requestedMoneyCents" IS NULL OR "requestedMoneyCents" >= 0) AND ("requestedPointsTenths" IS NULL OR "requestedPointsTenths" >= 0) AND ("shippingRefundCents" IS NULL OR "shippingRefundCents" >= 0));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_currency_mxn" CHECK ("currency" = 'MXN');
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_nonnegative" CHECK (("moneyCents" IS NULL OR "moneyCents" >= 0) AND ("pointsTenths" IS NULL OR "pointsTenths" >= 0) AND ("benefitReductionCents" IS NULL OR "benefitReductionCents" >= 0));
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_nonnegative" CHECK (("returnCostCents" IS NULL OR "returnCostCents" >= 0));
ALTER TABLE "PriceMatchItem" ADD CONSTRAINT "PriceMatchItem_nonnegative" CHECK (("competitorItemCents" IS NULL OR "competitorItemCents" >= 0) AND ("competitorShippingAllocatedCents" IS NULL OR "competitorShippingAllocatedCents" >= 0) AND ("approvedDifferenceCents" IS NULL OR "approvedDifferenceCents" >= 0) AND ("moneyRefundCents" IS NULL OR "moneyRefundCents" >= 0) AND ("pointsRefundTenths" IS NULL OR "pointsRefundTenths" >= 0));
ALTER TABLE "OutboxMessage" ADD CONSTRAINT "OutboxMessage_nonnegative" CHECK (("attempts" IS NULL OR "attempts" >= 0));
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_positive" CHECK (("policyVersion" IS NULL OR "policyVersion" > 0));
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_positive" CHECK (("version" IS NULL OR "version" > 0));
ALTER TABLE "User" ADD CONSTRAINT "User_normalized_email" CHECK ("emailNormalized" = lower(btrim("email")) AND length("emailNormalized") > 0);
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_session_window" CHECK ("absoluteExpiresAt" > "createdAt" AND "absoluteExpiresAt" <= "createdAt" + interval '7 days');
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_purpose_target" CHECK (("purpose" = 'GUEST_ORDER_ACCESS' AND "orderId" IS NOT NULL AND "userId" IS NULL) OR ("purpose" IN ('VERIFY_EMAIL', 'RESET_PASSWORD') AND "userId" IS NOT NULL AND "orderId" IS NULL));
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_token_window" CHECK ("expiresAt" > "createdAt" AND ("purpose" <> 'RESET_PASSWORD' OR "expiresAt" <= "createdAt" + interval '30 minutes'));
ALTER TABLE "RefreshCredential" ADD CONSTRAINT "RefreshCredential_token_window" CHECK ("expiresAt" > "createdAt" AND "replacedById" IS DISTINCT FROM "id");
ALTER TABLE "Category" ADD CONSTRAINT "Category_not_self_parent" CHECK ("parentId" IS DISTINCT FROM "id");
ALTER TABLE "ProductRelation" ADD CONSTRAINT "ProductRelation_not_self_relation" CHECK ("sourceProductId" <> "targetProductId");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compare_price" CHECK ("compareAtPriceCents" IS NULL OR "compareAtPriceCents" > "priceCents");
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_normalized_presentation" CHECK ("flavorNormalized" = lower(btrim("flavor")) AND "presentationNormalized" = lower(btrim("presentationLabel")));
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_serving_unit" CHECK (("servingAmount" IS NULL) = ("servingUnit" IS NULL));
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_informative_alt" CHECK (length(btrim("altText")) > 0);
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_single_warehouse" CHECK ("singletonKey" = 1);
ALTER TABLE "StoreSettings" ADD CONSTRAINT "StoreSettings_single_settings" CHECK ("singletonKey" = 1);
ALTER TABLE "PackageType" ADD CONSTRAINT "PackageType_dimensions_fit" CHECK ("innerLengthMm" <= "outerLengthMm" AND "innerWidthMm" <= "outerWidthMm" AND "innerHeightMm" <= "outerHeightMm" AND ("maxGrossWeightGrams" IS NULL OR "maxGrossWeightGrams" > "tareWeightGrams"));
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_stock_bounds" CHECK ("onHandQty" >= 0 AND "reservedQty" >= 0 AND "nonSellableQty" >= 0 AND "reservedQty" <= "onHandQty");
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_expiry_precision" CHECK (("expiresOn" IS NULL) = ("expiryPrecision" IS NULL) AND ("expiryPrecision" IS DISTINCT FROM 'MONTH' OR "expiresOn" = (date_trunc('month', "expiresOn") + interval '1 month - 1 day')::date));
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actor_reason" CHECK (length(btrim("reason")) > 0 AND (("actorType" = 'SYSTEM' AND "actorId" IS NULL) OR ("actorType" <> 'SYSTEM' AND "actorId" IS NOT NULL)) AND ("kind" <> 'ADJUSTMENT' OR "actorType" = 'ADMIN'));
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_nonzero_movement" CHECK ("onHandDelta" <> 0 OR "reservedDelta" <> 0 OR "nonSellableDelta" <> 0);
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_movement_shape" CHECK (
  ("kind" = 'RESERVE' AND "onHandDelta" = 0 AND "reservedDelta" > 0 AND "nonSellableDelta" = 0 AND "reservationStockId" IS NOT NULL) OR
  ("kind" = 'RELEASE' AND "onHandDelta" = 0 AND "reservedDelta" < 0 AND "nonSellableDelta" = 0 AND "reservationStockId" IS NOT NULL) OR
  ("kind" = 'SALE' AND "onHandDelta" < 0 AND "onHandDelta" = "reservedDelta" AND "nonSellableDelta" = 0 AND "orderUnitId" IS NOT NULL) OR
  ("kind" IN ('RECEIPT', 'RETURN_SELLABLE') AND "onHandDelta" > 0 AND "reservedDelta" = 0 AND "nonSellableDelta" = 0) OR
  ("kind" = 'RETURN_NON_SELLABLE' AND "onHandDelta" = 0 AND "reservedDelta" = 0 AND "nonSellableDelta" > 0) OR
  ("kind" = 'WASTE' AND "onHandDelta" < 0 AND "reservedDelta" = 0 AND "nonSellableDelta" >= 0) OR
  ("kind" = 'ADJUSTMENT' AND "reservedDelta" = 0)
);
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_exclusive_owner" CHECK (("userId" IS NULL) <> ("guestTokenHash" IS NULL));
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_exclusive_item" CHECK (("variantId" IS NULL) <> ("bundleId" IS NULL));
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_envia_quotes_only" CHECK ("provider" = 'ENVIA' AND ("cartId" IS NOT NULL OR "orderId" IS NOT NULL));
ALTER TABLE "ShippingQuote" ADD CONSTRAINT "ShippingQuote_quote_dates" CHECK (("expiresAt" IS NULL OR "expiresAt" > "quotedAt") AND ("estimatedDeliveryFrom" IS NULL OR "estimatedDeliveryTo" IS NULL OR "estimatedDeliveryFrom" <= "estimatedDeliveryTo"));
ALTER TABLE "Order" ADD CONSTRAINT "Order_totals" CHECK ("goodsBeforeCouponCents" - "couponDiscountCents" = "goodsAfterCouponCents" AND "goodsAfterCouponCents" - "pointsAppliedTenths" = "goodsMoneyCents" AND "totalMoneyCents" = "goodsMoneyCents" + "shippingChargedCents" AND "shippingSubsidyCents" = "shippingQuotedCents" - "shippingChargedCents");
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipping_rule" CHECK (("goodsAfterCouponCents" >= 149900 AND "shippingChargedCents" = 0) OR ("goodsAfterCouponCents" < 149900 AND "shippingChargedCents" = "shippingQuotedCents"));
ALTER TABLE "Order" ADD CONSTRAINT "Order_zero_payment" CHECK ("moneyStatus" <> 'NOT_REQUIRED' OR "totalMoneyCents" = 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_guest_link" CHECK ("linkedAt" IS NULL OR "userId" IS NOT NULL);
ALTER TABLE "Order" ADD CONSTRAINT "Order_normalized_buyer" CHECK ("buyerEmailNormalized" = lower(btrim("buyerEmail")));
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_exclusive_item" CHECK (("kind" = 'VARIANT' AND "variantId" IS NOT NULL AND "bundleId" IS NULL AND "compositionVersionSnapshot" IS NULL) OR ("kind" = 'BUNDLE' AND "bundleId" IS NOT NULL AND "variantId" IS NULL AND "compositionVersionSnapshot" IS NOT NULL));
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_totals" CHECK ("lineBeforeCouponCents" = "unitPriceCents" * "quantity"::bigint AND "lineAfterCouponCents" = "lineBeforeCouponCents" - "couponDiscountCents");
ALTER TABLE "OrderComponent" ADD CONSTRAINT "OrderComponent_totals" CHECK ("allocatedNetCents" = "allocatedBaseCents" - "allocatedCouponCents");
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_totals" CHECK ("netGoodsCents" = "baseCents" - "couponCents" AND "moneyCents" + "pointsTenths" = "netGoodsCents");
ALTER TABLE "OrderUnit" ADD CONSTRAINT "OrderUnit_lot_snapshot" CHECK (("lotId" IS NULL) = ("lotSnapshot" IS NULL));
ALTER TABLE "ReservationSet" ADD CONSTRAINT "ReservationSet_payment_window" CHECK ("expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + interval '30 minutes');
ALTER TABLE "ReservationSet" ADD CONSTRAINT "ReservationSet_resolution" CHECK (("state" IN ('ACTIVE', 'RECONCILING') AND "resolvedAt" IS NULL) OR ("state" IN ('CONSUMED', 'RELEASED') AND "resolvedAt" IS NOT NULL));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_exclusive_discount" CHECK (("kind" = 'FIXED' AND "fixedAmountCents" > 0 AND "fixedAmountCents" IS NOT NULL AND "percentageBasisPoints" IS NULL) OR ("kind" = 'PERCENTAGE' AND "fixedAmountCents" IS NULL AND "percentageBasisPoints" IS NOT NULL AND "percentageBasisPoints" BETWEEN 1 AND 10000));
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_validity" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt");
ALTER TABLE "CouponUsage" ADD CONSTRAINT "CouponUsage_resource_state" CHECK (("state" = 'RESERVED' AND "consumedAt" IS NULL AND "releasedAt" IS NULL) OR ("state" = 'CONSUMED' AND "consumedAt" IS NOT NULL AND "releasedAt" IS NULL) OR ("state" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "consumedAt" IS NULL));
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_resource_state" CHECK (("state" = 'RESERVED' AND "consumedAt" IS NULL AND "releasedAt" IS NULL) OR ("state" = 'CONSUMED' AND "consumedAt" IS NOT NULL AND "releasedAt" IS NULL) OR ("state" = 'RELEASED' AND "releasedAt" IS NOT NULL AND "consumedAt" IS NULL));
ALTER TABLE "PointReservation" ADD CONSTRAINT "PointReservation_positive_amount" CHECK ("amountTenths" > 0);
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_stripe_payment" CHECK ("provider" = 'STRIPE' AND "amountCents" > 0 AND (NOT "appliedToOrder" OR ("status" = 'SUCCEEDED' AND "providerPaidAt" IS NOT NULL)));
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_origin" CHECK (
  ("kind" = 'CANCELLATION' AND "returnRequestId" IS NULL AND "priceMatchRequestId" IS NULL) OR
  ("kind" = 'RETURN' AND "returnRequestId" IS NOT NULL AND "priceMatchRequestId" IS NULL) OR
  ("kind" = 'PRICE_MATCH' AND "priceMatchRequestId" IS NOT NULL AND "returnRequestId" IS NULL AND "shippingRefundCents" = 0) OR
  ("kind" = 'COMPENSATION' AND "paymentAttemptId" IS NOT NULL AND "returnRequestId" IS NULL AND "priceMatchRequestId" IS NULL AND "requestedPointsTenths" = 0 AND "shippingRefundCents" = 0)
);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_payment_required" CHECK ("requestedMoneyCents" = 0 OR "paymentAttemptId" IS NOT NULL);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_positive_refund" CHECK ("requestedMoneyCents" > 0 OR "requestedPointsTenths" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_shipping_amount" CHECK ("shippingRefundCents" <= "requestedMoneyCents");
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_allocation_target" CHECK (("kind" = 'UNIT' AND "orderUnitId" IS NOT NULL) OR ("kind" = 'SHIPPING' AND "orderUnitId" IS NULL AND "pointsTenths" = 0 AND "benefitReductionCents" = 0));
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_positive_amount" CHECK ("moneyCents" > 0 OR "pointsTenths" > 0);
ALTER TABLE "RefundAllocation" ADD CONSTRAINT "RefundAllocation_benefit_amount" CHECK ("kind" <> 'UNIT' OR "benefitReductionCents" = "moneyCents" + "pointsTenths");
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_exclusive_actor" CHECK (("requestedByUserId" IS NULL) <> ("guestProofId" IS NULL));
ALTER TABLE "PriceMatchRequest" ADD CONSTRAINT "PriceMatchRequest_exclusive_actor" CHECK (("requestedByUserId" IS NULL) <> ("guestProofId" IS NULL));
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_exclusive_claim" CHECK (("returnRequestId" IS NULL) <> ("priceMatchRequestId" IS NULL));
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_evidence_present" CHECK ("assetId" IS NOT NULL OR ("externalUrl" IS NOT NULL AND length(btrim("externalUrl")) > 0));
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5 AND length(btrim("body")) > 0);
ALTER TABLE "ReviewModeration" ADD CONSTRAINT "ReviewModeration_reason_required" CHECK (length(btrim("reason")) > 0);
ALTER TABLE "RestockSubscription" ADD CONSTRAINT "RestockSubscription_normalized_email" CHECK ("emailNormalized" = lower(btrim("email")));
CREATE UNIQUE INDEX "Address_one_default_per_user" ON "Address" ("userId") WHERE "isDefault";
CREATE UNIQUE INDEX "ProductCategory_one_primary_per_product" ON "ProductCategory" ("productId") WHERE "isPrimary";
CREATE UNIQUE INDEX "Cart_one_active_per_user" ON "Cart" ("userId") WHERE "status" = 'ACTIVE' AND "userId" IS NOT NULL;
CREATE UNIQUE INDEX "CartItem_variant_state_unique" ON "CartItem" ("cartId", "variantId", "state") WHERE "variantId" IS NOT NULL;
CREATE UNIQUE INDEX "CartItem_bundle_state_unique" ON "CartItem" ("cartId", "bundleId", "state") WHERE "bundleId" IS NOT NULL;
CREATE UNIQUE INDEX "ReservationSet_one_held_per_order" ON "ReservationSet" ("orderId") WHERE "state" IN ('ACTIVE', 'RECONCILING');
CREATE UNIQUE INDEX "CouponUsage_one_consumed_per_order" ON "CouponUsage" ("orderId") WHERE "state" = 'CONSUMED';
CREATE UNIQUE INDEX "PaymentAttempt_one_applied_per_order" ON "PaymentAttempt" ("orderId") WHERE "appliedToOrder";
CREATE UNIQUE INDEX "ReturnItem_one_nonrejected_per_unit" ON "ReturnItem" ("orderUnitId") WHERE "state" <> 'REJECTED';
CREATE UNIQUE INDEX "RestockSubscription_one_active_per_variant_email" ON "RestockSubscription" ("variantId", "emailNormalized") WHERE "state" IN ('ACTIVE', 'PROCESSING');
CREATE UNIQUE INDEX "LoyaltyLedgerEntry_one_earning_per_order" ON "LoyaltyLedgerEntry" ("orderId") WHERE "kind" = 'EARN' AND "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "RefundAllocation_one_unit_per_refund" ON "RefundAllocation" ("refundId", "orderUnitId") WHERE "orderUnitId" IS NOT NULL;
CREATE UNIQUE INDEX "RefundAllocation_one_shipping_per_refund" ON "RefundAllocation" ("refundId") WHERE "kind" = 'SHIPPING';
-- Cross-table invariants and immutable history. No external service calls.

CREATE FUNCTION reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Historical records are append-only: %', TG_TABLE_NAME USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER inventory_history_immutable BEFORE UPDATE OR DELETE ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER loyalty_history_immutable BEFORE UPDATE OR DELETE ON "LoyaltyLedgerEntry" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER order_history_immutable BEFORE UPDATE OR DELETE ON "OrderStatusHistory" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER audit_history_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();
CREATE TRIGGER moderation_history_immutable BEFORE UPDATE OR DELETE ON "ReviewModeration" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE FUNCTION check_admin_actor() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
  actor := (to_jsonb(NEW) ->> CASE TG_TABLE_NAME
    WHEN 'ReviewModeration' THEN 'adminId'
    WHEN 'ReturnInspection' THEN 'inspectedById'
    WHEN 'StoreSettings' THEN 'updatedById'
    WHEN 'ContentPage' THEN 'updatedById'
    ELSE 'actorId' END)::uuid;
  IF actor IS NOT NULL AND (TG_TABLE_NAME IN ('ReviewModeration', 'ReturnInspection', 'StoreSettings', 'ContentPage') OR to_jsonb(NEW)->>'actorType' = 'ADMIN') THEN
    IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = actor AND role = 'ADMIN' AND "deletedAt" IS NULL) THEN
      RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_admin BEFORE INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION check_admin_actor();
CREATE TRIGGER moderation_admin BEFORE INSERT ON "ReviewModeration" FOR EACH ROW EXECUTE FUNCTION check_admin_actor();
CREATE TRIGGER inspection_admin BEFORE INSERT OR UPDATE ON "ReturnInspection" FOR EACH ROW EXECUTE FUNCTION check_admin_actor();
CREATE TRIGGER settings_admin BEFORE INSERT OR UPDATE ON "StoreSettings" FOR EACH ROW EXECUTE FUNCTION check_admin_actor();
CREATE TRIGGER content_admin BEFORE INSERT OR UPDATE ON "ContentPage" FOR EACH ROW EXECUTE FUNCTION check_admin_actor();

CREATE FUNCTION guard_inventory_counters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."onHandQty" <> 0 OR NEW."reservedQty" <> 0 OR NEW."nonSellableQty" <> 0 THEN
      RAISE EXCEPTION 'Initial stock must be recorded through InventoryMovement' USING ERRCODE = '23514';
    END IF;
  ELSIF pg_trigger_depth() = 1 AND
    (NEW."onHandQty", NEW."reservedQty", NEW."nonSellableQty") IS DISTINCT FROM
    (OLD."onHandQty", OLD."reservedQty", OLD."nonSellableQty") THEN
    RAISE EXCEPTION 'Stock counters are ledger projections' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_counter_guard BEFORE INSERT OR UPDATE ON "InventoryLot" FOR EACH ROW EXECUTE FUNCTION guard_inventory_counters();

CREATE FUNCTION apply_inventory_movement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE lot "InventoryLot"%ROWTYPE; reservation "ReservationStock"%ROWTYPE;
BEGIN
  SELECT * INTO lot FROM "InventoryLot" WHERE id = NEW."lotId" FOR UPDATE;
  IF NEW.kind = 'RESERVE' THEN
    IF lot."isBlocked" OR EXISTS (
      SELECT 1 FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE v.id = lot."variantId" AND (v."deletedAt" IS NOT NULL OR p."deletedAt" IS NOT NULL OR p."publishedAt" IS NULL)
    ) OR (lot."expiresOn" IS NOT NULL AND lot."expiresOn" < (
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE timezone)::date FROM "Warehouse" WHERE id = lot."warehouseId"
    )) THEN RAISE EXCEPTION 'Lot is not sellable' USING ERRCODE = '23514'; END IF;
  END IF;
  -- The UPDATE locks this lot; its CHECK rejects overselling/negative balances.
  IF NEW."reservationStockId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ReservationStock" WHERE id = NEW."reservationStockId" AND "lotId" = NEW."lotId"
  ) THEN RAISE EXCEPTION 'Reservation stock belongs to another lot' USING ERRCODE = '23514'; END IF;
  IF NEW.kind IN ('RESERVE', 'RELEASE') THEN
    SELECT * INTO reservation FROM "ReservationStock" WHERE id = NEW."reservationStockId";
    IF abs(NEW."reservedDelta"::bigint) <> reservation.quantity THEN
      RAISE EXCEPTION 'Movement quantity must match reservation stock' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."orderUnitId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "OrderUnit" WHERE id = NEW."orderUnitId" AND "lotId" = NEW."lotId"
  ) THEN RAISE EXCEPTION 'Order unit belongs to another lot' USING ERRCODE = '23514'; END IF;
  IF NEW.kind = 'SALE' AND (NEW."reservationStockId" IS NULL OR NOT EXISTS (
    SELECT 1 FROM "ReservationStock" s JOIN "ReservationSet" r ON r.id = s."reservationSetId"
      JOIN "OrderUnit" u ON u."orderId" = r."orderId"
    WHERE s.id = NEW."reservationStockId" AND u.id = NEW."orderUnitId" AND s."lotId" = u."lotId"
  )) THEN RAISE EXCEPTION 'Sale must consume a reservation of the same order and lot' USING ERRCODE = '23514'; END IF;
  IF NEW.kind = 'SALE' AND NEW."onHandDelta" <> -1 THEN
    RAISE EXCEPTION 'Sale movement represents exactly one physical unit' USING ERRCODE = '23514';
  END IF;
  IF NEW."returnInspectionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ReturnInspection" i JOIN "ReturnItem" r ON r.id = i."returnItemId"
    JOIN "OrderUnit" u ON u.id = r."orderUnitId"
    WHERE i.id = NEW."returnInspectionId" AND u."lotId" = NEW."lotId"
  ) THEN RAISE EXCEPTION 'Inspection belongs to another lot' USING ERRCODE = '23514'; END IF;
  IF NEW.kind IN ('RETURN_SELLABLE', 'RETURN_NON_SELLABLE') AND NEW."returnInspectionId" IS NULL AND NEW."orderUnitId" IS NULL THEN
    RAISE EXCEPTION 'Restoration requires a unit or inspection' USING ERRCODE = '23514';
  END IF;
  UPDATE "InventoryLot" SET
    "onHandQty" = "onHandQty" + NEW."onHandDelta",
    "reservedQty" = "reservedQty" + NEW."reservedDelta",
    "nonSellableQty" = "nonSellableQty" + NEW."nonSellableDelta",
    version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = NEW."lotId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER inventory_projection AFTER INSERT ON "InventoryMovement" FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();
CREATE UNIQUE INDEX "InventoryMovement_sale_unit_unique" ON "InventoryMovement" ("orderUnitId") WHERE kind = 'SALE';
CREATE UNIQUE INDEX "InventoryMovement_reserve_once" ON "InventoryMovement" ("reservationStockId") WHERE kind = 'RESERVE';
CREATE UNIQUE INDEX "InventoryMovement_release_once" ON "InventoryMovement" ("reservationStockId") WHERE kind = 'RELEASE';
CREATE UNIQUE INDEX "InventoryMovement_return_inspection_unique" ON "InventoryMovement" ("returnInspectionId") WHERE kind IN ('RETURN_SELLABLE', 'RETURN_NON_SELLABLE');
CREATE UNIQUE INDEX "InventoryMovement_cancel_unit_unique" ON "InventoryMovement" ("orderUnitId") WHERE kind = 'RETURN_SELLABLE' AND "returnInspectionId" IS NULL;

CREATE FUNCTION apply_loyalty_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account "LoyaltyAccount"%ROWTYPE;
BEGIN
  SELECT * INTO account FROM "LoyaltyAccount" WHERE id = NEW."accountId" FOR UPDATE;
  IF NEW.kind = 'ADJUSTMENT' AND (NEW."actorId" IS NULL OR length(btrim(NEW.reason)) = 0 OR NOT EXISTS (
    SELECT 1 FROM "User" WHERE id = NEW."actorId" AND role = 'ADMIN' AND "deletedAt" IS NULL
  )) THEN RAISE EXCEPTION 'Loyalty adjustment requires administrator and reason' USING ERRCODE = '23514'; END IF;
  IF NEW."orderId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Order" WHERE id = NEW."orderId" AND "userId" = account."userId") THEN
    RAISE EXCEPTION 'Loyalty account does not own order' USING ERRCODE = '23514';
  END IF;
  IF NEW."refundId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Refund" WHERE id = NEW."refundId" AND "orderId" = NEW."orderId") THEN
    RAISE EXCEPTION 'Loyalty refund does not belong to order' USING ERRCODE = '23514';
  END IF;
  IF NEW."balanceAfterTenths" <> account."balanceTenths" + NEW."deltaTenths" THEN
    RAISE EXCEPTION 'Incorrect ledger running balance' USING ERRCODE = '23514';
  END IF;
  UPDATE "LoyaltyAccount" SET "balanceTenths" = NEW."balanceAfterTenths", version = version + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = account.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_projection AFTER INSERT ON "LoyaltyLedgerEntry" FOR EACH ROW EXECUTE FUNCTION apply_loyalty_entry();

CREATE FUNCTION guard_loyalty_counters() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."balanceTenths" <> 0 OR NEW."reservedTenths" <> 0 THEN
      RAISE EXCEPTION 'Initial loyalty balance must be recorded in ledger' USING ERRCODE = '23514';
    END IF;
  ELSIF pg_trigger_depth() = 1 AND
    (NEW."balanceTenths", NEW."reservedTenths") IS DISTINCT FROM (OLD."balanceTenths", OLD."reservedTenths") THEN
    RAISE EXCEPTION 'Loyalty counters are ledger and reservation projections' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_counter_guard BEFORE INSERT OR UPDATE ON "LoyaltyAccount" FOR EACH ROW EXECUTE FUNCTION guard_loyalty_counters();

CREATE FUNCTION apply_point_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account "LoyaltyAccount"%ROWTYPE; delta bigint;
BEGIN
  SELECT * INTO account FROM "LoyaltyAccount" WHERE id = NEW."accountId" FOR UPDATE;
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'RESERVED' THEN RAISE EXCEPTION 'Point reservation must start reserved' USING ERRCODE = '23514'; END IF;
    delta := NEW."amountTenths";
  ELSE
    IF (NEW."accountId", NEW."amountTenths", NEW."reservationSetId", NEW."orderId", NEW."userId", NEW."expiresAt") IS DISTINCT FROM
      (OLD."accountId", OLD."amountTenths", OLD."reservationSetId", OLD."orderId", OLD."userId", OLD."expiresAt") OR
      (NEW.state <> OLD.state AND OLD.state <> 'RESERVED') THEN
      RAISE EXCEPTION 'Point reservation identity and terminal state are immutable' USING ERRCODE = '23514';
    END IF;
    delta := CASE WHEN OLD.state = 'RESERVED' AND NEW.state <> 'RESERVED' THEN -NEW."amountTenths" ELSE 0 END;
  END IF;
  IF delta > 0 AND account."balanceTenths" - account."reservedTenths" < delta THEN
    RAISE EXCEPTION 'Insufficient available points' USING ERRCODE = '23514';
  END IF;
  UPDATE "LoyaltyAccount" SET "reservedTenths" = "reservedTenths" + delta, version = version + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = account.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER point_reservation_projection AFTER INSERT OR UPDATE ON "PointReservation" FOR EACH ROW EXECUTE FUNCTION apply_point_reservation();
CREATE TRIGGER point_reservation_no_delete BEFORE DELETE ON "PointReservation" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE FUNCTION guard_category_tree() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serializes category mutations, including concurrent opposing reparentings.
  PERFORM pg_advisory_xact_lock(3342001);
  IF NEW."parentId" IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, "parentId" FROM "Category" WHERE id = NEW."parentId"
      UNION SELECT c.id, c."parentId" FROM "Category" c JOIN ancestors a ON c.id = a."parentId"
    ) SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN RAISE EXCEPTION 'Category hierarchy cannot contain cycles' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER category_tree_guard BEFORE INSERT OR UPDATE OF "parentId" ON "Category" FOR EACH ROW EXECUTE FUNCTION guard_category_tree();

CREATE FUNCTION guard_order_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.status IN ('SHIPPED', 'DELIVERED') AND NEW."shippedAt" IS NULL) OR
    (NEW.status = 'DELIVERED' AND NEW."deliveredAt" IS NULL) OR
    (NEW.status = 'CANCELED' AND NEW."canceledAt" IS NULL) THEN
    RAISE EXCEPTION 'Operational status requires its timestamp' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'PENDING_PAYMENT' AND NEW.status IN ('CONFIRMED', 'CANCELED')) OR
    (OLD.status = 'CONFIRMED' AND NEW.status IN ('PREPARING', 'CANCELED')) OR
    (OLD.status = 'PREPARING' AND NEW.status IN ('SHIPPED', 'CANCELED')) OR
    (OLD.status = 'SHIPPED' AND NEW.status = 'DELIVERED')
  ) THEN RAISE EXCEPTION 'Invalid order transition' USING ERRCODE = '23514'; END IF;
  IF OLD."confirmedAt" IS NOT NULL AND
    (to_jsonb(NEW) - ARRAY['status','moneyStatus','userId','linkedAt','shippedAt','deliveredAt','canceledAt','updatedAt']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['status','moneyStatus','userId','linkedAt','shippedAt','deliveredAt','canceledAt','updatedAt']) THEN
    RAISE EXCEPTION 'Confirmed purchase data is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_transition_guard BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION guard_order_transition();

CREATE FUNCTION guard_purchase_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN target := NEW."orderId"; ELSE target := OLD."orderId"; END IF;
  IF EXISTS (SELECT 1 FROM "Order" WHERE id = target AND "confirmedAt" IS NOT NULL) THEN
    IF TG_TABLE_NAME = 'OrderUnit' AND TG_OP = 'UPDATE' AND
      (to_jsonb(NEW) - ARRAY['returnedAt','updatedAt']) = (to_jsonb(OLD) - ARRAY['returnedAt','updatedAt']) THEN RETURN NEW; END IF;
    IF TG_TABLE_NAME = 'OrderAddress' AND TG_OP = 'UPDATE' AND
      (to_jsonb(NEW) - ARRAY['sourceAddressId','updatedAt']) = (to_jsonb(OLD) - ARRAY['sourceAddressId','updatedAt']) THEN RETURN NEW; END IF;
    RAISE EXCEPTION 'Confirmed purchase snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_address_snapshot BEFORE INSERT OR UPDATE OR DELETE ON "OrderAddress" FOR EACH ROW EXECUTE FUNCTION guard_purchase_snapshot();
CREATE TRIGGER order_package_snapshot BEFORE INSERT OR UPDATE OR DELETE ON "OrderPackage" FOR EACH ROW EXECUTE FUNCTION guard_purchase_snapshot();
CREATE TRIGGER order_line_snapshot BEFORE INSERT OR UPDATE OR DELETE ON "OrderLine" FOR EACH ROW EXECUTE FUNCTION guard_purchase_snapshot();
CREATE TRIGGER order_component_snapshot BEFORE INSERT OR UPDATE OR DELETE ON "OrderComponent" FOR EACH ROW EXECUTE FUNCTION guard_purchase_snapshot();
CREATE TRIGGER order_unit_snapshot BEFORE INSERT OR UPDATE OR DELETE ON "OrderUnit" FOR EACH ROW EXECUTE FUNCTION guard_purchase_snapshot();

CREATE FUNCTION verify_review_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "OrderUnit" u JOIN "Order" o ON o.id = u."orderId"
    JOIN "ProductVariant" v ON v.id = u."variantId"
    WHERE u.id = NEW."verifiedOrderUnitId" AND o."userId" = NEW."userId"
      AND o.status = 'DELIVERED' AND o."deliveredAt" IS NOT NULL AND v."productId" = NEW."productId"
  ) THEN RAISE EXCEPTION 'Review requires a delivered purchase of this product by this user' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_purchase_guard BEFORE INSERT OR UPDATE OF "userId", "productId", "verifiedOrderUnitId" ON "Review" FOR EACH ROW EXECUTE FUNCTION verify_review_purchase();

CREATE FUNCTION lock_refund_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND NEW."orderId" IS DISTINCT FROM OLD."orderId" THEN
    RAISE EXCEPTION 'Refund ownership is immutable' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM "Order" WHERE id = NEW."orderId" FOR UPDATE;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refund_order_lock BEFORE INSERT OR UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION lock_refund_order();
CREATE TRIGGER allocation_order_lock BEFORE INSERT OR UPDATE ON "RefundAllocation" FOR EACH ROW EXECUTE FUNCTION lock_refund_order();

CREATE FUNCTION validate_refund_totals() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund_id uuid; r "Refund"%ROWTYPE; p "PaymentAttempt"%ROWTYPE;
DECLARE money numeric; points numeric; shipping numeric; committed numeric;
BEGIN
  refund_id := (to_jsonb(NEW)->>CASE WHEN TG_TABLE_NAME = 'Refund' THEN 'id' ELSE 'refundId' END)::uuid;
  SELECT * INTO r FROM "Refund" WHERE id = refund_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r."paymentAttemptId" IS NOT NULL THEN
    SELECT * INTO p FROM "PaymentAttempt" WHERE id = r."paymentAttemptId";
    IF p.status <> 'SUCCEEDED' OR p."providerPaidAt" IS NULL THEN
      RAISE EXCEPTION 'Refund requires a recorded successful charge' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF r.kind = 'COMPENSATION' THEN
    IF EXISTS (SELECT 1 FROM "RefundAllocation" WHERE "refundId" = r.id) THEN
      RAISE EXCEPTION 'Compensation cannot have commercial allocations' USING ERRCODE = '23514';
    END IF;
    IF p."appliedToOrder" THEN RAISE EXCEPTION 'Compensation must reference a non-applied payment' USING ERRCODE = '23514'; END IF;
    SELECT coalesce(sum("requestedMoneyCents"), 0) INTO committed FROM "Refund"
      WHERE "paymentAttemptId" = r."paymentAttemptId" AND kind = 'COMPENSATION' AND status <> 'FAILED';
    IF committed > p."amountCents" THEN RAISE EXCEPTION 'Compensation exceeds its charge' USING ERRCODE = '23514'; END IF;
    RETURN NULL;
  END IF;
  IF r."requestedMoneyCents" > 0 AND NOT p."appliedToOrder" THEN
    RAISE EXCEPTION 'Commercial refund requires the applied payment' USING ERRCODE = '23514';
  END IF;
  SELECT coalesce(sum("moneyCents"),0), coalesce(sum("pointsTenths"),0),
    coalesce(sum("moneyCents") FILTER (WHERE kind = 'SHIPPING'),0)
    INTO money, points, shipping FROM "RefundAllocation" WHERE "refundId" = r.id;
  IF money <> r."requestedMoneyCents" OR points <> r."requestedPointsTenths" OR shipping <> r."shippingRefundCents" THEN
    RAISE EXCEPTION 'Refund totals must equal allocations' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT u.id FROM "OrderUnit" u JOIN "RefundAllocation" a ON a."orderUnitId" = u.id
      JOIN "Refund" f ON f.id = a."refundId"
    WHERE u."orderId" = r."orderId" AND f.status <> 'FAILED'
    GROUP BY u.id, u."moneyCents", u."pointsTenths"
    HAVING sum(a."moneyCents") > u."moneyCents" OR sum(a."pointsTenths") > u."pointsTenths"
  ) THEN RAISE EXCEPTION 'Refund exceeds remaining unit balance' USING ERRCODE = '23514'; END IF;
  SELECT coalesce(sum(a."moneyCents"),0) INTO shipping FROM "RefundAllocation" a JOIN "Refund" f ON f.id = a."refundId"
    WHERE a."orderId" = r."orderId" AND a.kind = 'SHIPPING' AND f.status <> 'FAILED';
  IF shipping > (SELECT "shippingChargedCents" FROM "Order" WHERE id = r."orderId") THEN
    RAISE EXCEPTION 'Refund exceeds charged shipping' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER refund_totals AFTER INSERT OR UPDATE ON "Refund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refund_totals();
CREATE CONSTRAINT TRIGGER refund_allocation_totals AFTER INSERT OR UPDATE ON "RefundAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_refund_totals();

CREATE FUNCTION guard_refund_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Refund history cannot be deleted' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER refund_no_delete BEFORE DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION guard_refund_deletion();
CREATE TRIGGER allocation_no_delete BEFORE DELETE ON "RefundAllocation" FOR EACH ROW EXECUTE FUNCTION guard_refund_deletion();
CREATE TRIGGER allocation_no_update BEFORE UPDATE ON "RefundAllocation" FOR EACH ROW EXECUTE FUNCTION reject_history_mutation();

CREATE FUNCTION guard_refund_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','providerRefundId','settledAt','lastError','updatedAt']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['status','providerRefundId','settledAt','lastError','updatedAt']) THEN
    RAISE EXCEPTION 'Refund request amounts and origin are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.status = 'SETTLED' AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Settled refund is terminal' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER refund_request_guard BEFORE UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION guard_refund_request();

CREATE FUNCTION validate_order_aggregate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; o "Order"%ROWTYPE;
BEGIN
  target := (CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
    ->>CASE WHEN TG_TABLE_NAME = 'Order' THEN 'id' ELSE 'orderId' END)::uuid;
  SELECT * INTO o FROM "Order" WHERE id = target;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- A draft may have no lines. Once lines exist the whole aggregate must agree.
  IF EXISTS (SELECT 1 FROM "OrderLine" WHERE "orderId" = target) THEN
    IF EXISTS (
      SELECT l.id FROM "OrderLine" l LEFT JOIN "OrderComponent" c ON c."orderLineId" = l.id
      WHERE l."orderId" = target GROUP BY l.id
      HAVING count(c.id) = 0 OR sum(c."allocatedBaseCents") <> l."lineBeforeCouponCents"
        OR sum(c."allocatedCouponCents") <> l."couponDiscountCents" OR sum(c."allocatedNetCents") <> l."lineAfterCouponCents"
        OR (l.kind = 'VARIANT' AND (count(c.id) <> 1 OR bool_or(c."variantId" <> l."variantId") OR bool_or(c."quantityPerLineUnit" <> 1)))
    ) OR EXISTS (
      SELECT c.id FROM "OrderComponent" c JOIN "OrderLine" l ON l.id = c."orderLineId"
      LEFT JOIN "OrderUnit" u ON u."orderComponentId" = c.id WHERE c."orderId" = target
      GROUP BY c.id, l.quantity
      HAVING c."totalQuantity" <> c."quantityPerLineUnit"::bigint * l.quantity
        OR count(u.id) <> c."totalQuantity" OR min(u."unitOrdinal") <> 1 OR max(u."unitOrdinal") <> c."totalQuantity"
        OR sum(u."baseCents") <> c."allocatedBaseCents" OR sum(u."couponCents") <> c."allocatedCouponCents"
        OR sum(u."netGoodsCents") <> c."allocatedNetCents"
    ) OR (
      SELECT sum("lineBeforeCouponCents") <> o."goodsBeforeCouponCents" OR sum("couponDiscountCents") <> o."couponDiscountCents"
        OR sum("lineAfterCouponCents") <> o."goodsAfterCouponCents" FROM "OrderLine" WHERE "orderId" = target
    ) OR (
      SELECT sum("pointsTenths") <> o."pointsAppliedTenths" OR sum("moneyCents") <> o."goodsMoneyCents" FROM "OrderUnit" WHERE "orderId" = target
    ) THEN RAISE EXCEPTION 'Order lines, components, units and totals must agree' USING ERRCODE = '23514'; END IF;
  END IF;
  IF o.status IN ('CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED') THEN
    IF o."confirmedAt" IS NULL OR NOT EXISTS (SELECT 1 FROM "OrderLine" WHERE "orderId" = target)
      OR NOT EXISTS (SELECT 1 FROM "OrderAddress" WHERE "orderId" = target)
      OR NOT EXISTS (SELECT 1 FROM "OrderPackage" WHERE "orderId" = target)
      OR EXISTS (SELECT 1 FROM "OrderUnit" WHERE "orderId" = target AND "lotId" IS NULL)
      OR NOT EXISTS (SELECT 1 FROM "ReservationSet" WHERE "orderId" = target AND state = 'CONSUMED')
      OR (o."totalMoneyCents" = 0 AND o."moneyStatus" <> 'NOT_REQUIRED')
      OR (o."totalMoneyCents" > 0 AND NOT EXISTS (SELECT 1 FROM "PaymentAttempt" WHERE "orderId" = target AND "appliedToOrder")) THEN
      RAISE EXCEPTION 'Confirmed order requires complete purchase and consumed resources' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER order_aggregate AFTER INSERT OR UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_aggregate();
CREATE CONSTRAINT TRIGGER order_line_aggregate AFTER INSERT OR UPDATE OR DELETE ON "OrderLine" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_aggregate();
CREATE CONSTRAINT TRIGGER order_component_aggregate AFTER INSERT OR UPDATE OR DELETE ON "OrderComponent" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_aggregate();
CREATE CONSTRAINT TRIGGER order_unit_aggregate AFTER INSERT OR UPDATE OR DELETE ON "OrderUnit" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_order_aggregate();

CREATE FUNCTION require_transition_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> OLD.status AND NOT EXISTS (
    SELECT 1 FROM "OrderStatusHistory" WHERE "orderId" = NEW.id AND "fromStatus" = OLD.status AND "toStatus" = NEW.status
  ) THEN RAISE EXCEPTION 'Order transition requires immutable history' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER order_transition_history AFTER UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION require_transition_history();

CREATE FUNCTION guard_reservation_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state <> OLD.state AND NOT (
    (OLD.state = 'ACTIVE' AND NEW.state IN ('RECONCILING', 'CONSUMED', 'RELEASED')) OR
    (OLD.state = 'RECONCILING' AND NEW.state IN ('CONSUMED', 'RELEASED'))
  ) THEN RAISE EXCEPTION 'Reservation terminal state cannot be reversed' USING ERRCODE = '23514'; END IF;
  IF (to_jsonb(NEW) - ARRAY['state','resolvedAt','resolutionReason','updatedAt']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['state','resolvedAt','resolutionReason','updatedAt']) THEN
    RAISE EXCEPTION 'Accepted checkout snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reservation_transition_guard BEFORE UPDATE ON "ReservationSet" FOR EACH ROW EXECUTE FUNCTION guard_reservation_transition();

CREATE FUNCTION validate_resolved_reservation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE reservation "ReservationSet"%ROWTYPE;
BEGIN
  SELECT * INTO reservation FROM "ReservationSet" WHERE id = NEW.id;
  IF reservation.state NOT IN ('CONSUMED', 'RELEASED') THEN RETURN NULL; END IF;
  IF EXISTS (
    SELECT s.id FROM "ReservationStock" s LEFT JOIN "InventoryMovement" m ON m."reservationStockId" = s.id
    WHERE s."reservationSetId" = reservation.id GROUP BY s.id
    HAVING coalesce(sum(m."reservedDelta"), 0) <> 0 OR
      coalesce(sum(m."reservedDelta") FILTER (WHERE m.kind = 'RESERVE'), 0) <> s.quantity OR
      (reservation.state = 'CONSUMED' AND -coalesce(sum(m."onHandDelta") FILTER (WHERE m.kind = 'SALE'),0) <> s.quantity) OR
      (reservation.state = 'RELEASED' AND -coalesce(sum(m."reservedDelta") FILTER (WHERE m.kind = 'RELEASE'),0) <> s.quantity)
  ) OR EXISTS (
    SELECT 1 FROM "CouponUsage" WHERE "reservationSetId" = reservation.id AND
      state::text <> CASE WHEN reservation.state = 'CONSUMED' THEN 'CONSUMED' ELSE 'RELEASED' END
  ) OR EXISTS (
    SELECT 1 FROM "PointReservation" WHERE "reservationSetId" = reservation.id AND
      state::text <> CASE WHEN reservation.state = 'CONSUMED' THEN 'CONSUMED' ELSE 'RELEASED' END
  ) THEN RAISE EXCEPTION 'Resolved reservation must resolve every held resource' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER reservation_resource_resolution AFTER INSERT OR UPDATE ON "ReservationSet" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_resolved_reservation();


COMMIT;
