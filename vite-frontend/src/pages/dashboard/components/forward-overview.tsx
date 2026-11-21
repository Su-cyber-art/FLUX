import { ArrowDown, ArrowRight, ArrowUp, Copy } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PanelHead } from "@/pages/dashboard/components/panel";
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
    return <span className="mono-value text-default-400">-</span>;
  }

  const more = addresses.length - 1;

  return (
    <button
      className="dash-addr"
      title={more > 0 ? `查看全部${title}` : `复制${title}`}
      type="button"
      onClick={() => onAddresses(title, addresses)}
    >
      <span className="mono-value">{addresses[0]}</span>
      {more > 0 ? (
        <span className="dash-addr-more">+{more}</span>
      ) : (
        <Copy className="dash-addr-copy" size={12} />
      )}
    </button>
  );
}

export function ForwardOverview({
  forwards,
  onAddresses,
}: ForwardOverviewProps) {
  // Keep rules of the same tunnel next to each other.
  const groups = new Map<string, DashboardForward[]>();

  forwards.forEach((forward) => {
    const name = forward.tunnelName || "未知隧道";

    groups.set(name, [...(groups.get(name) ?? []), forward]);
  });

  return (
    <Card className="dash-panel">
      <PanelHead
        count={forwards.length}
        description="入口地址、目标地址与累计流量"
        link={{ to: "/forward", label: "管理规则" }}
        title="转发规则"
      />
      {forwards.length === 0 ? (
        <p className="chart-empty">
          <ArrowRight size={15} />
          还没有转发规则
        </p>
      ) : (
        <>
          <div aria-hidden className="dash-list-head dash-forward-row">
            <span>名称</span>
            <span>隧道</span>
            <span>入口 → 目标</span>
            <span className="text-right">流量</span>
          </div>
          <ul className="dash-list">
            {Array.from(groups, ([tunnelName, items]) =>
              items.map((forward) => (
                <li key={forward.id} className="dash-row dash-forward-row">
                  <span className="dash-row-name" title={forward.name}>
                    {forward.name}
                  </span>
                  <span className="dash-row-meta" title={tunnelName}>
                    {tunnelName}
                  </span>
                  <div className="dash-route">
                    <AddressButton
                      addresses={entryAddresses(forward.inIp, forward.inPort)}
                      title="入口地址"
                      onAddresses={onAddresses}
                    />
                    <ArrowRight className="dash-route-arrow" size={13} />
                    <AddressButton
                      addresses={splitList(forward.remoteAddr)}
                      title="目标地址"
                      onAddresses={onAddresses}
                    />
                  </div>
                  <div className="dash-traffic">
                    <span
                      className="hidden items-center gap-0.5 sm:inline-flex"
                      title="上传"
                    >
                      <ArrowUp size={11} />
                      {formatTraffic(forward.inFlow || 0)}
                    </span>
                    <span
                      className="hidden items-center gap-0.5 sm:inline-flex"
                      title="下载"
                    >
                      <ArrowDown size={11} />
                      {formatTraffic(forward.outFlow || 0)}
                    </span>
                    <span className="dash-traffic-total" title="计费流量">
                      {formatTraffic(
                        (forward.inFlow || 0) + (forward.outFlow || 0),
                      )}
                    </span>
                  </div>
                </li>
              )),
            )}
          </ul>
        </>
      )}
    </Card>
  );
}
