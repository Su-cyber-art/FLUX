import { Link } from "react-router-dom";
import { Button } from "@mantine/core";
import { ChevronRight, TriangleAlert } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { type SemanticColor } from "@/components/ui/shared";
import { SectionHeader } from "@/pages/dashboard/components/section-header";
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
    <Card className="border-warning-line">
      <CardHeader className="pb-3">
        <SectionHeader
          count={reminders.length}
          description="7 天内需要续费或已逾期的节点"
          icon={TriangleAlert}
          title="节点到期提醒"
        />
      </CardHeader>
      <CardBody className="flex flex-1 flex-col pt-0">
        <ul className="divide-y divide-divider">
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
              <li key={node.id} className="py-3 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">
                    {node.name}
                  </p>
                  <Chip className="shrink-0" color={status.tone} size="sm">
                    {status.label}
                  </Chip>
                </div>
                <p className="mt-1 truncate text-xs text-default-500">
                  {details.join(" · ")}
                </p>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-divider pt-3">
          <span className="text-xs text-default-500">
            {hidden > 0 ? `另有 ${hidden} 个节点未显示` : "按续费周期自动推算"}
          </span>
          <Button
            component={Link}
            rightSection={<ChevronRight size={14} />}
            size="compact-sm"
            to="/node"
            variant="subtle"
          >
            节点管理
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
