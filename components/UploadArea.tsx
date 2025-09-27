import React, { useRef, useState } from 'react';
import { Icon } from './Icon';

interface UploadAreaProps {
  id: string;
  onImageSelect: (file: File) => void;
  previewUrl: string | null;
  title: string;
  isDual?: boolean;
  isUploading?: boolean;
  isFullScreen?: boolean;
}

export const UploadArea: React.FC<UploadAreaProps> = ({ id, onImageSelect, previewUrl, title, isDual = false, isUploading = false, isFullScreen = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onImageSelect(event.target.files[0]);
    }
  };

  const handleAreaClick = () => {
    if (!isUploading) {
      inputRef.current?.click();
    }
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Necessary to allow drop
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onImageSelect(file);
      }
    }
  };

  const baseClasses = "relative group flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200";
  const colorClasses = "bg-gray-900/50 border-gray-700 hover:bg-gray-800/50 hover:border-gray-600 text-gray-300";
  const sizeClasses = isFullScreen 
    ? "w-full h-full p-8"
    : (isDual ? "p-4 aspect-square" : "p-6 aspect-video");
  const activeDropClasses = isDragging ? "drop-target-active" : "";

  return (
    <div 
        className={`${baseClasses} ${colorClasses} ${sizeClasses} ${activeDropClasses}`} 
        onClick={handleAreaClick}
        onDrop={handleDrop}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        id={id}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      {previewUrl && !isUploading ? (
        <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover rounded-lg" />
      ) : (
        <div className="text-center">
          <Icon name="upload" className={`mx-auto mb-4 ${isFullScreen ? "w-16 h-16" : (isDual ? "w-6 h-6" : "w-8 h-8")} text-gray-500`}/>
          <p className={`font-semibold ${isFullScreen ? "text-xl" : (isDual ? "text-sm" : "")}`}>{title}</p>
          <p className={`mt-2 ${isFullScreen ? "text-base" : "text-xs"} text-gray-400`}>{isDual ? "Clique ou arraste" : "PNG, JPG, WebP (máx. 10MB)"}</p>
        </div>
      )}
      {isUploading && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm">
          <svg className="animate-spin h-8 w-8 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-purple-200 font-semibold">Processando...</p>
        </div>
      )}
    </div>
  );
};
