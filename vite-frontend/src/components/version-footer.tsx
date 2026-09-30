import { useEffect, useState } from "react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  UPDATE_CHANNEL_CHANGED_EVENT,
  type UpdateReleaseChannel,
  getLatestVersionByChannel,
  getUpdateReleaseChannel,
  hasVersionUpdate,
} from "@/utils/version-update";

const FALLBACK_GITHUB_REPO = "https://github.com/Su-cyber-art/FLUX";

interface VersionFooterProps {
  version: string;
  containerClassName?: string;
  versionClassName?: string;
  poweredClassName?: string;
  updateBadgeClassName?: string;
}

export function VersionFooter({
  version,
  containerClassName,
  versionClassName,
  poweredClassName,
  updateBadgeClassName,
}: VersionFooterProps) {
  const [channel, setChannel] = useState<UpdateReleaseChannel>(
    getUpdateReleaseChannel(),
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestUpdateVersion, setLatestUpdateVersion] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const handleChannelChange = () => {
      setChannel(getUpdateReleaseChannel());
    };

    window.addEventListener(UPDATE_CHANNEL_CHANGED_EVENT, handleChannelChange);
    window.addEventListener("storage", handleChannelChange);

    return () => {
      window.removeEventListener(
        UPDATE_CHANNEL_CHANGED_EVENT,
        handleChannelChange,
      );
      window.removeEventListener("storage", handleChannelChange);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const checkUpdate = async () => {
      const latestVersion = await getLatestVersionByChannel(
        channel,
        siteConfig.github_repo || FALLBACK_GITHUB_REPO,
      );

      if (!active) {
        return;
      }

      if (!latestVersion) {
        setUpdateAvailable(false);
        setLatestUpdateVersion(null);

        return;
      }

      const hasUpdate = hasVersionUpdate(version, latestVersion);

      setUpdateAvailable(hasUpdate);
      setLatestUpdateVersion(hasUpdate ? latestVersion : null);
    };

    void checkUpdate();

    return () => {
      active = false;
    };
  }, [channel, version]);

  return (
    <div className={containerClassName}>
      <p className={versionClassName}>
        <span className="whitespace-nowrap">v{version}</span>
        {updateAvailable && latestUpdateVersion && (
          <span
            className={cn(
              "ml-2 inline-flex items-center whitespace-nowrap rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-primary",
              updateBadgeClassName,
            )}
            role="status"
          >
            可更新 {latestUpdateVersion}
          </span>
        )}
      </p>
      {siteConfig.hide_footer_brand !== true && (
        <p className={poweredClassName}>
          Powered by{" "}
          <a
            className="text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            href={siteConfig.github_repo}
            rel="noopener noreferrer"
            target="_blank"
          >
            FLVX
          </a>
        </p>
      )}
    </div>
  );
}
