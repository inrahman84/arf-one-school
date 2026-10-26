#!/usr/bin/env bash
# ARF One School Stage 2: selective encrypted source snapshot and private
# destination staging. Does NOT change source, Auth, or live app documents.
set -Eeuo pipefail
umask 077
: "$SOURCE_SERVICE"
: "$TARGET_SERVICE"
: "$AGE_RECIPIENT"
: "$AGE_IDENTITY_FILE"
: "$ENCRYPTED_EXPORT"
if [[ -z "$SOURCE_SERVICE" || -z "$TARGET_SERVICE" || -z "$AGE_RECIPIENT" ||
      -z "$AGE_IDENTITY_FILE" || -z "$ENCRYPTED_EXPORT" ]]; then
  echo "Set SOURCE_SERVICE, TARGET_SERVICE, AGE_RECIPIENT, AGE_IDENTITY_FILE and ENCRYPTED_EXPORT." >&2
  exit 3
fi
if [[ "$SOURCE_SERVICE" == "$TARGET_SERVICE" ]]; then
  echo "ERROR: source and target services must differ." >&2
  exit 3
fi
if [[ -e "$ENCRYPTED_EXPORT" ]]; then
  echo "ERROR: encrypted snapshot exists; refusing overwrite." >&2
  exit 3
fi
for tool in psql age sha256sum; do
  command -v "$tool" >/dev/null || { echo "Missing $tool" >&2; exit 3; }
done
echo "IMPORTANT: target must be tyonogxpoyzzzuxiwpwc, not ARF Workspace."
read -r -p "Type exact TARGET project reference to confirm: " target_confirm
if [[ "$target_confirm" != "tyonogxpoyzzzuxiwpwc" ]]; then
  echo "Destination confirmation failed. No export or import performed." >&2
  exit 3
fi
echo "Encrypting source-only ARF One School snapshot..."
psql "service=$SOURCE_SERVICE" -X -q -v ON_ERROR_STOP=1 -c \
  '\copy (select path,collection_path,doc_id,school_id,content,created_at,updated_at from public.arf_school_documents order by path) to stdout with (format csv, header true)' \
 | age -r "$AGE_RECIPIENT" -o "$ENCRYPTED_EXPORT"
echo "Encrypted snapshot SHA-256:"
sha256sum "$ENCRYPTED_EXPORT"
echo "Checking encrypted snapshot decryptability without writing plaintext to disk..."
age -d -i "$AGE_IDENTITY_FILE" "$ENCRYPTED_EXPORT" | sha256sum
echo "Check target staging (do not import over an existing stage)..."
stage_rows="$(psql "service=$TARGET_SERVICE" -X -A -t -q -v ON_ERROR_STOP=1 -c \
  'select count(*) from arf_migration.document_stage')"
if [[ "$stage_rows" != "0" ]]; then
  echo "Stage contains $stage_rows records; refusing to mix imports." >&2
  exit 3
fi
echo "Importing encrypted snapshot into PRIVATE staging only..."
age -d -i "$AGE_IDENTITY_FILE" "$ENCRYPTED_EXPORT" \
 | psql "service=$TARGET_SERVICE" -X -q -v ON_ERROR_STOP=1 -c \
  '\copy arf_migration.document_stage(path,collection_path,doc_id,school_id,content,created_at,updated_at) from stdin with (format csv, header true)'
echo "Private staging counts (no student or staff data printed):"
psql "service=$TARGET_SERVICE" -X -v ON_ERROR_STOP=1 -c \
  "select collection_path,count(*) as records from arf_migration.document_stage group by collection_path order by collection_path;"
echo "STAGING COMPLETE. Before promotion: freeze One School writes, reconcile snapshots, and verify backup restore."
