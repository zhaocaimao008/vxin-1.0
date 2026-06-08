#!/bin/bash
# 24小时耐久测试包装脚本
# 每15分钟跑一轮，记录结果到 endurance_24h_report.log
# 24小时后生成总结

cd /root/v信/backend
LOG="endurance_24h_report.log"
TIMES_LOG="/tmp/endurance_times.txt"
START=$(date +%s)
END=$((START + 86400))  # 24h from now
CYCLE=1
ALL_OK=0
ALL_FAIL=0
ERRORS=""

rm -f "$LOG" "$TIMES_LOG"

echo "══════════════════════════════════════════════" | tee -a "$LOG"
echo "  vxin 24小时耐久测试" | tee -a "$LOG"
echo "  启动: $(date)" | tee -a "$LOG"
echo "  间隔: 15分钟 × 96轮" | tee -a "$LOG"
echo "══════════════════════════════════════════════" | tee -a "$LOG"
echo "" | tee -a "$LOG"

while [ $(date +%s) -lt $END ]; do
  CYCLE_START=$(date +%s)
  echo "[$(date)] Cycle $CYCLE ..." >> "$LOG"
  
  OUTPUT=$(NODE_PATH=/root/v信/backend/node_modules node /root/v信/endurance_cycle.js 2>&1)
  EXIT_CODE=$?
  
  CYCLE_DURATION=$(($(date +%s) - CYCLE_START))
  
  if [ $EXIT_CODE -eq 0 ]; then
    ALL_OK=$((ALL_OK + 1))
    STATE="✅"
  else
    ALL_FAIL=$((ALL_FAIL + 1))
    STATE="⚠️"
    ERRORS="${ERRORS}Cycle ${CYCLE}: ${OUTPUT}\n"
  fi
  
  echo "[$(date)] Cycle ${CYCLE}: ${STATE} (${CYCLE_DURATION}s) ${OUTPUT}" >> "$LOG"
  echo "${CYCLE}:${CYCLE_DURATION}:${EXIT_CODE}" >> "$TIMES_LOG"

  CYCLE=$((CYCLE + 1))

  # 每小时打印进展
  if [ $((CYCLE % 4)) -eq 0 ]; then
    ELAPSED=$((($(date +%s) - START) / 3600))
    REMAINING=$(((END - $(date +%s)) / 3600))
    TOTAL_RUN=$((ALL_OK + ALL_FAIL))
    echo "  [${ELAPSED}h/${REMAINING}h] 已运行 ${TOTAL_RUN} 轮 | OK=${ALL_OK} FAIL=${ALL_FAIL}" >> "$LOG"
  fi

  # 等15分钟
  SLEEP_TIME=900
  NOW=$(date +%s)
  NEXT=$((CYCLE_START + SLEEP_TIME))
  if [ $NEXT -gt $END ]; then
    break
  fi
  SLEEP_DURATION=$((NEXT - NOW))
  if [ $SLEEP_DURATION -gt 0 ]; then
    sleep $SLEEP_DURATION
  fi
done

# 总结
TOTAL=$((ALL_OK + ALL_FAIL))
RATE=$(echo "scale=1; $ALL_OK * 100 / $TOTAL" | bc)
AVG_TIME=$(awk -F: '{sum+=$2; cnt++} END{printf "%.1f", sum/cnt}' "$TIMES_LOG")
MAX_TIME=$(awk -F: '{if($2>m||m=="")m=$2} END{print m}' "$TIMES_LOG")
MIN_TIME=$(awk -F: '{if($2<m||m=="")m=$2} END{print m}' "$TIMES_LOG")

echo "" | tee -a "$LOG"
echo "══════════════════════════════════════════════" | tee -a "$LOG"
echo "  24小时耐久测试 完成" | tee -a "$LOG"
echo "══════════════════════════════════════════════" | tee -a "$LOG"
echo "  总轮次:  ${TOTAL}/96" | tee -a "$LOG"
echo "  通过:    ${ALL_OK}" | tee -a "$LOG"
echo "  失败:    ${ALL_FAIL}" | tee -a "$LOG"
echo "  成功率:  ${RATE}%" | tee -a "$LOG"
echo "  平均耗时: ${AVG_TIME}s" | tee -a "$LOG"
echo "  最快:    ${MIN_TIME}s" | tee -a "$LOG"
echo "  最慢:    ${MAX_TIME}s" | tee -a "$LOG"

if [ -n "$ERRORS" ]; then
  echo "" | tee -a "$LOG"
  echo "  失败详情:" | tee -a "$LOG"
  printf "%s" "$ERRORS" | tee -a "$LOG"
fi

# 最终数据库状态
echo "" | tee -a "$LOG"
echo "  最终数据:" | tee -a "$LOG"
sqlite3 wechat.db "SELECT '  用户: ' || COUNT(*) || ' (机器人: ' || SUM(CASE WHEN phone>='17700000000' THEN 1 ELSE 0 END) || ')' FROM users;" >> "$LOG"
sqlite3 wechat.db "SELECT '  消息: ' || COUNT(*) FROM messages;" >> "$LOG"
sqlite3 wechat.db "SELECT '  会话: ' || COUNT(*) || ' (群: ' || SUM(CASE WHEN type='group' THEN 1 ELSE 0 END) || ')' FROM conversations;" >> "$LOG"
echo "  数据库: $(ls -lh wechat.db | awk '{print $5}')" >> "$LOG"

echo "" | tee -a "$LOG"
echo "日志文件: $LOG" | tee -a "$LOG"
