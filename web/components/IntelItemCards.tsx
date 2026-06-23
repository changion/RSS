'use client';

import type { IntelItem } from '@/lib/intelFormat';

interface Props {
  items: IntelItem[];
}

export default function IntelItemCards({ items }: Props) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <article
          key={`${item.title}-${idx}`}
          className="lark-card rounded-xl p-5 hover:shadow-lark-md transition-shadow duration-200"
        >
          <h3 className="text-base font-semibold text-lark-primary leading-snug mb-2">
            {item.title}
          </h3>

          {item.summary && (
            <p className="text-sm text-lark-secondary leading-relaxed mb-3">
              {item.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lark-accent hover:text-lark-accent-hover font-medium transition-colors"
              >
                查看原文 →
              </a>
            ) : item.sourceLabel ? (
              <span className="text-lark-secondary">原文：{item.sourceLabel}</span>
            ) : null}

            {item.time && (
              <span className="text-lark-muted">{item.time}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
