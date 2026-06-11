#!/usr/bin/env node
'use strict';

/**
 * Autocannon 性能基准测试
 * 测试缓存前后的性能差异
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002';
const DURATION = process.env.DURATION || 30;
const CONNECTIONS = process.env.CONNECTIONS || 10;

// 测试场景
const testScenarios = [
  {
    name: '无缓存场景 - 首次请求',
    url: `${BASE_URL}/api/messages/conversations`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer test-token`,
    },
    setupClient: (client) => {
      // 清空缓存
      fetch(`${BASE_URL}/api/admin/cache/flush`, { method: 'POST' });
    },
  },
  {
    name: '有缓存场景 - 重复请求',
    url: `${BASE_URL}/api/messages/conversations`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer test-token`,
    },
  },
  {
    name: '搜索查询 - 动态缓存',
    url: `${BASE_URL}/api/messages/search?q=test`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer test-token`,
    },
  },
  {
    name: '消息历史 - 有缓存',
    url: `${BASE_URL}/api/messages/conversation-id?offset=0&limit=20`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer test-token`,
    },
  },
  {
    name: '用户详情 - 有缓存',
    url: `${BASE_URL}/api/users/user-id`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer test-token`,
    },
  },
];

async function runBenchmark() {
  console.log('🚀 V信后端性能基准测试\n');
  console.log(`⚙️ 配置:`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Duration: ${DURATION}s`);
  console.log(`   Connections: ${CONNECTIONS}\n`);

  const results = [];

  for (const scenario of testScenarios) {
    console.log(`📊 运行: ${scenario.name}...`);

    try {
      const result = await autocannon({
        url: scenario.url,
        method: scenario.method,
        headers: scenario.headers,
        duration: DURATION,
        connections: CONNECTIONS,
        pipelining: 1,
        requests: [{ path: scenario.url }],
      });

      const metrics = {
        name: scenario.name,
        throughput: result.throughput.average,
        latency: {
          mean: result.latency.mean,
          p50: result.latency.p50,
          p90: result.latency.p90,
          p99: result.latency.p99,
        },
        errors: result.errors,
        timeouts: result.timeouts,
        requests: result.requests.average,
      };

      results.push(metrics);

      console.log(`   ✅ 吞吐量: ${metrics.throughput.toFixed(2)} req/s`);
      console.log(`   ✅ 平均延迟: ${metrics.latency.mean.toFixed(2)}ms`);
      console.log(`   ✅ P99 延迟: ${metrics.latency.p99.toFixed(2)}ms`);
      console.log(`   ✅ 错误数: ${metrics.errors}\n`);
    } catch (err) {
      console.log(`   ❌ 错误: ${err.message}\n`);
    }
  }

  // 性能对比分析
  console.log('📈 性能对比分析:\n');
  if (results.length >= 2) {
    const noCacheResult = results[0];
    const cacheResult = results[1];

    const latencyImprovement = (
      (noCacheResult.latency.mean - cacheResult.latency.mean) /
      noCacheResult.latency.mean * 100
    ).toFixed(2);

    const throughputImprovement = (
      (cacheResult.throughput - noCacheResult.throughput) /
      noCacheResult.throughput * 100
    ).toFixed(2);

    console.log(`延迟改进: ${latencyImprovement}% 更快`);
    console.log(`吞吐量改进: ${throughputImprovement}% 更高\n`);
  }

  // 保存结果
  const reportPath = path.join(__dirname, '..', 'performance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`✨ 报告已保存: ${reportPath}`);

  // 打印详细报告
  console.log('\n📋 详细报告:\n');
  console.table(results);

  return results;
}

// 运行测试
runBenchmark().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
