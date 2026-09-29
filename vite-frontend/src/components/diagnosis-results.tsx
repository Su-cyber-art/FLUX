import { Badge, Loader, Text } from "@mantine/core";
import { Check, X } from "lucide-react";

import { uiColor, type SemanticColor } from "@/components/ui/shared";

interface DiagnosisEntry {
  description: string;
  targetIp: string;
  targetPort?: number;
  success?: boolean;
  diagnosing?: boolean;
  message?: string;
  averageTime?: number;
  packetLoss?: number;
  fromChainType?: number;
  fromInx?: number;
}
interface Props {
  results: DiagnosisEntry[];
  progress: { total: number; success: number; failed: number };
  quality: (
    latency?: number,
    loss?: number,
  ) => { text: string; color: SemanticColor } | null;
}

const targetAddress = (entry: DiagnosisEntry) => {
  if (!entry.targetPort) return entry.targetIp;
  const host =
    entry.targetIp.includes(":") && !entry.targetIp.startsWith("[")
      ? `[${entry.targetIp}]`
      : entry.targetIp;

  return `${host}:${entry.targetPort}`;
};

export function DiagnosisResults({ results, progress, quality }: Props) {
  const sections = new Map<
    string,
    { order: number; results: DiagnosisEntry[] }
  >();

  for (const result of results) {
    const title =
      result.fromChainType === 1
        ? "入口测试"
        : result.fromChainType === 3
          ? "出口测试"
          : result.fromChainType === 2
            ? `转发链 · 第 ${result.fromInx ?? 1} 跳`
            : "连接测试";
    const order =
      result.fromChainType === 1
        ? 0
        : result.fromChainType === 3
          ? Number.MAX_SAFE_INTEGER - 1
          : result.fromChainType === 2
            ? (result.fromInx ?? 1)
            : Number.MAX_SAFE_INTEGER;
    const section = sections.get(title) ?? { order, results: [] };

    section.results.push(result);
    sections.set(title, section);
  }
  const counts = [
    {
      label: "总测试数",
      value: progress.total || results.length,
      color: undefined,
    },
    {
      label: "成功",
      value: progress.total
        ? progress.success
        : results.filter((item) => item.success && !item.diagnosing).length,
      color: "teal",
    },
    {
      label: "失败",
      value: progress.total
        ? progress.failed
        : results.filter((item) => item.success === false && !item.diagnosing)
            .length,
      color: "red",
    },
  ];

  return (
    <div className="diagnosis-results">
      <dl className="diagnosis-summary">
        {counts.map((count) => (
          <div key={count.label}>
            <dt>{count.label}</dt>
            <Text c={count.color} className="diagnosis-count" component="dd">
              {count.value}
            </Text>
          </div>
        ))}
      </dl>
      {[...sections.entries()]
        .sort((a, b) => a[1].order - b[1].order)
        .map(([title, section]) => (
          <section key={title} aria-label={title} className="diagnosis-section">
            <div className="diagnosis-section-heading">
              <h3>{title}</h3>
              <Text c="dimmed" size="xs">
                {section.results.length} 项
              </Text>
            </div>
            <div className="diagnosis-entries">
              {section.results.map((result, index) => {
                const pending = Boolean(result.diagnosing);
                const success = !pending && result.success === true;
                const grade = success
                  ? quality(result.averageTime, result.packetLoss)
                  : null;
                const status = pending ? "诊断中" : success ? "成功" : "失败";

                return (
                  <article
                    key={`${result.description}-${index}`}
                    className="diagnosis-entry"
                    data-status={
                      pending ? "pending" : success ? "success" : "failed"
                    }
                  >
                    <div className="diagnosis-route">
                      <span
                        aria-hidden="true"
                        className="diagnosis-status-icon"
                      >
                        {pending ? (
                          <Loader color="orange" size={16} />
                        ) : success ? (
                          <Check size={16} />
                        ) : (
                          <X size={16} />
                        )}
                      </span>
                      <div className="diagnosis-route-text">
                        <h4>{result.description}</h4>
                        <Text
                          c="dimmed"
                          className="diagnosis-target"
                          component="p"
                          size="xs"
                        >
                          {targetAddress(result)}
                        </Text>
                      </div>
                      <Badge
                        color={pending ? "orange" : success ? "teal" : "red"}
                        size="sm"
                        variant="light"
                      >
                        {status}
                      </Badge>
                    </div>
                    {success ? (
                      <dl className="diagnosis-metrics">
                        <div>
                          <dt>
                            延迟 <span>ms</span>
                          </dt>
                          <dd>{result.averageTime?.toFixed(0) ?? "—"}</dd>
                        </div>
                        <div>
                          <dt>丢包率</dt>
                          <dd>
                            {result.packetLoss?.toFixed(1) ?? "—"}
                            {result.packetLoss !== undefined && <span>%</span>}
                          </dd>
                        </div>
                        <div>
                          <dt>连接质量</dt>
                          <dd>
                            {grade ? (
                              <Badge
                                color={uiColor(grade.color)}
                                size="sm"
                                variant="light"
                              >
                                {grade.text}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </dd>
                        </div>
                      </dl>
                    ) : (
                      <Text
                        c={pending ? "orange" : "red"}
                        className="diagnosis-message"
                        size="sm"
                      >
                        {result.message ||
                          (pending ? "正在测试连接…" : "连接失败")}
                      </Text>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
