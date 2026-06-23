"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectApkChanges = collectApkChanges;
exports.parseApkRule = parseApkRule;
const child_process_1 = require("child_process");
/**
 * 检查系统工具是否可用
 */
function checkToolAvailable(toolName) {
    const result = (0, child_process_1.spawnSync)('which', [toolName], { encoding: 'utf8', timeout: 5000 });
    return result.status === 0 && !!result.stdout.trim();
}
/**
 * 从多个数据源获取 APK 最新版本信息
 * 依次尝试，任一成功即返回
 */
async function fetchLatestVersion(packageName) {
    const axios = await Promise.resolve().then(() => __importStar(require('axios'))).then((m) => m.default);
    const sources = [
        async () => {
            const res = await axios.get(`https://playstore.unshorten.me/storeinfo?package=${packageName}`, { timeout: 10000, headers: { 'User-Agent': 'IntelHub/1.0' } });
            const d = res.data;
            return {
                versionName: String(d.version || d.currentVersion || ''),
                versionCode: String(d.versionCode || d.currentVersionCode || ''),
            };
        },
        async () => {
            const res = await axios.get(`https://androidappsapk.co/api/v1/packageinfo?package=${packageName}`, { timeout: 10000 });
            const d = res.data;
            return {
                versionName: String(d.version || ''),
                versionCode: String(d.versionCode || ''),
            };
        },
    ];
    for (const source of sources) {
        try {
            const result = await source();
            if (result.versionCode || result.versionName)
                return result;
        }
        catch {
            // 静默降级到下一个源
        }
    }
    return null;
}
/**
 * 采集 APK 版本变更信息
 * 封装为采集引擎的 apk 类型处理器
 *
 * 注意：完整的 APK 反编译分析需要系统预装 apkeep 和 jadx
 * 缺失时优雅降级，仅返回版本变更摘要
 *
 * @param packageNames Android 包名数组
 * @returns 版本变更条目列表
 */
async function collectApkChanges(packageNames) {
    if (!packageNames || packageNames.length === 0)
        return [];
    const hasApkeep = checkToolAvailable('apkeep');
    const hasJadx = checkToolAvailable('jadx');
    if (!hasApkeep) {
        console.warn('[apk.collector] apkeep 未安装，APK 分析功能降级为版本监控模式');
    }
    if (!hasJadx) {
        console.warn('[apk.collector] jadx 未安装，将跳过反编译分析');
    }
    const results = await Promise.allSettled(packageNames.map((pkg) => fetchApkInfo(pkg, hasApkeep, hasJadx)));
    const items = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
            items.push(result.value);
        }
        else if (result.status === 'rejected') {
            console.warn(`[apk.collector] 包 ${packageNames[index]} 采集失败:`, result.reason?.message);
        }
    });
    return items;
}
/**
 * 获取单个包的版本信息并生成 RawItem
 */
async function fetchApkInfo(packageName, _hasApkeep, _hasJadx) {
    const versionInfo = await fetchLatestVersion(packageName);
    if (!versionInfo) {
        console.warn(`[apk.collector] 无法获取 ${packageName} 的版本信息`);
        return null;
    }
    const { versionName, versionCode } = versionInfo;
    const now = new Date().toISOString();
    const summary = [
        `版本：${versionName}（${versionCode}）`,
        _hasApkeep && _hasJadx ? '（完整反编译分析需单独触发）' : '（仅版本监控模式）',
    ]
        .filter(Boolean)
        .join(' ');
    return {
        title: `${packageName} 版本更新：${versionName}`,
        link: `https://play.google.com/store/apps/details?id=${packageName}`,
        pubDate: now,
        content: summary,
        source: `apk-monitor:${packageName}`,
    };
}
/**
 * 从 collectRule JSON 中解析 APK 采集规则
 */
function parseApkRule(collectRuleJson) {
    try {
        const rule = JSON.parse(collectRuleJson);
        return {
            packageNames: Array.isArray(rule.packageNames) ? rule.packageNames : [],
        };
    }
    catch {
        return { packageNames: [] };
    }
}
//# sourceMappingURL=apk.collector.js.map