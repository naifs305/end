#!/usr/bin/env bash
# Generic deploy for training apps on 172.16.8.17
# Steps: sync compose -> tag previous -> DB backup -> migrations -> up -> healthcheck -> (rollback | promote)
set -euo pipefail

: "${IMAGE_NAME:?}" "${IMAGE_TAG:?}" "${DEPLOY_DIR:?}" "${SERVICE_NAME:?}" "${CONTAINER_NAME:?}" "${HEALTH_URL:?}"
DB_CONTAINER="${DB_CONTAINER:-}"     # فاضي = مفيش backup
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-}"
KEEP_BACKUPS="${KEEP_BACKUPS:-14}"
KEEP_IMAGES="${KEEP_IMAGES:-5}"

log() { echo -e "\n==> $*"; }
cd "$DEPLOY_DIR"
export IMAGE_TAG

# 0) مزامنة docker-compose.yml من الريبو (بعد التحقق إنه سليم)
if [ -f "${CI_PROJECT_DIR:-}/docker-compose.yml" ]; then
  cp docker-compose.yml .docker-compose.prev.yml
  if docker compose -f "$CI_PROJECT_DIR/docker-compose.yml" --project-directory "$DEPLOY_DIR" config -q; then
    cp "$CI_PROJECT_DIR/docker-compose.yml" docker-compose.yml
    log "docker-compose.yml synced from repo"
  else
    log "docker-compose.yml in repo is invalid — aborting"; exit 1
  fi
fi

# 1) احفظ الصورة الشغالة حالياً عشان الـ rollback
PREV_ID="$(docker inspect --format '{{.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [ -n "$PREV_ID" ]; then
  docker tag "$PREV_ID" "$IMAGE_NAME:previous"
  log "Previous image tagged as $IMAGE_NAME:previous"
fi

# 2) Backup لقاعدة البيانات قبل أي migration
if [ -n "$DB_CONTAINER" ] && [ -n "$DB_NAME" ]; then
  mkdir -p backups
  FILE="backups/${DB_NAME}_$(date +%F_%H%M%S)_${IMAGE_TAG}.dump"
  log "Backing up $DB_NAME -> $FILE"
  docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$FILE"
  ls -1t backups/*.dump | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
fi

# 3) Prisma migrations (بس لو الريبو فيه prisma/migrations)
if [ "${RUN_MIGRATIONS:-true}" = "true" ] && [ -d "${CI_PROJECT_DIR:-.}/prisma/migrations" ]; then
  log "Running prisma migrate deploy"
  docker compose run --rm --no-deps -T "$SERVICE_NAME" npx --no-install prisma migrate deploy
else
  log "Skipping migrations"
fi

# 4) تشغيل النسخة الجديدة
log "Starting $IMAGE_NAME:$IMAGE_TAG"
docker compose up -d --no-deps "$SERVICE_NAME"

# 5) Healthcheck
log "Healthcheck on $HEALTH_URL"
for i in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)"
  if [[ "$code" =~ ^[23] ]]; then
    log "Healthy (HTTP $code)"
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$IMAGE_NAME:latest"
    docker images "$IMAGE_NAME" --format '{{.Tag}} {{.ID}}' \
      | grep -Ev '^(latest|previous) ' | tail -n +$((KEEP_IMAGES + 1)) \
      | awk '{print $2}' | xargs -r docker rmi 2>/dev/null || true
    docker image prune -f >/dev/null
    exit 0
  fi
  echo "  attempt $i: HTTP ${code:-none}"; sleep 3
done

# 6) Rollback
log "Healthcheck FAILED — rolling back to $IMAGE_NAME:previous"
docker compose logs --tail=80 "$SERVICE_NAME" || true
if docker image inspect "$IMAGE_NAME:previous" >/dev/null 2>&1; then
  [ -f .docker-compose.prev.yml ] && cp .docker-compose.prev.yml docker-compose.yml
  IMAGE_TAG=previous docker compose up -d --no-deps "$SERVICE_NAME"
  log "Rolled back. (الـ migrations مش بترجع لوحدها — الـ backup في $DEPLOY_DIR/backups)"
fi
exit 1
