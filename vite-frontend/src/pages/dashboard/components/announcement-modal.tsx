import type { AnnouncementData } from "@/api";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@mantine/core";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";

interface AnnouncementModalProps {
  announcement: AnnouncementData;
  opened: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}

export const AnnouncementModal = ({
  announcement,
  opened,
  onClose,
  onDontShowAgain,
}: AnnouncementModalProps) => {
  return (
    <Modal opened={opened} size="2xl" onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">平台公告</ModalHeader>
        <ModalBody>
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {announcement.content}
            </ReactMarkdown>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" variant="light" onClick={onDontShowAgain}>
            不再提示
          </Button>
          <Button onClick={onClose}>关闭</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
