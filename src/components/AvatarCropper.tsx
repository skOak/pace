import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface AvatarCropperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onCropSave: (base64Image: string) => void;
}

export function AvatarCropper({ open, onOpenChange, imageUrl, onCropSave }: AvatarCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    // 默认提供一个居中、占短边 90% 面宽的 1:1 裁剪框
    const cropSize = Math.min(width, height) * 0.9;
    const initialCrop = centerCrop(
      makeAspectCrop(
        { unit: 'px', width: cropSize },
        1, // aspect ratio 1:1
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  };

  const generateCroppedImage = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    const image = imgRef.current;
    
    if (completedCrop.width === 0 || completedCrop.height === 0) {
      alert('请先框选头像区域');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // 头像不需要那么大分辨率，强制缩小到 400x400 即可极大减小 IndexedDB 负担
    let targetWidth = Math.floor(completedCrop.width * scaleX);
    let targetHeight = Math.floor(completedCrop.height * scaleY);

    const MAX_DIMENSION = 400;
    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      targetWidth = MAX_DIMENSION;
      targetHeight = MAX_DIMENSION;
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.imageSmoothingQuality = 'high';

    // 绘制选区
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

    // 头像使用 webp 格式以获得更好的透明通道/压缩比，质量 0.85
    const base64 = canvas.toDataURL('image/webp', 0.85);
    onCropSave(base64);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>调整您的头像</DialogTitle>
          <DialogDescription>
            请拖拽或缩放裁剪框，截取你想要保留的圆形区域。
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center justify-center max-h-[60vh] overflow-hidden bg-gray-50 rounded-lg outline-dashed outline-gray-200 outline-2 outline-offset-[-2px] p-2 mt-2">
          {imageUrl && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop={true}
            >
               <img
                  ref={imgRef}
                  alt="Avatar source"
                  src={imageUrl}
                  className="max-h-[50vh] max-w-full object-contain"
                  onLoad={onImageLoad}
                  crossOrigin="anonymous"
               />
            </ReactCrop>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={generateCroppedImage} disabled={!completedCrop} className="bg-blue-600 hover:bg-blue-700">
            确认使用并保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
