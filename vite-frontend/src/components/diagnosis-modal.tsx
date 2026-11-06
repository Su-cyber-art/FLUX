import type { ComponentProps, ReactNode } from "react";

import { Alert, Button } from "@mantine/core";
import { Stethoscope } from "lucide-react";

import {
  DiagnosisProgressBar,
  DiagnosisResults,
} from "@/components/diagnosis-results";
import { EmptyStateCard } from "@/components/page-state";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

type ResultsProps = ComponentProps<typeof DiagnosisResults>;

interface DiagnosisModalProps {
  opened: boolean;
  /** Should also abort a diagnosis that is still running. */
  onClose: () => void;
  title: string;
  /** Name of the diagnosed rule or tunnel, with a badge describing its kind. */
  subject?: { name: string; badge: ReactNode } | null;
  loading: boolean;
  results: ResultsProps["results"] | null;
  progress: ResultsProps["progress"] & { completed: number; timedOut: boolean };
  quality: ResultsProps["quality"];
  onRetry?: () => void;
}

/** Shared result dialog for rule and tunnel connectivity diagnosis. */
export function DiagnosisModal({
  opened,
  onClose,
  title,
  subject,
  loading,
  results,
  progress,
  quality,
  onRetry,
}: DiagnosisModalProps) {
  return (
    <Modal opened={opened} size="xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{title}</h2>
          {subject && (
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="text-small text-default-500 min-w-0 truncate"
                title={subject.name}
              >
                {subject.name}
              </span>
              <span className="shrink-0">{subject.badge}</span>
            </div>
          )}
        </ModalHeader>
        <ModalBody className="bg-transparent">
          {results ? (
            <div className="space-y-4">
              {loading && (
                <DiagnosisProgressBar
                  completed={progress.completed}
                  total={progress.total}
                />
              )}
              {progress.timedOut && (
                <Alert color="orange" title="诊断超时">
                  诊断超时（单条30秒 / 整体2分钟），以下为当前已完成结果。
                </Alert>
              )}
              <DiagnosisResults
                progress={progress}
                quality={quality}
                results={results}
              />
            </div>
          ) : (
            <EmptyStateCard
              description="点击“重新诊断”开始测试连接。"
              icon={<Stethoscope size={20} />}
              title="暂无诊断数据"
            />
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="subtle" onClick={onClose}>
            关闭
          </Button>
          {onRetry && (
            <Button loading={loading} onClick={onRetry}>
              重新诊断
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
