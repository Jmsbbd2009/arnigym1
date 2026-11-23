#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="$ROOT_DIR/arniygym"
ADMIN_DIR="$ROOT_DIR/arniygym-admin"

# Shared source files only. Keep admin-only UI and existing migrations intact.
for component in BootstrapIcons HomeOverview FoodAnalyzer DietVideos LandingPage News LegalPage ProfileBilling SecureHlsPlayer SupportModals WorkoutLogControls GymMembership P2PSubmitModal Language InstallPWA; do
  cp "$PUBLIC_DIR/src/components/$component.tsx" "$ADMIN_DIR/src/components/$component.tsx"
done
cp "$PUBLIC_DIR/src/components/food-analyzer.css" "$PUBLIC_DIR/src/components/news.css" "$ADMIN_DIR/src/components/"
for lib in dates news push supabase; do
  cp "$PUBLIC_DIR/src/lib/$lib.ts" "$ADMIN_DIR/src/lib/$lib.ts"
done
mkdir -p "$ADMIN_DIR/public/images"
cp "$PUBLIC_DIR/public/images/coach-bobur.webp" "$PUBLIC_DIR/public/images/coach-portrait.webp" "$ADMIN_DIR/public/images/"

# Keep deployable Supabase definitions aligned without overwriting the baseline migration.
cp "$PUBLIC_DIR/supabase/schema.sql" "$ADMIN_DIR/supabase/schema.sql"
cp "$PUBLIC_DIR/supabase/config.toml" "$ADMIN_DIR/supabase/config.toml"
for migration in 202611230003_production_gym_payments 202611230004_localized_content 202611230005_news_pwa_push 202611230006_function_hardening; do
  cp "$PUBLIC_DIR/supabase/migrations/$migration.sql" "$ADMIN_DIR/supabase/migrations/$migration.sql"
done
mkdir -p "$ADMIN_DIR/supabase/tests"
cp -a "$PUBLIC_DIR/supabase/tests/." "$ADMIN_DIR/supabase/tests/"
cp "$PUBLIC_DIR/supabase/.env.example" "$ADMIN_DIR/supabase/.env.example"
mkdir -p "$ADMIN_DIR/supabase/functions/_shared"
cp -a "$PUBLIC_DIR/supabase/functions/." "$ADMIN_DIR/supabase/functions/"

printf 'Umumiy UI, lib, Edge Functions, migration va testlar admin loyihasiga sinxronlandi.\n'
