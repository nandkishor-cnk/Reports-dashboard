#!/bin/bash
# ─────────────────────────────────────────────────
# Cox & Kings EOS Scorecard — Cron Sync Script
# Runs ETL: TeleCRM RDS → Supabase + live_data.json
# ─────────────────────────────────────────────────

PROJECT_DIR="/Users/nandkishorsinghshekhawat/Desktop/Projects/Cox and Kings EOS Scorecard"
PYTHON="/usr/bin/python3"
LOG_FILE="$PROJECT_DIR/cron_sync.log"

# Timestamp
echo "" >> "$LOG_FILE"
echo "=== CRON SYNC: $(date '+%Y-%m-%d %H:%M:%S %Z') ===" >> "$LOG_FILE"

# Run ETL sync (incremental)
cd "$PROJECT_DIR"
"$PYTHON" etl_supabase_sync.py >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Sync completed successfully" >> "$LOG_FILE"
else
    echo "✗ Sync FAILED (exit code $EXIT_CODE)" >> "$LOG_FILE"
fi

# Keep log file from growing too large (keep last 2000 lines)
if [ $(wc -l < "$LOG_FILE") -gt 2000 ]; then
    tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
