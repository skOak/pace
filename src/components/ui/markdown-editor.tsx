import React, { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface MarkdownEditorProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value: string;
  onValueChange: (val: string) => void;
}

export function MarkdownEditor({ value, onValueChange, className, ...props }: MarkdownEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [unauthOpen, setUnauthOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { status } = useAuth();

  const checkAuth = () => {
    if (status !== 'loggedIn') {
      setUnauthOpen(true);
      return false;
    }
    return true;
  };

  const executeUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await fetch("/api/oss/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name || "pasted-image.png", contentType: file.type, size: file.size })
      });
      
      if (!res.ok) {
         const err = await res.json();
         alert(err.error || "获取上传凭证失败");
         return;
      }

      const { uploadUrl, fileUrl } = await res.json();

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("云端上传失败");
      }

      const confirmRes = await fetch("/api/oss/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: file.size })
      });

      if (!confirmRes.ok) {
        throw new Error("服务器确认配额失败");
      }

      const markdownAttachment = file.type.startsWith("image/") 
        ? `\n![${file.name || "image"}](${fileUrl})\n` 
        : `\n[${file.name || "file"}](${fileUrl})\n`;
      
      onValueChange(value + markdownAttachment);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "上传期间发生错误");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!checkAuth()) {
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      await executeUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!checkAuth()) return;
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) {
      await executeUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem && !uploading) {
      e.preventDefault();
      if (!checkAuth()) return;
      const file = imageItem.getAsFile();
      if (file) {
        await executeUpload(file);
      }
    }
  };

  return (
    <>
    <div className={cn("relative group border rounded-md border-gray-200 bg-gray-50 focus-within:ring-2 focus-within:ring-blue-500 transition-all", className)}>
      <Textarea 
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onPaste={handlePaste}
        className="w-full min-h-[160px] resize-y bg-transparent border-0 focus-visible:ring-0 rounded-none shadow-none pb-12"
        {...props}
      />
      <div className="absolute bottom-2 left-2 flex items-center justify-between w-[calc(100%-16px)] pointer-events-none">
        <div className="flex gap-2 pointer-events-auto">
            <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange} 
            />
            <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-blue-600 bg-white hover:bg-blue-50 border border-gray-200 rounded-md transition-colors disabled:opacity-50 shadow-sm"
            >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
            {uploading ? "正在上传..." : "上传附件"}
            </button>
        </div>
        <div className="text-[10px] text-gray-400 font-mono pr-2">
            支持拖拽 / 剪贴板粘贴快速上传
        </div>
      </div>
    </div>
    <ConfirmDialog
      open={unauthOpen}
      onOpenChange={setUnauthOpen}
      title={
        <div className="flex items-center gap-2 text-orange-600">
          <AlertCircle className="w-5 h-5 pb-0.5" />
          需要登录
        </div>
      }
      description="当前未登录 Pace 账号，无法获得云端媒体存储配额验证。请前往「设置」页面登录通行证以使用该功能。"
      confirmText="我知道了"
      hideCancel={true}
      onConfirm={() => setUnauthOpen(false)}
    />
    </>
  );
}
