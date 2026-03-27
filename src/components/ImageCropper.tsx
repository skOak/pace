import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface ImageCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 上传或拍摄得到的图片本地 Blob URL */
  imageUrl: string;
  /** 裁剪完成后的回调，返回压缩处理后的 Base64 字符串（含 data:image/jpeg;base64,前缀） */
  onCropSave: (base64Image: string) => void;
  isProcessing?: boolean;
}

export function ImageCropper({ open, onOpenChange, imageUrl, onCropSave, isProcessing = false }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // 图片加载完成时，默认给一个中心偏内的裁剪框，比如占据 90% 面宽
    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 });
  };

  const generateCroppedImage = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    const image = imgRef.current;
    
    // 如果用户只是点开但没框选或者框选面积过小，拒绝截取
    if (completedCrop.width === 0 || completedCrop.height === 0) {
      alert('请先框选需要识别的区域');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 获取图片原始分辨率与屏幕显示尺寸的比例
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // 计算原始截取尺寸
    let targetWidth = Math.floor(completedCrop.width * scaleX);
    let targetHeight = Math.floor(completedCrop.height * scaleY);

    // 限制最大边长不超过 1500px，腾讯云 OCR 支持大图但没必要传原生 4K，浪费带宽和拖慢速度
    const MAX_DIMENSION = 1500;
    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / targetWidth, MAX_DIMENSION / targetHeight);
      targetWidth = Math.floor(targetWidth * ratio);
      targetHeight = Math.floor(targetHeight * ratio);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.imageSmoothingQuality = 'high';

    // 将选区绘制到 Canvas，此处将源图按裁剪比例复制并同时完成了可能存在的缩放（downsampling）
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      targetWidth,
      targetHeight
    );

    // 转换为 JPEG Base64 字符串，压缩质量 0.85 足够用于文字识别
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    onCropSave(base64);
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>裁剪作业内容</DialogTitle>
          <DialogDescription>
            请框寻需要识别的任务列表区域，去除多余背景能显著提升识别速度和准确率。
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-center max-h-[60vh] overflow-hidden bg-gray-50 rounded-lg outline-dashed outline-gray-200 outline-2 outline-offset-[-2px] p-2 mt-2">
          {imageUrl && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              disabled={isProcessing}
            >
               <img
                  ref={imgRef}
                  alt="待裁切图片"
                  src={imageUrl}
                  className={`max-h-[55vh] max-w-full object-contain ${isProcessing ? 'opacity-50' : ''}`}
                  onLoad={onImageLoad}
                  crossOrigin="anonymous" // 安全起见
               />
            </ReactCrop>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            取消
          </Button>
          <Button onClick={generateCroppedImage} disabled={isProcessing || !completedCrop} className="bg-blue-600 hover:bg-blue-700">
            {isProcessing ? '识别中...' : '确认框选并识别'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
