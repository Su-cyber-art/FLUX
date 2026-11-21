import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  AppShell,
  Avatar,
  Box,
  Burger,
  Button,
  Group,
  Kbd,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure, useHotkeys } from "@mantine/hooks";
import {
  ChevronRight,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";

import { navigation } from "@/config/navigation";
import { useSession } from "@/hooks/use-session";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useH5Mode } from "@/hooks/useH5Mode";
import { useThemeContext } from "@/themes/context";
import { BrandLogo } from "@/components/brand-logo";
import { PageLoadingState } from "@/components/page-state";
import { PageErrorBoundary } from "@/components/page-error-boundary";
import { VersionFooter } from "@/components/version-footer";
import { IconTile } from "@/components/ui/icon-tile";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { getMonitorAccess } from "@/api";
import { safeLogout } from "@/utils/logout";

const greeting = () => {
  const hour = new Date().getHours();

  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 13) return "中午好";
  if (hour < 18) return "下午好";

  return "晚上好";
};

export default function ApplicationLayout() {
  const session = useSession();
  const config = useSiteConfig();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useH5Mode();
  const { effectiveMode, setMode } = useThemeContext();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure();
  const [searchOpened, { open: openSearch, close: closeSearch }] =
    useDisclosure();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true",
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const [monitorAllowed, setMonitorAllowed] = useState<boolean | null>(
    session.isAdmin ? true : null,
  );
  const mainRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const current =
    navigation.find((item) => item.path === location.pathname) ?? navigation[0];
  const available = navigation.filter(
    (item) => !item.adminOnly || session.isAdmin,
  );
  const matches = available.filter(
    (item) =>
      (item.title + item.description).includes(search.trim()) &&
      (item.path !== "/monitor" || monitorAllowed),
  );

  const openMatch = (index: number) => {
    const match = matches[index];

    if (!match) return;
    navigate(match.path);
    closeSearch();
  };

  useHotkeys([["mod+K", () => openSearch()]]);
  useEffect(() => {
    closeMobile();
    closeSearch();
    setSearch("");
    setSelected(0);
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (session.isAdmin) {
      setMonitorAllowed(true);

      return;
    }
    let cancelled = false;

    setMonitorAllowed(null);
    const refreshAccess = () => {
      void getMonitorAccess()
        .then((response) => {
          if (!cancelled)
            setMonitorAllowed(
              response.code === 0 ? Boolean(response.data?.allowed) : true,
            );
        })
        .catch(() => {
          if (!cancelled) setMonitorAllowed(true);
        });
    };

    refreshAccess();
    window.addEventListener("focus", refreshAccess);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshAccess);
    };
  }, [session.isAdmin, session.token, location.pathname]);
  const compact = collapsed && !isMobile;
  const denied =
    (current.adminOnly && !session.isAdmin) ||
    (current.path === "/monitor" && monitorAllowed === false);
  const toggleSidebar = () => {
    setCollapsed((previous) => {
      localStorage.setItem("sidebar_collapsed", String(!previous));

      return !previous;
    });
  };

  const userName = session.name || "用户";
  const roleName = session.isAdmin ? "管理员" : "成员";
  const themeLabel = effectiveMode === "dark" ? "切换浅色模式" : "切换深色模式";
  const themeToggle = (
    <Tooltip label={themeLabel} position="bottom">
      <ActionIcon
        aria-label={themeLabel}
        color="gray"
        variant="subtle"
        onClick={(event) =>
          setMode(effectiveMode === "dark" ? "light" : "dark", {
            x: event.clientX,
            y: event.clientY,
          })
        }
      >
        {effectiveMode === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </ActionIcon>
    </Tooltip>
  );
  // Desktop keeps the account in the sidebar; phones keep it in the top bar.
  const userMenu = (
    <Menu
      withinPortal
      position="bottom-end"
      shadow="md"
      width={220}
      zIndex={450}
    >
      <Menu.Target>
        <UnstyledButton aria-label="账号菜单" className="app-user-menu">
          <Avatar color="initials" name={userName} radius="xl" size={26} />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-2">
          <Avatar color="initials" name={userName} radius="xl" size={32} />
          <div className="min-w-0">
            <Text truncate fw={600} size="sm">
              {userName}
            </Text>
            <Text c="dimmed" size="xs">
              {roleName}
            </Text>
          </div>
        </div>
        <Menu.Divider />
        <Menu.Item
          component={Link}
          leftSection={<UserRound size={15} />}
          to="/profile"
        >
          个人中心
        </Menu.Item>
        {session.isAdmin && (
          <Menu.Item
            component={Link}
            leftSection={<Settings size={15} />}
            to="/config"
          >
            系统设置
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item
          color="red"
          leftSection={<LogOut size={15} />}
          onClick={() => safeLogout()}
        >
          退出登录
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
  const sidebarToggle = (
    <Tooltip label={compact ? "展开侧栏" : "收起侧栏"} position="right">
      <ActionIcon
        aria-label={compact ? "展开侧栏" : "收起侧栏"}
        color="gray"
        variant="subtle"
        onClick={toggleSidebar}
      >
        {compact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </ActionIcon>
    </Tooltip>
  );

  const breadcrumb = (
    <nav aria-label="当前位置" className="app-breadcrumb">
      <span className="app-breadcrumb-group">{current.group}</span>
      <ChevronRight aria-hidden size={14} />
      <span className="app-breadcrumb-current">{current.title}</span>
    </nav>
  );

  return (
    <AppShell
      className="app-shell"
      data-compact={compact || undefined}
      data-mobile={isMobile || undefined}
      header={{
        height: isMobile
          ? "calc(52px + env(safe-area-inset-top, 0px))"
          : "var(--header-height)",
      }}
      navbar={{
        width: compact ? 64 : 232,
        breakpoint: isMobile ? 100000 : "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding={0}
      transitionDuration={220}
      transitionTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
    >
      <AppShell.Header className="app-header">
        <div className="app-header-inner">
          <Group className="min-w-0" gap="sm" wrap="nowrap">
            {isMobile ? (
              <>
                <Burger
                  aria-label="切换导航菜单"
                  opened={mobileOpened}
                  size="sm"
                  onClick={toggleMobile}
                />
                <Text truncate fw={600} size="sm">
                  {current.title}
                </Text>
              </>
            ) : (
              breadcrumb
            )}
          </Group>
          <Group gap={6} wrap="nowrap">
            {isMobile ? (
              <ActionIcon
                aria-label="搜索页面"
                color="gray"
                variant="subtle"
                onClick={openSearch}
              >
                <Search size={17} />
              </ActionIcon>
            ) : (
              <UnstyledButton className="app-quick-search" onClick={openSearch}>
                <Search size={14} />
                <span>搜索页面…</span>
                <Kbd size="xs">⌘K</Kbd>
              </UnstyledButton>
            )}
            {themeToggle}
            {userMenu}
          </Group>
        </div>
      </AppShell.Header>
      {isMobile && mobileOpened && (
        <button
          aria-label="关闭导航菜单"
          className="app-nav-overlay"
          onClick={closeMobile}
        />
      )}
      <AppShell.Navbar className="app-navbar">
        <div className="app-brand-row">
          <Link
            aria-label={`${config.name} 首页`}
            className="app-brand"
            to="/dashboard"
          >
            <span className="app-brand-mark">
              <BrandLogo size={16} />
            </span>
            {!compact && (
              <Text truncate className="app-brand-name">
                {config.name}
              </Text>
            )}
          </Link>
        </div>
        <AppShell.Section
          grow
          className="app-nav-scroll"
          component={ScrollArea}
          type="never"
        >
          {Array.from(new Set(available.map((item) => item.group))).map(
            (group) => (
              <Box key={group} className="app-nav-group">
                {!compact && <Text className="app-nav-heading">{group}</Text>}
                <Stack gap={1}>
                  {available
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const disabled =
                        item.path === "/monitor" && monitorAllowed !== true;
                      const Icon = item.icon;

                      return (
                        <Tooltip
                          key={item.path}
                          disabled={!compact}
                          label={disabled ? "暂无监控权限" : item.title}
                          position="right"
                        >
                          <NavLink
                            active={location.pathname === item.path}
                            aria-label={item.title}
                            className="app-nav-item"
                            component={Link}
                            disabled={disabled}
                            label={compact ? null : item.title}
                            leftSection={<Icon size={16} strokeWidth={1.75} />}
                            to={item.path}
                            onClick={(event) => {
                              if (disabled) event.preventDefault();
                              else closeMobile();
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                </Stack>
              </Box>
            ),
          )}
        </AppShell.Section>
        <AppShell.Section className="app-sidebar-footer">
          {!compact && (
            <VersionFooter
              containerClassName="app-version"
              poweredClassName="app-version-powered"
              version={config.version}
              versionClassName="app-version-number"
            />
          )}
          {!isMobile && sidebarToggle}
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main className="app-main">
        <div ref={mainRef} data-scroll-container className="app-content">
          <header
            key={`heading:${location.pathname}`}
            ref={headingRef}
            className="app-page-heading"
          >
            <Title order={1}>
              {current.path === "/dashboard"
                ? `${greeting()}，${session.name || "用户"}`
                : current.heading}
            </Title>
            <Text className="app-page-description">{current.description}</Text>
          </header>
          {denied ? (
            <Alert color="orange" title="暂无访问权限">
              请联系管理员授权。
              <Button
                component={Link}
                mt="md"
                size="xs"
                to="/dashboard"
                variant="light"
              >
                返回仪表盘
              </Button>
            </Alert>
          ) : (
            <PageErrorBoundary key={`route:${location.pathname}`}>
              <div className="app-route">
                <Suspense
                  fallback={<PageLoadingState message="正在加载页面…" />}
                >
                  <Outlet />
                </Suspense>
              </div>
            </PageErrorBoundary>
          )}
        </div>
      </AppShell.Main>
      <Modal opened={searchOpened} size="md" onClose={closeSearch}>
        <ModalContent>
          <ModalHeader>快速访问</ModalHeader>
          <ModalBody>
            <TextInput
              data-autofocus
              aria-label="搜索页面名称"
              leftSection={<Search size={16} />}
              placeholder="搜索页面名称或功能…"
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setSelected(0);
              }}
              onKeyDown={(event) => {
                // Enter also confirms an IME candidate; don't navigate then.
                if (event.nativeEvent.isComposing) return;
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const step = event.key === "ArrowDown" ? 1 : -1;

                  setSelected((index) =>
                    matches.length
                      ? (index + step + matches.length) % matches.length
                      : 0,
                  );
                }
                if (event.key === "Enter") openMatch(selected);
              }}
            />
            <div className="app-quick-results" role="listbox">
              {matches.map((item, index) => (
                <UnstyledButton
                  key={item.path}
                  aria-selected={index === selected}
                  className="app-quick-item"
                  data-selected={index === selected || undefined}
                  role="option"
                  onClick={() => openMatch(index)}
                  onMouseEnter={() => setSelected(index)}
                >
                  <IconTile
                    size="sm"
                    tone={index === selected ? "primary" : "default"}
                  >
                    <item.icon size={15} />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="block truncate text-xs text-default-500">
                      {item.description}
                    </span>
                  </span>
                  <span className="app-quick-enter">↵ 打开</span>
                </UnstyledButton>
              ))}
              {!matches.length && (
                <Text c="dimmed" py="lg" size="sm" ta="center">
                  没有匹配的页面
                </Text>
              )}
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AppShell>
  );
}
