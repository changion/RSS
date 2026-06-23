"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailReport = sendEmailReport;
exports.pushAllUserEmailReports = pushAllUserEmailReports;
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_1 = require("../lib/prisma");
const feishu_service_1 = require("./feishu.service");
/**
 * 创建 Nodemailer transporter（从环境变量读取 SMTP 配置）
 */
function createTransporter() {
    return nodemailer_1.default.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: parseInt(process.env.SMTP_PORT || '465', 10) === 465,
        auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
        },
    });
}
/**
 * 将 Markdown 文本转换为简单 HTML
 * 支持：标题(##/###)、粗体(**text**)、列表(-)、段落、分割线
 */
function markdownToHtml(md) {
    const lines = md.split('\n');
    const html = [];
    let inList = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# ')) {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push(`<h1 style="color:#1a1a2e;border-bottom:2px solid #4a90e2;padding-bottom:8px">${trimmed.slice(2)}</h1>`);
        }
        else if (trimmed.startsWith('## ')) {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push(`<h2 style="color:#2c3e50;margin-top:24px;margin-bottom:8px">${trimmed.slice(3)}</h2>`);
        }
        else if (trimmed.startsWith('### ')) {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push(`<h3 style="color:#34495e;margin-top:16px;margin-bottom:4px">${trimmed.slice(4)}</h3>`);
        }
        else if (trimmed === '---') {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push('<hr style="border:none;border-top:1px solid #eee;margin:16px 0">');
        }
        else if (trimmed.startsWith('- ')) {
            if (!inList) {
                html.push('<ul style="padding-left:20px;margin:8px 0">');
                inList = true;
            }
            const content = formatInline(trimmed.slice(2));
            html.push(`<li style="margin:4px 0">${content}</li>`);
        }
        else if (trimmed === '') {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push('<br>');
        }
        else {
            if (inList) {
                html.push('</ul>');
                inList = false;
            }
            html.push(`<p style="margin:4px 0;line-height:1.6">${formatInline(trimmed)}</p>`);
        }
    }
    if (inList)
        html.push('</ul>');
    return html.join('\n');
}
function formatInline(text) {
    return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code style="background:#f5f5f5;padding:1px 4px;border-radius:3px">$1</code>')
        .replace(/\[(.+?)\]\((https?:\/\/.+?)\)/g, '<a href="$2" style="color:#4a90e2">$1</a>');
}
/**
 * 构建完整邮件 HTML 模板
 */
function buildEmailHtml(report, date) {
    const dateStr = date.toISOString().slice(0, 10);
    const bodyContent = markdownToHtml(report);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>情报日报 ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;margin:24px auto">
    <tr>
      <td style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);padding:32px 40px">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid #eee">
          <div style="font-size:24px;font-weight:700;color:#1a1a2e;letter-spacing:1px">📡 情报日报</div>
          <div style="font-size:14px;color:#888;margin-top:4px">${dateStr}</div>
        </div>
        <!-- Content -->
        <div style="font-size:15px;line-height:1.7">
          ${bodyContent}
        </div>
        <!-- Footer -->
        <div style="margin-top:40px;padding-top:24px;border-top:1px solid #eee;text-align:center;font-size:12px;color:#aaa">
          此邮件由情报订阅站自动发送，如需退订请登录系统关闭邮件通知。
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
/**
 * 发送邮件日报
 *
 * @param to 收件人邮箱
 * @param report Markdown 格式日报
 * @param date 报告日期
 */
async function sendEmailReport(to, report, date) {
    const transporter = createTransporter();
    const dateStr = date.toISOString().slice(0, 10);
    const from = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@intel-hub.app';
    await transporter.sendMail({
        from: `情报订阅站 <${from}>`,
        to,
        subject: `情报日报 ${dateStr}`,
        text: report,
        html: buildEmailHtml(report, date),
    });
    console.log(`[email.service] 邮件发送成功 — to: ${to}, date: ${dateStr}`);
}
/**
 * P2-K02：遍历用户推送邮件日报
 * emailNotify=true 且有 emailAddress 的用户触发邮件推送
 */
async function pushAllUserEmailReports(date, userReports) {
    const targetDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    // 获取需要邮件推送的用户信息
    const userIds = userReports.map((r) => r.userId);
    const users = await prisma_1.prisma.user.findMany({
        where: {
            id: { in: userIds },
            emailNotify: true,
            emailAddress: { not: null },
        },
        select: { id: true, emailAddress: true },
    });
    const emailUserMap = new Map(users.map((u) => [u.id, u.emailAddress]));
    for (const { userId, content } of userReports) {
        const emailAddress = emailUserMap.get(userId);
        if (!emailAddress || !content) {
            if (!emailAddress) {
                await (0, feishu_service_1.recordPushLog)(targetDate, 'EMAIL', 'SKIPPED', 'no email configured', userId);
            }
            continue;
        }
        try {
            await sendEmailReport(emailAddress, content, date);
            await (0, feishu_service_1.recordPushLog)(targetDate, 'EMAIL', 'SENT', undefined, userId);
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[email.service] 邮件推送失败 — userId: ${userId}:`, errorMsg);
            await (0, feishu_service_1.recordPushLog)(targetDate, 'EMAIL', 'FAILED', errorMsg, userId);
        }
    }
}
//# sourceMappingURL=email.service.js.map