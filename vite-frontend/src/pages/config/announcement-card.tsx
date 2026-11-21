import type * as React from "react";

import { Button, Loader, Switch, Textarea } from "@mantine/core";
import { Save } from "lucide-react";

import { type AnnouncementData } from "@/api";
import { SettingsRow, SettingsSection } from "@/pages/config/settings-section";

interface AnnouncementCardProps {
  announcementLoading: boolean;
  announcement: AnnouncementData;
  setAnnouncement: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  announcementSaving: boolean;
  saveAnnouncement: () => Promise<void>;
}

export function AnnouncementCard({
  announcementLoading,
  announcement,
  setAnnouncement,
  announcementSaving,
  saveAnnouncement,
}: AnnouncementCardProps) {
  return (
    <SettingsSection
      description="在仪表盘顶部向所有用户展示的公告，支持 Markdown"
      id="config-announcement"
      title="公告"
    >
      {announcementLoading ? (
        <div className="settings-empty">
          <Loader aria-label="加载中" role="status" size="sm" />
          正在加载公告…
        </div>
      ) : (
        <>
          <SettingsRow
            description="启用后，公告将在仪表盘顶部显示"
            label="显示公告"
          >
            <Switch
              aria-label="显示公告"
              checked={announcement.enabled === 1}
              size="sm"
              onChange={({ currentTarget: { checked: checked } }) =>
                setAnnouncement({
                  ...announcement,
                  enabled: checked ? 1 : 0,
                })
              }
            />
          </SettingsRow>
          <SettingsRow
            wide
            description="支持 Markdown 语法，链接会在新标签页打开"
            label="公告内容"
          >
            <Textarea
              autosize
              aria-label="公告内容"
              maxRows={14}
              minRows={4}
              placeholder="例如：**加粗**、[链接](https://example.com)、- 列表"
              value={announcement.content}
              onChange={(e) =>
                setAnnouncement({
                  ...announcement,
                  content: e.target.value,
                })
              }
            />
            <div className="mt-3 flex justify-end">
              <Button
                leftSection={<Save size={14} />}
                loading={announcementSaving}
                size="sm"
                onClick={saveAnnouncement}
              >
                保存公告
              </Button>
            </div>
          </SettingsRow>
        </>
      )}
    </SettingsSection>
  );
}
