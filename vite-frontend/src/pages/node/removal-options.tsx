import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

export function NodeRemovalOptions({
  force,
  disabled,
  locked = false,
  onChange,
}: {
  force: boolean;
  disabled: boolean;
  locked?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <Checkbox
        color="danger"
        isDisabled={disabled || locked}
        isSelected={force}
        onValueChange={onChange}
      >
        仅从面板强制移除
      </Checkbox>
      <p className="text-sm text-default-500">
        {locked
          ? "此节点已请求强制移除，重试时仍只清除面板记录。"
          : "服务器已到期、被删除或永久无法连接时使用。"}
      </p>
      {force && (
        <Alert color="warning" title="不会清理远端服务器">
          将删除面板中的节点、监控记录和 SSH 凭据，原接入凭证立即失效。 远端
          agent 和转发规则不会被卸载或停止；若服务器仍在运行，请自行清理。
          有隧道、转发或共享引用的节点仍需先解除关联。
        </Alert>
      )}
    </div>
  );
}
