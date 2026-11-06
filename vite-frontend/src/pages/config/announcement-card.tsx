import type * as React from "react";

import { Button, Loader, Switch, Textarea } from "@mantine/core";
import { Megaphone, Save } from "lucide-react";

import { type AnnouncementData } from "@/api";
import { SectionHeader } from "@/components/section-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

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
    <Card className="config-section" id="config-announcement">
      <CardHeader className="pb-3">
        <SectionHeader
          description="在仪表盘顶部向所有用户展示的公告，支持 Markdown"
          icon={Megaphone}
          title="公告"
        />
      </CardHeader>
      <CardBody className="pt-0">
        {announcementLoading ? (
          <div className="flex justify-center py-8">
            <Loader aria-label="加载中" role="status" size="lg" />
          </div>
        ) : (
          <>
            <div className="settings-row">
              <div>
                <p className="settings-row-label">显示公告</p>
                <p className="settings-row-desc">
                  启用后，公告将在仪表盘顶部显示
                </p>
              </div>
              <Switch
                checked={announcement.enabled === 1}
                label={
                  <>
                    <span className="text-sm text-default-700">
                      {announcement.enabled === 1 ? "已启用" : "已禁用"}
                    </span>
                  </>
                }
                onChange={({ currentTarget: { checked: checked } }) =>
                  setAnnouncement({
                    ...announcement,
                    enabled: checked ? 1 : 0,
                  })
                }
              />
            </div>
            <div data-wide className="settings-row">
              <Textarea
                description="支持 Markdown 语法，链接会在新标签页打开"
                label="公告内容"
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
              <div className="flex justify-end">
                <Button
                  leftSection={<Save size={15} />}
                  loading={announcementSaving}
                  onClick={saveAnnouncement}
                >
                  保存公告
                </Button>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
