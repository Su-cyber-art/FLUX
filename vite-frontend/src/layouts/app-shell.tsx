import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ActionIcon,
  Alert,
  AppShell,
  Avatar,
  Badge,
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
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
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
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { getMonitorAccess } from "@/api";
import { safeLogout } from "@/utils/logout";

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
  const [monitorAllowed, setMonitorAllowed] = useState<boolean | null>(
    session.isAdmin ? true : null,
  );
  const mainRef = useRef<HTMLDivElement>(null);
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

  useHotkeys([["mod+K", () => openSearch()]]);
  useEffect(() => {
    closeMobile();
    closeSearch();
    setSearch("");
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

  return (
    <AppShell
      className="app-shell"
      data-mobile={isMobile || undefined}
      header={{
        height: isMobile ? "calc(64px + env(safe-area-inset-top, 0px))" : 64,
      }}
      navbar={{
        width: compact ? 76 : 244,
        breakpoint: isMobile ? 100000 : "sm",
        collapsed: { mobile: !mobileOpened },
      }}
      padding={0}
    >
      <AppShell.Header className="app-header">
        <Group
          h="100%"
          justify="space-between"
          px={isMobile ? "md" : "lg"}
          wrap="nowrap"
        >
          <Group className="min-w-0" gap="sm" wrap="nowrap">
            {isMobile ? (
              <Burger
                aria-label="切换导航菜单"
                opened={mobileOpened}
                size="sm"
                onClick={toggleMobile}
              />
            ) : (
              <ActionIcon
                aria-label={compact ? "展开侧栏" : "收起侧栏"}
                color="gray"
                variant="subtle"
                onClick={toggleSidebar}
              >
                {compact ? (
                  <PanelLeftOpen size={19} />
                ) : (
                  <PanelLeftClose size={19} />
                )}
              </ActionIcon>
            )}
            <Group className="min-w-0" gap={8} wrap="nowrap">
              <Text c="dimmed" size="sm" visibleFrom="sm">
                控制台
              </Text>
              <ChevronRight
                className="text-default-400 hidden sm:block"
                size={13}
              />
              <Text truncate fw={600} size="sm">
                {current.title}
              </Text>
            </Group>
          </Group>
          <Group gap={isMobile ? 8 : 16} wrap="nowrap">
            {isMobile ? (
              <ActionIcon
                aria-label="搜索页面"
                color="gray"
                variant="subtle"
                onClick={openSearch}
              >
                <Search size={18} />
              </ActionIcon>
            ) : (
              <UnstyledButton className="app-quick-search" onClick={openSearch}>
                <Search size={15} />
                <span>搜索页面</span>
                <Kbd size="xs">⌘ K</Kbd>
              </UnstyledButton>
            )}
            <Tooltip
              label={effectiveMode === "dark" ? "切换浅色模式" : "切换深色模式"}
            >
              <ActionIcon
                aria-label={
                  effectiveMode === "dark" ? "切换浅色模式" : "切换深色模式"
                }
                color="gray"
                variant="subtle"
                onClick={() =>
                  setMode(effectiveMode === "dark" ? "light" : "dark")
                }
              >
                {effectiveMode === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </ActionIcon>
            </Tooltip>
            <Menu
              withinPortal
              position="bottom-end"
              shadow="md"
              width={210}
              zIndex={450}
            >
              <Menu.Target>
                <UnstyledButton className="app-user-menu">
                  <Avatar
                    color="initials"
                    name={session.name || "用户"}
                    radius="xl"
                    size={32}
                  />
                  <div className="hidden md:block">
                    <Text fw={600} size="xs">
                      {session.name || "用户"}
                    </Text>
                    <Text c="dimmed" size="10px">
                      {session.isAdmin ? "管理员" : "成员"}
                    </Text>
                  </div>
                  <ChevronDown className="text-default-500" size={13} />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>账号设置</Menu.Label>
                <Menu.Item
                  component={Link}
                  leftSection={<UserRound size={15} />}
                  to="/profile"
                >
                  个人中心
                </Menu.Item>
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
          </Group>
        </Group>
      </AppShell.Header>
      {isMobile && mobileOpened && (
        <button
          aria-label="关闭导航菜单"
          className="app-nav-overlay"
          onClick={closeMobile}
        />
      )}
      <AppShell.Navbar className="app-navbar" p={compact ? 10 : 16}>
        <Link
          aria-label={`${config.name} 首页`}
          className={`app-brand ${compact ? "is-compact" : ""}`}
          to="/dashboard"
        >
          <div className="app-brand-mark">
            <BrandLogo size={23} />
          </div>
          {!compact && (
            <div className="min-w-0">
              <Text truncate fw={750} lh={1.3} size="lg">
                {config.name}
              </Text>
              <Text c="dimmed" mt={3} size="10px">
                流量转发控制台
              </Text>
            </div>
          )}
        </Link>
        <AppShell.Section
          grow
          component={ScrollArea}
          mt="lg"
          offsetScrollbars={false}
          scrollbarSize={4}
        >
          {Array.from(new Set(available.map((item) => item.group))).map(
            (group) => (
              <Box key={group} mb="lg">
                {!compact && <Text className="app-nav-heading">{group}</Text>}
                <Stack gap={4}>
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
                            className={`app-nav-item ${compact ? "is-compact" : ""}`}
                            component={Link}
                            disabled={disabled}
                            label={compact ? null : item.title}
                            leftSection={<Icon size={18} strokeWidth={1.7} />}
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
          {compact ? (
            <Tooltip label="系统设置" position="right">
              <ActionIcon
                color="gray"
                component={Link}
                size="lg"
                to={session.isAdmin ? "/config" : "/profile"}
                variant="subtle"
              >
                <MenuIcon size={17} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <>
              <Group gap={7} mb="xs">
                <ShieldCheck className="text-default-500" size={14} />
                <Text c="dimmed" size="xs">
                  {session.isAdmin ? "管理工作空间" : "个人工作空间"}
                </Text>
              </Group>
              <VersionFooter
                poweredClassName="text-xs text-default-500"
                version={config.version}
                versionClassName="text-xs text-default-500"
              />
            </>
          )}
        </AppShell.Section>
      </AppShell.Navbar>
      <AppShell.Main>
        <div ref={mainRef} data-scroll-container className="app-content">
          <header className="app-page-heading">
            <div>
              <Group gap={8} mb={7}>
                <Text c="dimmed" size="xs">
                  {current.group}
                </Text>
                {session.isAdmin && (
                  <Badge color="gray" radius="sm" size="xs" variant="light">
                    管理端
                  </Badge>
                )}
              </Group>
              <Title fw={650} order={1} size={26}>
                {current.title}
              </Title>
              <Text c="dimmed" mt={6} size="sm">
                {current.description}
              </Text>
            </div>
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
            <PageErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageLoadingState message="正在加载页面…" />}>
                <Outlet />
              </Suspense>
            </PageErrorBoundary>
          )}
        </div>
      </AppShell.Main>
      <Modal isOpen={searchOpened} size="md" onClose={closeSearch}>
        <ModalContent>
          <ModalHeader>快速访问</ModalHeader>
          <ModalBody>
            <TextInput
              data-autofocus
              aria-label="搜索页面名称"
              leftSection={<Search size={16} />}
              placeholder="搜索页面名称或功能…"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) {
                  navigate(matches[0].path);
                  closeSearch();
                }
              }}
            />
            <Stack gap={4} mt="sm">
              {matches.map((item) => (
                <NavLink
                  key={item.path}
                  component={Link}
                  description={item.group}
                  label={item.title}
                  leftSection={<item.icon size={17} />}
                  to={item.path}
                  onClick={closeSearch}
                />
              ))}
              {!matches.length && (
                <Text c="dimmed" py="lg" size="sm" ta="center">
                  没有匹配的页面
                </Text>
              )}
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </AppShell>
  );
}
