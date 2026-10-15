ALTER TABLE "User" ADD COLUMN "themePreference" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "User" ADD CONSTRAINT "User_theme_preference" CHECK ("themePreference" IN ('light', 'dark', 'system'));
