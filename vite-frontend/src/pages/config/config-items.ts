import {
  Activity,
  Brush,
  CircleArrowUp,
  HardDriveDownload,
  Megaphone,
  Palette,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_TUNNEL_QUALITY_INTERVAL_SEC,
  TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
} from "@/config/tunnel-quality";
import { type BrandAssetKind } from "@/utils/brand-asset";

export interface ConfigItem {
  key: string;
  label: string;
  placeholder?: string;
  description?: string;
  type: "input" | "switch" | "select" | "bg_image";
  options?: { label: string; value: string; description?: string }[];
  dependsOn?: string; // 依赖的配置项key
  dependsValue?: string; // 依赖的配置项值
}

export type BgImageKey =
  | "app_bg_image"
  | "app_bg_image_light"
  | "app_bg_image_dark";

export const BRAND_PREVIEW_KEYS = ["app_logo", "app_favicon"] as const;

export type BrandPreviewKey = (typeof BRAND_PREVIEW_KEYS)[number];

export const isBrandPreviewKey = (key: string): key is BrandPreviewKey =>
  BRAND_PREVIEW_KEYS.includes(key as BrandPreviewKey);

export const BRAND_FILE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/svg+xml";

export const toBrandAssetKind = (key: BrandPreviewKey): BrandAssetKind => {
  return key === "app_logo" ? "logo" : "favicon";
};

// 网站配置项定义
export const CONFIG_ITEMS: ConfigItem[] = [
  {
    key: "app_bg_image",
    label: "背景壁纸",
    description:
      "默认背景用于未单独设置壁纸的模式。可分别上传亮色和暗色壁纸，保存后随外观模式自动切换。",
    type: "bg_image",
  },
  {
    key: "ip",
    label: "面板后端地址",
    placeholder: "请输入面板后端IP:PORT",
    description:
      '格式"ip:port"或"domain:port",用于对接节点时使用。支持套CDN和HTTPS,通讯数据有加密',
    type: "input",
  },
  {
    key: "panel_domain",
    label: "面板域名",
    placeholder: "请输入面板域名",
    description: "当前面板的域名，用于与其他面板进行联邦共享时验证身份",
    type: "input",
  },
  {
    key: "app_name",
    label: "应用名称",
    placeholder: "请输入应用名称",
    description: "在浏览器标签页和导航栏显示的应用名称",
    type: "input",
  },
  {
    key: "app_logo",
    label: "网页角标 Logo",
    description: "用于页面左上角导航角标，上传后会自动转换为 PNG 并持久化保存",
    type: "input",
  },
  {
    key: "app_favicon",
    label: "浏览器缩略图标",
    description: "用于浏览器标签页图标，上传后会自动转换为 PNG 并持久化保存",
    type: "input",
  },
  {
    key: "hide_footer_brand",
    label: "隐藏页面底部 FLVX 版权信息",
    description: "开启后不再显示侧栏、登录页与个人中心底部的 “Powered by FLVX”",
    type: "switch",
  },
  {
    key: "forward_compact_mode",
    label: "规则页面精简模式",
    description: "开启后，规则页面列表使用 2.1.6-alpha8 样式（全局配置）",
    type: "switch",
  },
  {
    key: "monitor_tunnel_quality_enabled",
    label: "实时隧道质量检测",
    description:
      "关闭后，前端停止自动刷新，后端停止实时隧道质量探测（全局配置）",
    type: "switch",
  },
  {
    key: TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
    label: "隧道质量探测间隔",
    placeholder: String(DEFAULT_TUNNEL_QUALITY_INTERVAL_SEC),
    description:
      "设置实时隧道质量检测的执行频率，单位为秒；允许 1–3600 秒，默认 1 秒。",
    type: "input",
    dependsOn: "monitor_tunnel_quality_enabled",
    dependsValue: "true",
  },
  {
    key: "monitor_retention_days",
    label: "监控数据保留天数",
    placeholder: "7",
    description:
      "统一清理节点指标、隧道流量、服务监控结果和隧道质量历史；默认 7 天。",
    type: "input",
  },
  {
    key: "captcha_enabled",
    label: "启用验证码",
    description: "开启后，用户登录时需要完成验证码验证",
    type: "switch",
  },
  {
    key: "cloudflare_site_key",
    label: "Cloudflare Site Key",
    placeholder: "请输入 Cloudflare Site Key",
    description: "Cloudflare Turnstile 站点密钥",
    type: "input",
    dependsOn: "captcha_enabled",
    dependsValue: "true",
  },
  {
    key: "cloudflare_secret_key",
    label: "Cloudflare Secret Key",
    placeholder: "请输入 Cloudflare Secret Key",
    description: "Cloudflare Turnstile 密钥",
    type: "input",
    dependsOn: "captcha_enabled",
    dependsValue: "true",
  },
  {
    key: "github_proxy_enabled",
    label: "开启 GitHub 加速",
    description: "用于节点更新和安装脚本下载，解决部分地区 GitHub 访问受限问题",
    type: "switch",
  },
  {
    key: "github_proxy_url",
    label: "加速地址",
    placeholder: "https://gcode.hostcentral.cc",
    description: "GitHub 下载加速代理地址，开启加速后生效",
    type: "input",
    dependsOn: "github_proxy_enabled",
    dependsValue: "true",
  },
  {
    key: "allow_local_remote_addr",
    label: "允许转发到本地地址",
    description:
      "开启后，普通用户创建或编辑规则时可将目标地址指向 127.0.0.1、10.x.x.x、172.16-31.x.x、192.168.x.x 等本地或内网地址。默认关闭以降低开放代理风险。",
    type: "switch",
  },
];

export const BACKUP_TYPE_OPTIONS = [
  { value: "users", label: "用户" },
  { value: "nodes", label: "节点" },
  { value: "tunnels", label: "隧道" },
  { value: "forwards", label: "规则" },
  { value: "userTunnels", label: "用户隧道权限" },
  { value: "speedLimits", label: "限速规则" },
  { value: "tunnelGroups", label: "隧道分组" },
  { value: "userGroups", label: "用户分组" },
  { value: "permissions", label: "分组权限" },
  { value: "configs", label: "系统配置" },
] as const;

export const BACKUP_TYPE_VALUES = BACKUP_TYPE_OPTIONS.map(
  (option) => option.value,
);

// 初始化时从缓存读取配置，避免闪烁
export const getInitialConfigs = (): Record<string, string> => {
  if (typeof window === "undefined") return {};

  const configKeys = [
    "app_name",
    "captcha_enabled",
    "cloudflare_site_key",
    "cloudflare_secret_key",
    "forward_compact_mode",
    "monitor_tunnel_quality_enabled",
    TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
    "monitor_retention_days",
    "ip",
    "panel_domain",
    "app_logo",
    "app_favicon",
    "app_bg_image",
    "app_bg_image_light",
    "app_bg_image_dark",
    "github_proxy_enabled",
    "github_proxy_url",
    "allow_local_remote_addr",
    "hide_footer_brand",
  ];
  const initialConfigs: Record<string, string> = {};

  try {
    configKeys.forEach((key) => {
      const cachedValue = localStorage.getItem("vite_config_" + key);

      if (cachedValue) {
        initialConfigs[key] = cachedValue;
      }
    });
  } catch {}

  return initialConfigs;
};

export const BRAND_KEYS = [
  "app_name",
  "app_logo",
  "app_favicon",
  "hide_footer_brand",
];

// Config keys per settings section; items not listed fall back to the first section.
export const CONFIG_SECTION_KEYS: { keys: string[] }[] = [
  {
    keys: [
      "ip",
      "panel_domain",
      "captcha_enabled",
      "cloudflare_site_key",
      "cloudflare_secret_key",
      "allow_local_remote_addr",
    ],
  },
  { keys: ["app_bg_image", "forward_compact_mode"] },
  {
    keys: [
      "monitor_tunnel_quality_enabled",
      TUNNEL_QUALITY_INTERVAL_CONFIG_KEY,
      "monitor_retention_days",
    ],
  },
  { keys: ["github_proxy_enabled", "github_proxy_url"] },
];

export const CONFIG_SECTIONS: {
  id: string;
  title: string;
  icon: LucideIcon;
}[] = [
  { id: "config-access", title: "访问与安全", icon: ShieldCheck },
  { id: "config-appearance", title: "外观", icon: Palette },
  { id: "config-monitor", title: "监控", icon: Activity },
  { id: "config-upgrade", title: "更新与升级", icon: CircleArrowUp },
  { id: "config-brand", title: "站点品牌", icon: Brush },
  { id: "config-announcement", title: "公告", icon: Megaphone },
  { id: "config-backup", title: "数据备份", icon: HardDriveDownload },
];
