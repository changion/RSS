import { RawItem } from '../types';
/** APK 采集规则配置 */
interface ApkCollectRule {
    packageNames: string[];
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
export declare function collectApkChanges(packageNames: string[]): Promise<RawItem[]>;
/**
 * 从 collectRule JSON 中解析 APK 采集规则
 */
export declare function parseApkRule(collectRuleJson: string): ApkCollectRule;
export {};
//# sourceMappingURL=apk.collector.d.ts.map