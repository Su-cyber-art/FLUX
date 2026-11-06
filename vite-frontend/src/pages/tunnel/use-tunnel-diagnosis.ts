import { useEffect, useRef, useState } from "react";

import { diagnoseTunnel } from "@/api";
import { diagnoseTunnelStream } from "@/api/diagnosis-stream";
import toast from "@/lib/notifications";
import {
  buildDiagnosisFallbackResult,
  type DiagnosisResult,
} from "@/pages/tunnel/diagnosis";
import { Tunnel, getTunnelDiagnosisTarget } from "@/pages/tunnel/presentation";

export function useTunnelDiagnosis() {
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [currentDiagnosisTunnel, setCurrentDiagnosisTunnel] =
    useState<Tunnel | null>(null);
  const [diagnosisResult, setDiagnosisResult] =
    useState<DiagnosisResult | null>(null);
  const [diagnosisProgress, setDiagnosisProgress] = useState({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    timedOut: false,
  });
  const diagnosisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      diagnosisAbortRef.current?.abort();
      diagnosisAbortRef.current = null;
    };
  }, []);
  // 诊断隧道
  const closeDiagnosis = () => {
    setDiagnosisModalOpen(false);
    diagnosisAbortRef.current?.abort();
    diagnosisAbortRef.current = null;
    setDiagnosisLoading(false);
  };
  const handleDiagnose = async (tunnel: Tunnel) => {
    diagnosisAbortRef.current?.abort();
    const abortController = new AbortController();
    const diagnosisTarget = getTunnelDiagnosisTarget(tunnel);

    diagnosisAbortRef.current = abortController;

    setCurrentDiagnosisTunnel(tunnel);
    setDiagnosisModalOpen(true);
    setDiagnosisLoading(true);
    setDiagnosisProgress({
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      timedOut: false,
    });
    setDiagnosisResult({
      tunnelName: tunnel.name,
      tunnelType: tunnel.type === 1 ? "端口转发" : "隧道转发",
      timestamp: Date.now(),
      results: [],
    });

    try {
      let streamErrorMessage = "";
      const streamResult = await diagnoseTunnelStream(
        tunnel.id,
        {
          onStart: (payload) => {
            const startTunnelName =
              typeof payload.tunnelName === "string" &&
              payload.tunnelName.trim() !== ""
                ? payload.tunnelName
                : tunnel.name;
            const startTunnelType =
              typeof payload.tunnelType === "string" &&
              payload.tunnelType.trim() !== ""
                ? payload.tunnelType
                : tunnel.type === 1
                  ? "端口转发"
                  : "隧道转发";
            const startTotal = Number(payload.total);
            const startItems = Array.isArray(payload.items)
              ? (payload.items as DiagnosisResult["results"])
              : [];

            setDiagnosisResult((prev) => ({
              tunnelName: startTunnelName,
              tunnelType: startTunnelType,
              timestamp: Date.now(),
              results: startItems.length > 0 ? startItems : prev?.results || [],
            }));
            if (Number.isFinite(startTotal) && startTotal >= 0) {
              setDiagnosisProgress((prev) => ({
                ...prev,
                total: startTotal,
              }));
            }
          },
          onItem: ({ result, progress }) => {
            setDiagnosisResult((prev) => {
              const base: DiagnosisResult = prev || {
                tunnelName: tunnel.name,
                tunnelType: tunnel.type === 1 ? "端口转发" : "隧道转发",
                timestamp: Date.now(),
                results: [],
              };
              const nextResults = [...base.results];
              const existingIndex = nextResults.findIndex(
                (item) =>
                  item.description === result.description &&
                  item.nodeId === result.nodeId &&
                  item.targetIp === result.targetIp &&
                  item.targetPort === result.targetPort,
              );

              if (existingIndex >= 0) {
                nextResults[existingIndex] = {
                  ...result,
                  diagnosing: false,
                };
              } else {
                nextResults.push({
                  ...result,
                  diagnosing: false,
                });
              }

              return {
                ...base,
                timestamp: Date.now(),
                results: nextResults,
              };
            });
            setDiagnosisProgress({
              total: progress.total,
              completed: progress.completed,
              success: progress.success,
              failed: progress.failed,
              timedOut: Boolean(progress.timedOut),
            });
          },
          onDone: (progress) => {
            setDiagnosisProgress({
              total: progress.total,
              completed: progress.completed,
              success: progress.success,
              failed: progress.failed,
              timedOut: Boolean(progress.timedOut),
            });
          },
          onError: (message) => {
            streamErrorMessage = message;
          },
        },
        abortController.signal,
      );

      if (streamResult.fallback) {
        const response = await diagnoseTunnel(tunnel.id);

        if (response.code === 0) {
          const resultData = response.data as DiagnosisResult;
          const successCount = resultData.results.filter(
            (r) => r.success,
          ).length;
          const failedCount = resultData.results.length - successCount;

          setDiagnosisResult(resultData);
          setDiagnosisProgress({
            total: resultData.results.length,
            completed: resultData.results.length,
            success: successCount,
            failed: failedCount,
            timedOut: false,
          });
        } else {
          toast.error(response.msg || "诊断失败");
          setDiagnosisResult(
            buildDiagnosisFallbackResult({
              tunnelName: tunnel.name,
              tunnelType: tunnel.type,
              description: "诊断失败",
              message: response.msg || "诊断过程中发生错误",
              ...diagnosisTarget,
            }),
          );
          setDiagnosisProgress({
            total: 1,
            completed: 1,
            success: 0,
            failed: 1,
            timedOut: false,
          });
        }

        return;
      }

      if (streamErrorMessage) {
        toast.error(streamErrorMessage);
      }
      if (streamResult.timedOut) {
        toast.error("诊断超时（单条30秒 / 整体2分钟），已返回当前结果");
      }
    } catch {
      if (abortController.signal.aborted) {
        return;
      }
      toast.error("网络错误，请重试");
      setDiagnosisResult(
        buildDiagnosisFallbackResult({
          tunnelName: tunnel.name,
          tunnelType: tunnel.type,
          description: "网络错误",
          message: "无法连接到服务器",
          ...diagnosisTarget,
        }),
      );
      setDiagnosisProgress({
        total: 1,
        completed: 1,
        success: 0,
        failed: 1,
        timedOut: false,
      });
    } finally {
      if (diagnosisAbortRef.current === abortController) {
        diagnosisAbortRef.current = null;
      }
      setDiagnosisLoading(false);
    }
  };

  return {
    diagnosisModalOpen,
    diagnosisLoading,
    currentDiagnosisTunnel,
    diagnosisResult,
    diagnosisProgress,
    closeDiagnosis,
    handleDiagnose,
  };
}
