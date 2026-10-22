import { Link } from "react-router-dom";
import { Button } from "@mantine/core";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Copy,
  Network,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageEmptyState } from "@/components/page-state";
import { SectionHeader } from "@/pages/dashboard/components/section-header";
import { entryAddresses, splitList } from "@/pages/dashboard/format";
import { type DashboardForward } from "@/pages/dashboard/use-dashboard-data";
import { formatTraffic } from "@/utils/traffic";

interface ForwardOverviewProps {
  forwards: DashboardForward[];
  /** Opens the address list (several addresses) or copies the only one. */
  onAddresses: (title: string, addresses: string[]) => void;
}

function AddressButton({
  addresses,
  title,
  onAddresses,
}: {
  addresses: string[];
  title: string;
  onAddresses: ForwardOverviewProps["onAddresses"];
}) {
  if (addresses.length === 0) {
    return <span className="text-xs text-default-400">-</span>;
  }

  const more = addresses.length - 1;

  return (
    <button
      className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-default-soft px-2 py-1 font-mono text-xs text-default-700 transition-colors hover:bg-default-soft-hover"
      title={more > 0 ? `查看全部${title}` : `复制${title}`}
      type="button"
      onClick={() => onAddresses(title, addresses)}
    >
      <span className="truncate">{addresses[0]}</span>
      {more > 0 ? (
        <span className="shrink-0 rounded bg-primary-soft px-1 font-sans text-[10px] font-semibold text-primary-ink">
          +{more}
        </span>
      ) : (
        <Copy
          className="shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
          size={12}
        />
      )}
    </button>
  );
}

export function ForwardOverview({
  forwards,
  onAddresses,
}: ForwardOverviewProps) {
  const groups = new Map<string, DashboardForward[]>();

  forwards.forEach((forward) => {
    const name = forward.tunnelName || "未知隧道";

    groups.set(name, [...(groups.get(name) ?? []), forward]);
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader
          actions={
            <Button
              component={Link}
              rightSection={<ChevronRight size={14} />}
              size="compact-sm"
              to="/forward"
              variant="subtle"
            >
              管理规则
            </Button>
          }
          count={forwards.length}
          description="入口地址、目标地址与累计流量"
          icon={ArrowLeftRight}
          title="转发规则"
        />
      </CardHeader>
      <CardBody className="pt-0">
        {forwards.length === 0 ? (
          <PageEmptyState className="h-40" message="暂无转发规则" />
        ) : (
          <div className="space-y-5">
            {Array.from(groups, ([tunnelName, items]) => (
              <section key={tunnelName} className="min-w-0">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-default-500">
                  <Network size={13} />
                  <span className="truncate">{tunnelName}</span>
                  <span className="text-default-400">· {items.length} 条</span>
                </div>
                <div className="divide-y divide-divider overflow-hidden rounded-lg border border-divider">
                  {items.map((forward) => (
                    <div
                      key={forward.id}
                      className="grid min-w-0 gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-default-soft lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_auto] lg:items-center"
                    >
                      <p className="truncate text-sm font-medium text-foreground">
                        {forward.name}
                      </p>
                      <div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <AddressButton
                          addresses={entryAddresses(
                            forward.inIp,
                            forward.inPort,
                          )}
                          title="入口地址"
                          onAddresses={onAddresses}
                        />
                        <ArrowRight
                          className="ml-2 shrink-0 rotate-90 text-default-400 sm:ml-0 sm:rotate-0"
                          size={14}
                        />
                        <AddressButton
                          addresses={splitList(forward.remoteAddr)}
                          title="目标地址"
                          onAddresses={onAddresses}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs tabular-nums text-default-500 lg:justify-end">
                        <span
                          className="inline-flex items-center gap-1"
                          title="上传"
                        >
                          <ArrowUp size={12} />
                          {formatTraffic(forward.inFlow || 0)}
                        </span>
                        <span
                          className="inline-flex items-center gap-1"
                          title="下载"
                        >
                          <ArrowDown size={12} />
                          {formatTraffic(forward.outFlow || 0)}
                        </span>
                        <span
                          className="min-w-16 text-right font-medium text-foreground"
                          title="计费流量"
                        >
                          {formatTraffic(
                            (forward.inFlow || 0) + (forward.outFlow || 0),
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
