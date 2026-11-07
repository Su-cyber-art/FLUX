import type {
  SystemUpgradeCheckApiData,
  SystemUpgradeReleaseApiItem,
  SystemUpgradeRunApiData,
  SystemUpgradeVersionApiData,
} from "@/api/types";

import {
  ActionIcon,
  Button,
  Checkbox,
  Loader,
  Select,
  Switch,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  Activity,
  Brush,
  Image as ImageIcon,
  Moon,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  checkSystemUpgrade,
  exportBackup,
  getAnnouncement,
  getStorageSummary,
  getSystemUpgradeVersion,
  importBackup,
  recoverSystemUpgrade,
  runSystemUpgrade,
  updateAnnouncement,
  updateConfigs,
  type AnnouncementData,
} from "@/api";
import { SectionHeader } from "@/components/section-header";
import { describedSelectProps } from "@/components/select-options";
import { SystemUpgradeProgress } from "@/components/system-upgrade-progress";
import { ThemeSettings } from "@/components/theme-settings";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { configCache, getCachedConfigs, updateSiteConfig } from "@/config/site";
import {
  DEFAULT_TUNNEL_QUALITY_INTERVAL_SEC,
  MAX_TUNNEL_QUALITY_INTERVAL_SEC,
  MIN_TUNNEL_QUALITY_INTERVAL_SEC,
  parseTunnelQualityIntervalSeconds,
  TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
  validateTunnelQualityInterval,
} from "@/config/tunnel-quality";
import { useSystemUpgrade } from "@/hooks/use-system-upgrade";
import toast from "@/lib/notifications";
import { AnnouncementCard } from "@/pages/config/announcement-card";
import { BackupCard } from "@/pages/config/backup-card";
import {
  BACKUP_TYPE_OPTIONS,
  BACKUP_TYPE_VALUES,
  BgImageKey,
  BRAND_FILE_ACCEPT,
  BRAND_KEYS,
  BrandPreviewKey,
  CONFIG_ITEMS,
  CONFIG_SECTION_KEYS,
  CONFIG_SECTIONS,
  ConfigItem,
  getInitialConfigs,
  isBrandPreviewKey,
  toBrandAssetKind,
} from "@/pages/config/config-items";
import { SystemUpgradeConfirmModal } from "@/pages/config/system-upgrade-confirm-modal";
import { UpdateSettingsCard } from "@/pages/config/update-settings-card";
import { isAdmin } from "@/utils/auth";
import {
  convertBrandAssetToPngDataURL,
  isPngDataURL,
} from "@/utils/brand-asset";
import {
  getUpdateReleaseChannel,
  setUpdateReleaseChannel,
  type UpdateReleaseChannel,
} from "@/utils/version-update";

// 网站配置项定义
// 初始化时从缓存读取配置，避免闪烁
// Config keys per settings section; items not listed fall back to the first section.

export default function ConfigPage() {
  const navigate = useNavigate();
  const initialConfigs = getInitialConfigs();
  const [configs, setConfigs] =
    useState<Record<string, string>>(initialConfigs);
  const [loading, setLoading] = useState(
    Object.keys(initialConfigs).length === 0,
  );
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeSection, setActiveSection] = useState(CONFIG_SECTIONS[0].id);
  const navLockRef = useRef(false);
  const [originalConfigs, setOriginalConfigs] =
    useState<Record<string, string>>(initialConfigs);

  const [exportTypes, setExportTypes] = useState<string[]>([]);
  const [importTypes, setImportTypes] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportSelectorOpen, setExportSelectorOpen] = useState(false);
  const [importSelectorOpen, setImportSelectorOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);
  const bgImageFileInputRefs = useRef<
    Partial<Record<BgImageKey, HTMLInputElement>>
  >({});
  const [bgImageUploading, setBgImageUploading] = useState<BgImageKey | null>(
    null,
  );

  const [announcement, setAnnouncement] = useState<AnnouncementData>({
    content: "",
    enabled: 0,
  });
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [updateChannel, setUpdateChannel] = useState<UpdateReleaseChannel>(
    getUpdateReleaseChannel(),
  );
  const [systemUpgradeInfo, setSystemUpgradeInfo] =
    useState<SystemUpgradeVersionApiData | null>(null);
  const [systemUpgradeChecking, setSystemUpgradeChecking] = useState(false);
  const [systemUpgradeExecuting, setSystemUpgradeExecuting] = useState(false);
  const upgrade = useSystemUpgrade(isAdmin());
  const [upgradeProgressOpen, setUpgradeProgressOpen] = useState(false);
  const systemUpgradeInProgress =
    systemUpgradeExecuting || upgrade.job?.status === "running";

  const previousUpgradeStatus = useRef(upgrade.job?.status);

  useEffect(() => {
    const status = upgrade.job?.status;
    const finishedHere =
      previousUpgradeStatus.current === "running" && status !== "running";

    previousUpgradeStatus.current = status;
    // Show the result of an upgrade watched from this tab (it may have been
    // sent to the background), and any job that left maintenance enabled.
    if (status === "running" || finishedHere || upgrade.job?.maintenance) {
      setUpgradeProgressOpen(true);
    }
  }, [upgrade.job?.id, upgrade.job?.status, upgrade.job?.maintenance]);
  const [systemUpgradeLoading, setSystemUpgradeLoading] = useState(true);
  const [systemUpgradeModalOpen, setSystemUpgradeModalOpen] = useState(false);
  const [systemUpgradeReleases, setSystemUpgradeReleases] = useState<
    SystemUpgradeReleaseApiItem[]
  >([]);
  const [systemUpgradeCheckedChannel, setSystemUpgradeCheckedChannel] =
    useState<UpdateReleaseChannel | null>(null);
  const [systemUpgradeSelectedVersion, setSystemUpgradeSelectedVersion] =
    useState("");
  const [previewLoadFailed, setPreviewLoadFailed] = useState<
    Partial<Record<BrandPreviewKey, boolean>>
  >({});
  const [brandUploading, setBrandUploading] = useState<
    Partial<Record<BrandPreviewKey, boolean>>
  >({});
  const [storageSummary, setStorageSummary] = useState("加载中...");
  const systemUpgradeReleasesMatchChannel =
    systemUpgradeCheckedChannel === updateChannel;
  const systemUpgradeHasConfirmedUpdate = Boolean(
    systemUpgradeInfo?.hasUpdate &&
      systemUpgradeReleasesMatchChannel &&
      systemUpgradeReleases.length > 0,
  );
  const canTriggerSystemUpgrade = Boolean(
    !systemUpgradeLoading &&
      !systemUpgradeChecking &&
      !systemUpgradeInProgress &&
      systemUpgradeInfo?.capability.capable !== false,
  );
  const canOpenSystemUpgradeModal = Boolean(
    systemUpgradeInfo?.capability.capable &&
      systemUpgradeHasConfirmedUpdate &&
      !systemUpgradeLoading &&
      !systemUpgradeChecking &&
      !systemUpgradeInProgress,
  );

  useEffect(() => {
    if (!isAdmin()) {
      toast.error("权限不足，只有管理员可以访问此页面");
      navigate("/dashboard", { replace: true });

      return;
    }
  }, [navigate]);

  // 加载配置数据（优先从缓存）
  const loadConfigs = async (currentConfigs?: Record<string, string>) => {
    const configsToCompare = currentConfigs || configs;
    const hasInitialData = Object.keys(configsToCompare).length > 0;

    // 如果已有缓存数据，不显示loading，静默更新
    if (!hasInitialData) {
      setLoading(true);
    }

    try {
      const configData = await getCachedConfigs();

      // 只有在数据有变化时才更新
      const hasDataChanged =
        JSON.stringify(configData) !== JSON.stringify(configsToCompare);

      if (hasDataChanged) {
        setConfigs(configData);
        setOriginalConfigs({ ...configData });
        setHasChanges(false);
      } else {
      }
    } catch {
      // 只有在没有缓存数据时才显示错误
      if (!hasInitialData) {
        toast.error("加载配置出错，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStorageSummary = async () => {
    try {
      const response = await getStorageSummary();

      if (response.code === 0 && response.data?.databaseSizeText) {
        setStorageSummary(response.data.databaseSizeText);

        return;
      }
      setStorageSummary("获取失败");
    } catch {
      setStorageSummary("获取失败");
    }
  };

  const loadSystemUpgradeInfo = async (channel = updateChannel) => {
    setSystemUpgradeLoading(true);
    try {
      const response = await getSystemUpgradeVersion(channel);

      if (response.code === 0 && response.data) {
        setSystemUpgradeInfo({
          ...response.data,
          channel,
          hasUpdate:
            response.data.channel === channel ? response.data.hasUpdate : false,
          latestVersion:
            response.data.channel === channel
              ? response.data.latestVersion
              : "",
        });
      } else {
        setSystemUpgradeInfo(null);
      }
    } catch {
      setSystemUpgradeInfo(null);
    } finally {
      setSystemUpgradeLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadConfigs(initialConfigs);
      loadAnnouncement();
      loadStorageSummary();
      void loadSystemUpgradeInfo();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const loadAnnouncement = async () => {
    setAnnouncementLoading(true);
    try {
      const res = await getAnnouncement();

      if (res.code === 0 && res.data) {
        setAnnouncement(res.data);
      }
    } catch {
    } finally {
      setAnnouncementLoading(false);
    }
  };

  const saveAnnouncement = async () => {
    setAnnouncementSaving(true);
    try {
      const res = await updateAnnouncement(announcement);

      if (res.code === 0) {
        toast.success("公告保存成功");
      } else {
        toast.error(res.msg || "保存失败");
      }
    } catch {
      toast.error("保存公告失败，请重试");
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const handleUpdateChannelChange = (channel: UpdateReleaseChannel) => {
    setUpdateChannel(channel);
    setUpdateReleaseChannel(channel);
    setSystemUpgradeSelectedVersion("");
    setSystemUpgradeReleases([]);
    setSystemUpgradeCheckedChannel(null);
    void loadSystemUpgradeInfo(channel);
    toast.success(
      `更新通道已切换为${channel === "stable" ? "稳定版" : "开发版"}`,
    );
  };

  const handleCheckSystemUpgrade = async () => {
    const channel = updateChannel;

    setSystemUpgradeChecking(true);
    try {
      const response = await checkSystemUpgrade(channel);

      if (response.code === 0 && response.data) {
        const data = response.data as SystemUpgradeCheckApiData;

        setSystemUpgradeInfo(data);
        setSystemUpgradeReleases(data.releases || []);
        setSystemUpgradeCheckedChannel(channel);
        setSystemUpgradeSelectedVersion("");
        if (data.latestVersion && !data.hasUpdate) {
          toast.success("当前已是最新版本");

          return false;
        }
        toast.success(
          data.latestVersion
            ? `已检查到最新版本 ${data.latestVersion}`
            : "未获取到可用版本",
        );

        return Boolean(
          data.capability.capable && data.hasUpdate && data.releases?.length,
        );
      } else {
        setSystemUpgradeReleases([]);
        setSystemUpgradeCheckedChannel(null);
        toast.error(response.msg || "检查更新失败");
      }
    } catch {
      setSystemUpgradeReleases([]);
      setSystemUpgradeCheckedChannel(null);
      toast.error("检查更新失败，请重试");
    } finally {
      setSystemUpgradeChecking(false);
    }

    return false;
  };

  const handleOpenSystemUpgradeModal = async () => {
    if (upgrade.job?.status === "running") {
      setUpgradeProgressOpen(true);

      return;
    }
    if (!canOpenSystemUpgradeModal) {
      const checked = await handleCheckSystemUpgrade();

      if (!checked) {
        return;
      }
    }
    setSystemUpgradeModalOpen(true);
  };

  const handleRecoverSystemUpgrade = async () => {
    const response = await recoverSystemUpgrade();

    if (response.code === 0) {
      if (response.data) upgrade.track(response.data);
      else upgrade.refresh();
      toast.success("服务检查通过，已解除维护状态");
    } else {
      toast.error(response.msg || "解除维护状态失败");
    }
  };

  const handleConfirmSystemUpgrade = async () => {
    setSystemUpgradeExecuting(true);
    try {
      const response = await runSystemUpgrade(
        systemUpgradeSelectedVersion || undefined,
        updateChannel,
      );

      if (response.code === 0 && response.data) {
        const data = response.data as SystemUpgradeRunApiData;

        setSystemUpgradeModalOpen(false);
        setSystemUpgradeSelectedVersion("");
        if (data.job) {
          upgrade.track(data.job);
          setUpgradeProgressOpen(true);
        } else {
          toast.success(
            "升级请求已提交，当前后端尚不支持进度查询，请稍后检查版本",
          );
        }
      } else {
        toast.error(response.msg || "面板升级失败");
      }
    } catch {
      toast.error("面板升级失败，请重试");
    } finally {
      setSystemUpgradeExecuting(false);
    }
  };

  const handleConfigChange = (key: string, value: string) => {
    const newConfigs = { ...configs, [key]: value };

    setConfigs(newConfigs);

    if (isBrandPreviewKey(key)) {
      setPreviewLoadFailed((prev) => ({ ...prev, [key]: false }));
    }

    const hasChangesNow =
      Object.keys(newConfigs).some(
        (k) => newConfigs[k] !== originalConfigs[k],
      ) ||
      Object.keys(originalConfigs).some(
        (k) => originalConfigs[k] !== newConfigs[k],
      );

    setHasChanges(hasChangesNow);
  };

  // 保存配置
  const handleSave = async () => {
    const intervalValue = configs[TUNNEL_QUALITY_INTERVAL_CONFIG_KEY];
    const intervalChanged =
      intervalValue !== originalConfigs[TUNNEL_QUALITY_INTERVAL_CONFIG_KEY];
    const intervalError = intervalChanged
      ? validateTunnelQualityInterval(intervalValue || "")
      : null;

    if (intervalError) {
      toast.error(intervalError);

      return;
    }

    setSaving(true);
    try {
      const changedKeys = Object.keys(configs).filter(
        (key) => configs[key] !== originalConfigs[key],
      );

      if (changedKeys.length === 0) {
        setHasChanges(false);

        return;
      }

      const changedPayload: Record<string, string> = {};

      changedKeys.forEach((key) => {
        changedPayload[key] = configs[key] || "";
      });

      const response = await updateConfigs(changedPayload);

      if (response.code === 0) {
        toast.success("配置保存成功");

        Object.entries(configs).forEach(([key, value]) => {
          configCache.set(key, value);
        });

        setOriginalConfigs({ ...configs });
        setHasChanges(false);

        if (
          changedKeys.some((key) =>
            [
              "app_name",
              "app_logo",
              "app_favicon",
              "app_bg_image",
              "app_bg_image_light",
              "app_bg_image_dark",
            ].includes(key),
          )
        ) {
          await updateSiteConfig(configs);
        }

        // 触发配置更新事件，通知其他组件
        window.dispatchEvent(
          new CustomEvent("configUpdated", {
            detail: { changedKeys },
          }),
        );

        // 如果隧道质量检测配置变更，通知 tunnel-monitor-view
        if (
          changedKeys.some((key) =>
            [
              "monitor_tunnel_quality_enabled",
              TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
            ].includes(key),
          )
        ) {
          window.dispatchEvent(
            new CustomEvent("monitorTunnelQualityEnabledChanged", {
              detail: {
                enabled: configs["monitor_tunnel_quality_enabled"] === "true",
                intervalSec: parseTunnelQualityIntervalSeconds(
                  configs[TUNNEL_QUALITY_INTERVAL_CONFIG_KEY],
                ),
              },
            }),
          );
        }
      } else {
        toast.error("保存配置失败: " + response.msg);
      }
    } catch {
      toast.error("保存配置出错，请重试");
    } finally {
      setSaving(false);
    }
  };

  // 检查配置项是否应该显示（依赖检查）
  const shouldShowItem = (item: ConfigItem): boolean => {
    // 品牌设置项在“站点品牌”卡片中单独展示
    if (
      ["app_name", "app_logo", "app_favicon", "hide_footer_brand"].includes(
        item.key,
      )
    ) {
      return false;
    }

    if (!item.dependsOn || !item.dependsValue) {
      return true;
    }

    return configs[item.dependsOn] === item.dependsValue;
  };

  const getBrandInputRef = (key: BrandPreviewKey) => {
    return key === "app_logo" ? logoFileInputRef : faviconFileInputRef;
  };

  const triggerBrandFilePicker = (key: BrandPreviewKey) => {
    if (brandUploading[key]) {
      return;
    }

    getBrandInputRef(key).current?.click();
  };

  const clearBrandAsset = (key: BrandPreviewKey) => {
    handleConfigChange(key, "");
    setPreviewLoadFailed((prev) => ({ ...prev, [key]: false }));
  };

  const handleBrandFileChange = async (
    key: BrandPreviewKey,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBrandUploading((prev) => ({ ...prev, [key]: true }));

    try {
      const pngDataURL = await convertBrandAssetToPngDataURL(
        file,
        toBrandAssetKind(key),
      );

      handleConfigChange(key, pngDataURL);
      toast.success(key === "app_logo" ? "Logo 上传成功" : "Favicon 上传成功");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "图片处理失败，请重试";

      toast.error(message);
    } finally {
      setBrandUploading((prev) => ({ ...prev, [key]: false }));
      event.target.value = "";
    }
  };

  const handleBgImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    key: BgImageKey,
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("只能上传图片文件");

      return;
    }

    setBgImageUploading(key);
    try {
      const compressedImage = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
          const img = new Image();

          img.onload = () => {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1080;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              reject(new Error("Canvas context is null"));

              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Output as webp for better compression
            const dataUrl = canvas.toDataURL("image/webp", 0.8);

            resolve(dataUrl);
          };
          img.onerror = () => reject(new Error("图片加载失败"));
          img.src = event.target?.result as string;
        };
        reader.onerror = () => reject(new Error("文件读取失败"));
        reader.readAsDataURL(file);
      });

      handleConfigChange(key, compressedImage);
      toast.success("壁纸上传成功，保存配置后生效");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "图片处理失败");
    } finally {
      setBgImageUploading(null);
      e.target.value = "";
    }
  };

  const renderBgImageUploader = (
    key: BgImageKey,
    label: string,
    Icon: LucideIcon,
  ) => {
    const bgImage = configs[key] || "";
    const isDefault = key === "app_bg_image";
    const isImage =
      bgImage.startsWith("http") ||
      bgImage.startsWith("data:") ||
      bgImage.startsWith("/") ||
      bgImage.startsWith("blob:");
    const isTheme = bgImage === "theme";
    const isSolidColor = bgImage && !isImage && !isTheme;
    const busy = bgImageUploading !== null;
    const status = isImage
      ? "自定义图片"
      : isTheme
        ? "自适应纯色，跟随深色模式"
        : isSolidColor
          ? `纯色 ${bgImage}`
          : isDefault
            ? "内置背景"
            : "未单独设置，沿用默认背景";

    return (
      <div className="wallpaper-tile">
        <div
          className="wallpaper-preview"
          data-kind={
            isImage
              ? "image"
              : isTheme
                ? "theme"
                : isSolidColor
                  ? "solid"
                  : "none"
          }
          style={isSolidColor ? { backgroundColor: bgImage } : undefined}
        >
          {isImage ? (
            <img alt={`${label}预览`} src={bgImage} />
          ) : (
            <Icon className="text-default-400" size={20} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Icon className="text-default-500" size={14} />
              {label}
            </p>
            <p
              className="mt-0.5 truncate text-xs text-default-500"
              title={status}
            >
              {status}
            </p>
          </div>
          <input
            ref={(node) => {
              if (node) bgImageFileInputRefs.current[key] = node;
            }}
            accept="image/*"
            className="hidden"
            type="file"
            onChange={(event) => void handleBgImageUpload(event, key)}
          />
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <Button
              disabled={busy && bgImageUploading !== key}
              leftSection={<Upload size={14} />}
              loading={bgImageUploading === key}
              size="xs"
              variant="light"
              onClick={() => bgImageFileInputRefs.current[key]?.click()}
            >
              {isImage ? "替换" : "上传"}
            </Button>
            {isDefault && (
              <>
                <Button
                  color="gray"
                  disabled={busy || isTheme}
                  size="xs"
                  variant="subtle"
                  onClick={() => handleConfigChange(key, "theme")}
                >
                  自适应纯色
                </Button>
                <Button
                  color="gray"
                  disabled={busy || bgImage === "#ffffff"}
                  size="xs"
                  variant="subtle"
                  onClick={() => handleConfigChange(key, "#ffffff")}
                >
                  白色
                </Button>
              </>
            )}
            {bgImage && (
              <Tooltip label={isDefault ? "恢复内置背景" : "清除专属壁纸"}>
                <ActionIcon
                  aria-label={isDefault ? "恢复内置背景" : "清除专属壁纸"}
                  className="ml-auto"
                  color="red"
                  disabled={busy}
                  variant="subtle"
                  onClick={() => handleConfigChange(key, "")}
                >
                  <RotateCcw size={15} />
                </ActionIcon>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBrandPreview = (key: BrandPreviewKey) => {
    const previewUrl = (configs[key] || "").trim();
    const appNamePreview = (configs.app_name || "").trim() || "应用名称";
    const failed = previewLoadFailed[key] === true;
    const showImage = previewUrl.length > 0 && !failed;

    return (
      <div className="mt-3 rounded-lg border border-divider bg-default-soft p-3">
        <p className="text-xs text-default-500">实时预览</p>
        <div className="mt-2 rounded-md border border-divider bg-content1 px-3 py-2">
          {key === "app_logo" ? (
            <div className="flex h-10 items-center gap-2">
              {showImage ? (
                <img
                  alt="logo preview"
                  className="h-7 w-7 rounded-sm border border-divider object-cover"
                  src={previewUrl}
                  onError={() =>
                    setPreviewLoadFailed((prev) => ({ ...prev, [key]: true }))
                  }
                  onLoad={() =>
                    setPreviewLoadFailed((prev) => ({ ...prev, [key]: false }))
                  }
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-default-200 text-[10px] font-semibold text-default-600">
                  LOGO
                </div>
              )}
              <span className="truncate text-sm font-semibold text-foreground">
                {appNamePreview}
              </span>
            </div>
          ) : (
            <div className="flex h-7 max-w-[260px] items-center gap-2 rounded border border-divider bg-default-100 px-2">
              {showImage ? (
                <img
                  alt="favicon preview"
                  className="h-4 w-4 rounded-sm object-contain"
                  src={previewUrl}
                  onError={() =>
                    setPreviewLoadFailed((prev) => ({ ...prev, [key]: true }))
                  }
                  onLoad={() =>
                    setPreviewLoadFailed((prev) => ({ ...prev, [key]: false }))
                  }
                />
              ) : (
                <div className="h-4 w-4 rounded-sm bg-default-300" />
              )}
              <span className="truncate text-xs text-default-700">
                {appNamePreview}
              </span>
            </div>
          )}
        </div>

        {previewUrl.length === 0 ? (
          <p className="mt-2 text-xs text-default-500">
            上传图片后会实时显示预览
          </p>
        ) : null}

        {previewUrl.length > 0 && failed ? (
          <p className="mt-2 text-xs text-danger">图片加载失败，请重新上传</p>
        ) : null}

        {previewUrl.length > 0 && !isPngDataURL(previewUrl) ? (
          <p className="mt-2 text-xs text-warning-ink">
            当前是旧版 URL 配置，建议重新上传图片以启用无闪烁加载
          </p>
        ) : null}
      </div>
    );
  };

  const renderBrandAssetUploader = (
    key: BrandPreviewKey,
    isChanged: boolean,
  ) => {
    const value = (configs[key] || "").trim();
    const uploading = brandUploading[key] === true;
    const isLogo = key === "app_logo";

    return (
      <div
        className={`rounded-lg border p-3 ${
          isChanged ? "border-warning-line" : "border-divider"
        }`}
      >
        <input
          ref={getBrandInputRef(key)}
          accept={BRAND_FILE_ACCEPT}
          className="hidden"
          disabled={uploading}
          type="file"
          onChange={(event) => {
            void handleBrandFileChange(key, event);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            loading={uploading}
            size="xs"
            variant="light"
            onClick={() => triggerBrandFilePicker(key)}
          >
            {value.length > 0
              ? isLogo
                ? "替换 Logo"
                : "替换 Favicon"
              : isLogo
                ? "上传 Logo"
                : "上传 Favicon"}
          </Button>
          <Button
            color="gray"
            disabled={value.length === 0 || uploading}
            size="xs"
            variant="subtle"
            onClick={() => clearBrandAsset(key)}
          >
            清除
          </Button>
          <span className="text-xs text-default-500">
            仅支持图片文件，自动转换为 PNG
          </span>
        </div>

        <p className="mt-2 text-xs text-default-500">
          {isLogo
            ? "建议上传方形图片，系统会统一转换为 96x96 PNG"
            : "建议上传方形图片，系统会统一转换为 64x64 PNG"}
        </p>

        {renderBrandPreview(key)}
      </div>
    );
  };

  // 渲染不同类型的配置项
  const renderConfigItem = (item: ConfigItem) => {
    const isChanged =
      hasChanges && configs[item.key] !== originalConfigs[item.key];

    switch (item.type) {
      case "bg_image":
        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {renderBgImageUploader("app_bg_image", "默认背景", ImageIcon)}
            {renderBgImageUploader("app_bg_image_light", "浅色模式", Sun)}
            {renderBgImageUploader("app_bg_image_dark", "深色模式", Moon)}
          </div>
        );

      case "input": {
        if (isBrandPreviewKey(item.key)) {
          return renderBrandAssetUploader(item.key, isChanged);
        }

        const isTunnelQualityInterval =
          item.key === TUNNEL_QUALITY_INTERVAL_CONFIG_KEY;
        const intervalValue = isTunnelQualityInterval
          ? (configs[item.key] ?? String(DEFAULT_TUNNEL_QUALITY_INTERVAL_SEC))
          : (configs[item.key] ?? "");
        const intervalError =
          isTunnelQualityInterval && configs[item.key] !== undefined
            ? validateTunnelQualityInterval(intervalValue)
            : null;

        return (
          <TextInput
            classNames={{
              input: "text-sm",
              wrapper: isChanged
                ? "border-warning-line data-[hover=true]:border-warning"
                : "",
            }}
            error={intervalError || undefined}
            max={
              isTunnelQualityInterval
                ? MAX_TUNNEL_QUALITY_INTERVAL_SEC
                : undefined
            }
            min={
              isTunnelQualityInterval
                ? MIN_TUNNEL_QUALITY_INTERVAL_SEC
                : undefined
            }
            placeholder={item.placeholder}
            rightSection={isTunnelQualityInterval ? "秒" : undefined}
            size="md"
            step={isTunnelQualityInterval ? 1 : undefined}
            type={isTunnelQualityInterval ? "number" : "text"}
            value={intervalValue}
            onChange={(e) => handleConfigChange(item.key, e.target.value)}
          />
        );
      }

      case "switch":
        return (
          <Switch
            checked={configs[item.key] === "true"}
            label={
              <>
                <span className="text-sm text-default-700">
                  {configs[item.key] === "true" ? "已启用" : "已禁用"}
                </span>
              </>
            }
            size="sm"
            onChange={({ currentTarget: { checked: checked } }) =>
              handleConfigChange(item.key, checked ? "true" : "false")
            }
          />
        );

      case "select":
        return (
          <Select
            {...describedSelectProps(
              item.options?.map((option) => ({
                value: String(option.value),
                label: option.label,
                description: option.description,
              })) || [],
            )}
            classNames={{
              input: isChanged
                ? "border-warning-line data-[hover=true]:border-warning"
                : "",
            }}
            placeholder="请选择验证码类型"
            size="md"
            value={configs[item.key] ? configs[item.key] : null}
            onChange={(value) => {
              const selectedKey = value as string;

              if (selectedKey) {
                handleConfigChange(item.key, selectedKey);
              }
            }}
          />
        );

      default:
        return null;
    }
  };

  const handleExport = async () => {
    if (exportTypes.length === 0) {
      toast.error("请至少选择一种数据类型");

      return;
    }
    setExporting(true);
    try {
      await exportBackup(exportTypes);
      toast.success("导出成功");
      setExportSelectorOpen(false);
    } catch {
      toast.error("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const triggerImportFilePicker = () => {
    if (importTypes.length === 0) {
      toast.error("请先选择要导入的数据类型");

      return;
    }

    setImportSelectorOpen(false);
    requestAnimationFrame(() => backupFileInputRef.current?.click());
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (importTypes.length === 0) {
      toast.error("请先选择要导入的数据类型");

      return;
    }

    setImportFileName(file.name);
    setImporting(true);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const response = await importBackup({
        types: importTypes,
        ...data,
      });

      if (response.code === 0) {
        toast.success(`导入成功: ${JSON.stringify(response.data)}`);
        setImportTypes([]);
        setImportFileName("");
      } else {
        toast.error("导入失败: " + response.msg);
      }
    } catch {
      toast.error("导入失败，请检查文件格式");
    } finally {
      setImporting(false);
      if (backupFileInputRef.current) {
        backupFileInputRef.current.value = "";
      }
    }
  };

  const toggleTypeSelection = (
    type: string,
    setTypes: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setTypes((prev) =>
      prev.includes(type)
        ? prev.filter((item) => item !== type)
        : [...prev, type],
    );
  };

  const isAllTypesSelected = (types: string[]) =>
    BACKUP_TYPE_VALUES.every((type) => types.includes(type));

  const renderTypeSelection = (
    label: string,
    selectedTypes: string[],
    setTypes: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const allSelected = isAllTypesSelected(selectedTypes);

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-default-700">{label}</span>
          <div className="flex items-center gap-2">
            <Button
              color="gray"
              size="xs"
              variant="light"
              onClick={() =>
                setTypes(allSelected ? [] : [...BACKUP_TYPE_VALUES])
              }
            >
              {allSelected ? "取消全选" : "全选"}
            </Button>
            <Button
              color="gray"
              size="xs"
              variant="subtle"
              onClick={() => setTypes([])}
            >
              清空
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BACKUP_TYPE_OPTIONS.map((option) => {
            const isSelected = selectedTypes.includes(option.value);

            return (
              <button
                key={option.value}
                aria-pressed={isSelected}
                className={`w-full px-4 py-3 rounded-lg border transition-all duration-200 cursor-pointer text-left ${
                  isSelected
                    ? "bg-primary-soft border-primary-line shadow-sm"
                    : "bg-content1 border-divider hover:border-primary-line hover:shadow-sm"
                }`}
                type="button"
                onClick={() => toggleTypeSelection(option.value, setTypes)}
              >
                <div className="flex items-center gap-3">
                  <Checkbox checked={isSelected} size="md" />
                  <span
                    className={`font-medium ${
                      isSelected ? "text-default-900" : "text-default-700"
                    }`}
                  >
                    {option.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (loading) return;
    // The section whose top has passed the sticky header is the active one;
    // a nav click keeps its section active until the user scrolls by hand.
    const update = (event?: Event) => {
      if (navLockRef.current) return;
      const first = document.getElementById(CONFIG_SECTIONS[0].id);
      const scroller =
        event?.target instanceof Element
          ? event.target
          : document.scrollingElement;

      if (!first || !scroller?.contains(first)) return;
      let current = CONFIG_SECTIONS[0].id;

      CONFIG_SECTIONS.forEach((section) => {
        const top = document
          .getElementById(section.id)
          ?.getBoundingClientRect().top;

        if (top !== undefined && top <= 160) current = section.id;
      });
      if (
        scroller.scrollTop > 0 &&
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 8
      ) {
        current = CONFIG_SECTIONS[CONFIG_SECTIONS.length - 1].id;
      }
      setActiveSection(current);
    };
    const unlock = () => {
      navLockRef.current = false;
    };

    update();
    document.addEventListener("scroll", update, {
      capture: true,
      passive: true,
    });
    ["wheel", "touchmove", "keydown"].forEach((name) =>
      window.addEventListener(name, unlock, { passive: true }),
    );

    return () => {
      document.removeEventListener("scroll", update, { capture: true });
      ["wheel", "touchmove", "keydown"].forEach((name) =>
        window.removeEventListener(name, unlock),
      );
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader aria-label="加载配置中..." role="status" size="lg" />
      </div>
    );
  }

  const renderItemRow = (item: ConfigItem, force = false) => {
    if (!force && !shouldShowItem(item)) return null;

    return (
      <div
        key={item.key}
        className="settings-row"
        data-wide={item.type === "bg_image" || undefined}
      >
        <div>
          <p className="settings-row-label">{item.label}</p>
          {item.description && (
            <p className="settings-row-desc">{item.description}</p>
          )}
        </div>
        <div className="min-w-0">{renderConfigItem(item)}</div>
      </div>
    );
  };
  const itemsFor = (keys: string[]) =>
    keys
      .map((key) => CONFIG_ITEMS.find((item) => item.key === key))
      .filter((item): item is ConfigItem => Boolean(item));
  const groupedKeys = new Set(CONFIG_SECTION_KEYS.flatMap((s) => s.keys));
  const ungroupedItems = CONFIG_ITEMS.filter(
    (item) => !groupedKeys.has(item.key) && !BRAND_KEYS.includes(item.key),
  );
  const discardChanges = () => {
    setConfigs({ ...originalConfigs });
    setHasChanges(false);
  };
  const scrollToSection = (id: string) => {
    navLockRef.current = true;
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="config-layout">
      <nav aria-label="设置分区" className="config-nav">
        {CONFIG_SECTIONS.map((section) => (
          <button
            key={section.id}
            className="config-nav-item"
            data-active={activeSection === section.id || undefined}
            type="button"
            onClick={() => scrollToSection(section.id)}
          >
            <section.icon size={15} />
            {section.title}
          </button>
        ))}
      </nav>

      <div className="min-w-0 space-y-5">
        <Card className="config-section" id="config-access">
          <CardHeader className="pb-3">
            <SectionHeader
              description="面板访问地址、登录验证与转发安全策略"
              icon={ShieldCheck}
              title="访问与安全"
            />
          </CardHeader>
          <CardBody className="pt-0">
            {itemsFor(CONFIG_SECTION_KEYS[0].keys).map((item) =>
              renderItemRow(item),
            )}
            {ungroupedItems.map((item) => renderItemRow(item))}
          </CardBody>
        </Card>

        <Card className="config-section" id="config-appearance">
          <CardHeader className="pb-3">
            <SectionHeader
              description="界面主题、背景壁纸与页面展示方式"
              icon={Palette}
              title="外观"
            />
          </CardHeader>
          <CardBody className="pt-0">
            <ThemeSettings />
            {itemsFor(CONFIG_SECTION_KEYS[1].keys).map((item) =>
              renderItemRow(item),
            )}
          </CardBody>
        </Card>

        <Card className="config-section" id="config-monitor">
          <CardHeader className="pb-3">
            <SectionHeader
              description="隧道质量探测与监控数据保留"
              icon={Activity}
              title="监控"
            />
          </CardHeader>
          <CardBody className="pt-0">
            {itemsFor(CONFIG_SECTION_KEYS[2].keys).map((item) =>
              renderItemRow(item),
            )}
          </CardBody>
        </Card>

        <UpdateSettingsCard
          canTriggerSystemUpgrade={canTriggerSystemUpgrade}
          handleCheckSystemUpgrade={handleCheckSystemUpgrade}
          handleOpenSystemUpgradeModal={handleOpenSystemUpgradeModal}
          handleUpdateChannelChange={handleUpdateChannelChange}
          itemsFor={itemsFor}
          renderItemRow={renderItemRow}
          setSystemUpgradeSelectedVersion={setSystemUpgradeSelectedVersion}
          setUpgradeProgressOpen={setUpgradeProgressOpen}
          storageSummary={storageSummary}
          systemUpgradeChecking={systemUpgradeChecking}
          systemUpgradeExecuting={systemUpgradeExecuting}
          systemUpgradeInProgress={systemUpgradeInProgress}
          systemUpgradeInfo={systemUpgradeInfo}
          systemUpgradeLoading={systemUpgradeLoading}
          systemUpgradeReleases={systemUpgradeReleases}
          systemUpgradeReleasesMatchChannel={systemUpgradeReleasesMatchChannel}
          systemUpgradeSelectedVersion={systemUpgradeSelectedVersion}
          updateChannel={updateChannel}
          upgrade={upgrade}
        />

        <Card className="config-section" id="config-brand">
          <CardHeader className="pb-3">
            <SectionHeader
              description="自定义应用名称、Logo、网站图标与页脚版权信息"
              icon={Brush}
              title="站点品牌"
            />
          </CardHeader>
          <CardBody className="pt-0">
            {itemsFor(BRAND_KEYS).map((item) => renderItemRow(item, true))}
          </CardBody>
        </Card>

        <AnnouncementCard
          announcement={announcement}
          announcementLoading={announcementLoading}
          announcementSaving={announcementSaving}
          saveAnnouncement={saveAnnouncement}
          setAnnouncement={setAnnouncement}
        />

        <BackupCard
          backupFileInputRef={backupFileInputRef}
          exportTypes={exportTypes}
          exporting={exporting}
          handleFileChange={handleFileChange}
          importFileName={importFileName}
          importTypes={importTypes}
          importing={importing}
          setExportSelectorOpen={setExportSelectorOpen}
          setImportSelectorOpen={setImportSelectorOpen}
        />

        {hasChanges && (
          <div className="config-save-bar" role="status">
            <span className="flex items-center gap-2 text-sm font-medium text-warning-ink">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning" />
              有未保存的配置修改
            </span>
            <div className="ml-auto flex gap-2">
              <Button color="gray" variant="subtle" onClick={discardChanges}>
                放弃修改
              </Button>
              <Button
                leftSection={<Save size={15} />}
                loading={saving}
                onClick={handleSave}
              >
                保存配置
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal
        opened={exportSelectorOpen}
        onClose={() => setExportSelectorOpen(false)}
      >
        <ModalContent>
          <ModalHeader>选择导出内容</ModalHeader>
          <ModalBody>
            {renderTypeSelection("导出内容", exportTypes, setExportTypes)}
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setExportSelectorOpen(false)}
            >
              取消
            </Button>
            <Button loading={exporting} onClick={handleExport}>
              {exporting ? "导出中..." : "确认导出"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        opened={importSelectorOpen}
        onClose={() => setImportSelectorOpen(false)}
      >
        <ModalContent>
          <ModalHeader>选择导入内容</ModalHeader>
          <ModalBody>
            {renderTypeSelection("导入内容", importTypes, setImportTypes)}
          </ModalBody>
          <ModalFooter>
            <Button
              color="gray"
              variant="subtle"
              onClick={() => setImportSelectorOpen(false)}
            >
              取消
            </Button>
            <Button
              disabled={importTypes.length === 0}
              onClick={triggerImportFilePicker}
            >
              下一步选择文件
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <SystemUpgradeConfirmModal
        handleConfirmSystemUpgrade={handleConfirmSystemUpgrade}
        setSystemUpgradeModalOpen={setSystemUpgradeModalOpen}
        systemUpgradeExecuting={systemUpgradeExecuting}
        systemUpgradeInfo={systemUpgradeInfo}
        systemUpgradeModalOpen={systemUpgradeModalOpen}
        systemUpgradeSelectedVersion={systemUpgradeSelectedVersion}
      />

      <SystemUpgradeProgress
        job={upgrade.job}
        opened={upgradeProgressOpen}
        reconnecting={upgrade.reconnecting}
        onClose={() => setUpgradeProgressOpen(false)}
        onRecover={handleRecoverSystemUpgrade}
      />
    </div>
  );
}
