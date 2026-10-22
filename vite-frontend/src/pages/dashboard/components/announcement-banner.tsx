import type { AnnouncementData } from "@/api";

import { Info } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { Card, CardBody } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";

interface AnnouncementBannerProps {
  announcement: AnnouncementData;
}

export const AnnouncementBanner = ({
  announcement,
}: AnnouncementBannerProps) => {
  if (!announcement.content) {
    return null;
  }

  return (
    <Card className="mb-4 lg:mb-6 border-primary-line bg-primary-soft">
      <CardBody className="p-4 sm:p-5">
        <div className="flex items-center gap-3.5 sm:gap-4">
          <IconTile round className="shrink-0" size="lg" tone="primary">
            <Info size={20} />
          </IconTile>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground tracking-wide mb-1 sm:mb-1.5 mt-1.5">
              公告
            </h3>
            <div className="text-sm text-default-700 break-words leading-relaxed">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0">{children}</p>
                  ),
                  a: ({ children, href }) => (
                    <a
                      className="text-primary-ink underline decoration-primary-line underline-offset-2 hover:decoration-current"
                      href={href}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 space-y-1 mb-2 last:mb-0">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 space-y-1 mb-2 last:mb-0">
                      {children}
                    </ol>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono rounded bg-primary-soft-hover px-1 py-0.5 text-[0.92em]">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="mb-2 font-mono overflow-x-auto rounded-md bg-primary-soft-hover p-2.5 text-xs leading-relaxed">
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="mb-2 border-l-2 border-primary-line pl-3 italic">
                      {children}
                    </blockquote>
                  ),
                }}
                rehypePlugins={[rehypeSanitize]}
                remarkPlugins={[remarkGfm]}
              >
                {announcement.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
