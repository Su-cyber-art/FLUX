import { TriangleAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import { type SemanticColor } from "@/components/ui/shared";
import { PanelHead } from "@/pages/dashboard/components/panel";
import { type DashboardNodeExpiryItem } from "@/pages/dashboard/use-dashboard-data";
import {
  getNodeRenewalCycleLabel,
  getNodeRenewalSnapshot,
} from "@/pages/node/renewal";

const VISIBLE_LIMIT = 6;

const getStatus = (
  nextDueTime: number | undefined,
  state: ReturnType<typeof getNodeRenewalSnapshot>["state"],
): { label: string; tone: SemanticColor } => {
  if (!nextDueTime || state === "unset") {
    return { label: "未设置", tone: "default" };
  }

  const diffDays = Math.ceil(
    (nextDueTime - Date.now()) / (1000 * 60 * 60 * 24),
  );

  if (state === "expired" || diffDays <= 0) {
    return { label: "已逾期", tone: "danger" };
  }
  if (diffDays === 1) return { label: "明天到期", tone: "warning" };

  return {
    label: `${diffDays}天后到期`,
    tone: diffDays <= 7 ? "warning" : "success",
  };
};

export function NodeExpiryPanel({
  reminders,
}: {
  reminders: DashboardNodeExpiryItem[];
}) {
  const hidden = reminders.length - VISIBLE_LIMIT;

  return (
    <Card className="dash-panel">
      <PanelHead
        count={reminders.length}
        icon={<TriangleAlert className="text-warning-ink" size={13} />}
        link={{ to: "/node", label: "节点管理" }}
        title="节点到期提醒"
      />
      <ul className="dash-list flex-1">
        {reminders.slice(0, VISIBLE_LIMIT).map((node) => {
          const snapshot = getNodeRenewalSnapshot(
            node.expiryTime,
            node.renewalCycle,
          );
          const status = getStatus(snapshot.nextDueTime, snapshot.state);
          const details = [
            snapshot.nextDueTime
              ? new Date(snapshot.nextDueTime).toLocaleDateString("zh-CN")
              : "",
            getNodeRenewalCycleLabel(node.renewalCycle),
            node.remark?.trim(),
          ].filter(Boolean);

          return (
            <li key={node.id} className="dash-row dash-expiry-row">
              <p className="dash-row-name" title={node.name}>
                {node.name}
              </p>
              <span className="status-dot" data-tone={status.tone}>
                {status.label}
              </span>
              <p className="dash-row-meta col-span-2">{details.join(" · ")}</p>
            </li>
          );
        })}
      </ul>
      <div className="dash-panel-foot">
        <span>
          {hidden > 0
            ? `另有 ${hidden} 个节点未显示`
            : "7 天内需要续费或已逾期的节点，按续费周期自动推算"}
        </span>
      </div>
    </Card>
  );
}
