import { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  image: string;
  onConfirm: (cropped: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ image, onConfirm, onCancel }: ImageCropperProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scalingCorner, setScalingCorner] = useState<string | null>(null); // 'tl' | 'tr' | 'bl' | 'br'
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartRef = useRef({ distance: 0, centerX: 0, centerY: 0, startBoxX: 0, startBoxY: 0, startBoxW: 0, startBoxH: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, startBoxX: 0, startBoxY: 0, startBoxW: 0, startBoxH: 0 });

  // 辅助函数
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  };

  useEffect(() => {
    if (imgRef.current && containerRef.current) {
      const img = imgRef.current;
      const container = containerRef.current;
      
      // 图片加载完成后设置裁剪框（默认居中 80%）
      const setCrop = () => {
        // 等待一下让图片布局完成
        setTimeout(() => {
          if (!imgRef.current || !containerRef.current) return;
          
          const img = imgRef.current;
          const container = containerRef.current;
          const imgRect = img.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          
          // 计算图片在容器内的位置
          const imgX = imgRect.left - containerRect.left;
          const imgY = imgRect.top - containerRect.top;
          
          // 裁剪框大小（图片的 80%）
          const cropWidth = imgRect.width * 0.8;
          const cropHeight = imgRect.height * 0.8;
          
          setCropBox({
            x: imgX + (imgRect.width - cropWidth) / 2,
            y: imgY + (imgRect.height - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
          });
        }, 100);
      };
      
      if (img.complete) {
        setCrop();
      } else {
        img.onload = setCrop;
      }
    }
  }, [image]);

  // 处理角落缩放开始
  const handleCornerStart = (corner: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setScalingCorner(corner);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startBoxX: cropBox.x,
      startBoxY: cropBox.y,
      startBoxW: cropBox.width,
      startBoxH: cropBox.height
    };
  };

  // 拖拽开始（移动整个框）
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    // 如果点击的是角落，不触发移动
    if ((e.target as HTMLElement).closest('.crop-corner')) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      startBoxX: cropBox.x,
      startBoxY: cropBox.y,
      startBoxW: cropBox.width,
      startBoxH: cropBox.height
    };
  };

  // 拖拽/缩放中
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!imgRef.current || !containerRef.current) return;
    
    // 检查是否是双指触摸
    if ('touches' in e && e.touches.length === 2) {
      e.preventDefault();
      
      const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const currentDistance = getDistance(touch1, touch2);
      const currentCenter = getCenter(touch1, touch2);
      
      if (!isPinching) {
        // 开始双指缩放
        setIsPinching(true);
        setIsDragging(false);
        setScalingCorner(null);
        pinchStartRef.current = {
          distance: currentDistance,
          centerX: currentCenter.x,
          centerY: currentCenter.y,
          startBoxX: cropBox.x,
          startBoxY: cropBox.y,
          startBoxW: cropBox.width,
          startBoxH: cropBox.height
        };
        return;
      }
      
      // 双指缩放中
      const img = imgRef.current;
      const container = containerRef.current;
      const imgRect = img.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const imgX = imgRect.left - containerRect.left;
      const imgY = imgRect.top - containerRect.top;
      
      // 计算缩放比例
      const scale = currentDistance / pinchStartRef.current.distance;
      
      // 计算新的宽高
      let newW = Math.max(50, pinchStartRef.current.startBoxW * scale);
      let newH = Math.max(50, pinchStartRef.current.startBoxH * scale);
      
      // 计算新的位置（保持中心点不变）
      const centerX = pinchStartRef.current.startBoxX + pinchStartRef.current.startBoxW / 2;
      const centerY = pinchStartRef.current.startBoxY + pinchStartRef.current.startBoxH / 2;
      
      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;
      
      // 限制边界
      newX = Math.max(imgX, newX);
      newY = Math.max(imgY, newY);
      newW = Math.min(newW, imgX + imgRect.width - newX);
      newH = Math.min(newH, imgY + imgRect.height - newY);
      
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
      return;
    }
    
    // 单指操作
    if (!isDragging && !scalingCorner) return;
    
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const img = imgRef.current;
    const container = containerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const imgX = imgRect.left - containerRect.left;
    const imgY = imgRect.top - containerRect.top;
    
    // 计算移动的距离
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    if (scalingCorner) {
      // 缩放模式
      let newX = dragStartRef.current.startBoxX;
      let newY = dragStartRef.current.startBoxY;
      let newW = dragStartRef.current.startBoxW;
      let newH = dragStartRef.current.startBoxH;
      
      // 根据不同角落计算
      if (scalingCorner === 'br') {
        // 右下角：只改宽高
        newW = Math.max(50, dragStartRef.current.startBoxW + deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH + deltaY);
      } else if (scalingCorner === 'tl') {
        // 左上角：改位置和宽高
        newX = dragStartRef.current.startBoxX + deltaX;
        newY = dragStartRef.current.startBoxY + deltaY;
        newW = Math.max(50, dragStartRef.current.startBoxW - deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH - deltaY);
      } else if (scalingCorner === 'tr') {
        // 右上角
        newY = dragStartRef.current.startBoxY + deltaY;
        newW = Math.max(50, dragStartRef.current.startBoxW + deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH - deltaY);
      } else if (scalingCorner === 'bl') {
        // 左下角
        newX = dragStartRef.current.startBoxX + deltaX;
        newW = Math.max(50, dragStartRef.current.startBoxW - deltaX);
        newH = Math.max(50, dragStartRef.current.startBoxH + deltaY);
      }
      
      // 限制边界
      newX = Math.max(imgX, newX);
      newY = Math.max(imgY, newY);
      newW = Math.min(newW, imgX + imgRect.width - newX);
      newH = Math.min(newH, imgY + imgRect.height - newY);
      
      setCropBox({ x: newX, y: newY, width: newW, height: newH });
    } else if (isDragging) {
      // 移动模式
      let newX = dragStartRef.current.startBoxX + deltaX;
      let newY = dragStartRef.current.startBoxY + deltaY;
      
      // 限制边界
      newX = Math.max(imgX, Math.min(newX, imgX + imgRect.width - cropBox.width));
      newY = Math.max(imgY, Math.min(newY, imgY + imgRect.height - cropBox.height));
      
      setCropBox({ ...cropBox, x: newX, y: newY });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setScalingCorner(null);
    setIsPinching(false);
  };

  // 确认裁剪
  const handleConfirm = () => {
    if (!imgRef.current || !containerRef.current) return;

    const img = imgRef.current;
    const container = containerRef.current;
    const imgRect = img.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // 计算裁剪区域相对于图片的比例
    const imgX = imgRect.left - containerRect.left;
    const imgY = imgRect.top - containerRect.top;

    const cropXRatio = (cropBox.x - imgX) / imgRect.width;
    const cropYRatio = (cropBox.y - imgY) / imgRect.height;
    const cropWRatio = cropBox.width / imgRect.width;
    const cropHRatio = cropBox.height / imgRect.height;

    // 使用 Canvas 裁剪
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 创建临时图片来获取原始尺寸
    const tempImg = new Image();
    tempImg.src = image;
    tempImg.onload = () => {
      const cropX = tempImg.width * cropXRatio;
      const cropY = tempImg.height * cropYRatio;
      const cropW = tempImg.width * cropWRatio;
      const cropH = tempImg.height * cropHRatio;

      canvas.width = cropW;
      canvas.height = cropH;

      ctx.drawImage(tempImg, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      onConfirm(canvas.toDataURL('image/jpeg', 0.9));
    };
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* 顶部操作栏 */}
      <div className="flex justify-between items-center p-4 pt-10 z-20">
        <button
          onClick={onCancel}
          className="bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
        >
          取消
        </button>
        <button
          onClick={handleConfirm}
          className="bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-600 transition-colors"
        >
          确定裁剪
        </button>
      </div>

      {/* 裁剪区域 */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <img
          ref={imgRef}
          src={image}
          alt="裁剪图片"
          className="max-w-[90vw] max-h-[70vh] object-contain select-none"
          draggable={false}
        />

        {/* 遮罩层 */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 上 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: 0,
              right: 0,
              height: cropBox.y
            }}
          />
          {/* 下 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: cropBox.y + cropBox.height,
              right: 0,
              bottom: 0
            }}
          />
          {/* 左 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: 0,
              top: cropBox.y,
              width: cropBox.x,
              height: cropBox.height
            }}
          />
          {/* 右 */}
          <div
            className="absolute bg-black/60"
            style={{
              left: cropBox.x + cropBox.width,
              top: cropBox.y,
              right: 0,
              height: cropBox.height
            }}
          />
        </div>

        {/* 裁剪框 */}
        <div
          className="absolute border-2 border-white cursor-move"
          style={{
            left: cropBox.x,
            top: cropBox.y,
            width: cropBox.width,
            height: cropBox.height
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {/* 角落缩放手柄 */}
          <div
            className="crop-corner absolute -top-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tl', e)}
            onTouchStart={(e) => handleCornerStart('tl', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('tr', e)}
            onTouchStart={(e) => handleCornerStart('tr', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -bottom-2 -left-2 w-6 h-6 bg-white rounded-full cursor-nesw-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('bl', e)}
            onTouchStart={(e) => handleCornerStart('bl', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
          <div
            className="crop-corner absolute -bottom-2 -right-2 w-6 h-6 bg-white rounded-full cursor-nwse-resize flex items-center justify-center"
            onMouseDown={(e) => handleCornerStart('br', e)}
            onTouchStart={(e) => handleCornerStart('br', e)}
          >
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
