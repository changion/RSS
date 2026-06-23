/**
 * 将「原文：https://...」转为 Markdown 可点击链接，供飞书 lark_md 与前端渲染复用
 */
export function makeSourceLinksClickable(content: string): string {
  return content.replace(
    /^原文：(?!\[)(https?:\/\/\S+)/gm,
    '原文：[$1]($1)',
  );
}
