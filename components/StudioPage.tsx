import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mode, CreateFunction, EditFunction, EnhanceFunction, ImageFile, HistoryItem, UserSettings, User } from '../types';
import { generateImageWithGemini, editImageWithGemini, upscaleImageWithGemini, generateVariationsWithGemini, enhancePromptWithGemini, generateVideoWithGemini, enhanceImageWithGemini, generatePromptFromImage } from '../services/geminiService';
import { FunctionCard } from './FunctionCard';
import { UploadArea } from './UploadArea';
import { Icon } from './Icon';
import { EffectSlider } from './EffectSlider';
import { HistoryPanel } from './HistoryPanel';
import { ProgressBar } from './ProgressBar';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { WelcomeModal } from './WelcomeModal';

interface StudioPageProps {
    currentUser: User;
    history: HistoryItem[];
    addToHistory: (item: Omit<HistoryItem, 'id'>) => void;
    onClearHistory: () => void;
    onLogout: () => void;
    setToastError: (message: string) => void;
    setToastSuccess: (message: string) => void;
}

// --- START of Helper Components ---
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => (
    <details className="group border-b border-gray-700/50" open={defaultOpen}>
        <summary className="flex justify-between items-center py-3 cursor-pointer text-sm font-semibold text-gray-200 hover:text-white transition-colors list-none">
            {title}
            <Icon name="chevron-down" className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform"/>
        </summary>
        <div className="pb-4 space-y-4">
            {children}
        </div>
    </details>
);

// --- START of FocusView Component ---
const FocusView: React.FC<{
    isOpen: boolean;
    imageUrl: string | null;
    filterCss: string;
    lastGenerationData: { prompt: string, func: CreateFunction, ratio: string, negativePrompt?: string, referenceImages: ImageFile[] } | null;
    onClose: () => void;
    onSendToEdit: () => void;
    onSendToEnhance: () => void;
    onUpscale: (value: number | '4K') => void;
    isUpscaling: boolean;
    onGenerateVariations: (type: 'subtle' | 'creative') => void;
    onExport: (format: 'jpeg' | 'png', quality: number) => void;
    isExporting: boolean;
}> = ({ isOpen, imageUrl, filterCss, lastGenerationData, onClose, onSendToEdit, onSendToEnhance, onUpscale, isUpscaling, onGenerateVariations, onExport, isExporting }) => {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const panState = useRef({ isPanning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0 });
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
    const [upscaleValue, setUpscaleValue] = useState<number | '4K'>(2);
    const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('jpeg');
    const [exportQuality, setExportQuality] = useState(92);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (isOpen) {
            // Reset view on open
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setImageDimensions(null);
        }
    }, [isOpen, imageUrl]);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setImageDimensions({
            width: e.currentTarget.naturalWidth,
            height: e.currentTarget.naturalHeight,
        });
    };

    const getPanBounds = (containerRect: DOMRect | null, imgDimensions: { width: number; height: number } | null, currentZoom: number) => {
        if (!containerRect || !imgDimensions?.width) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        const imageAspectRatio = imgDimensions.width / imgDimensions.height;
        const containerAspectRatio = containerRect.width / containerRect.height;
        let renderedImageWidth, renderedImageHeight;
        if (imageAspectRatio > containerAspectRatio) {
            renderedImageWidth = containerRect.width;
            renderedImageHeight = containerRect.width / imageAspectRatio;
        } else {
            renderedImageHeight = containerRect.height;
            renderedImageWidth = containerRect.height * imageAspectRatio;
        }
        const overhangX = Math.max(0, (renderedImageWidth * currentZoom - containerRect.width) / 2);
        const overhangY = Math.max(0, (renderedImageHeight * currentZoom - containerRect.height) / 2);
        return { minX: -overhangX, maxX: overhangX, minY: -overhangY, maxY: overhangY };
    }

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (!imageContainerRef.current || !imageDimensions) return;
        e.preventDefault();
        const rect = imageContainerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomFactor = 1.1;
        const oldZoom = zoom;
        const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
        const clampedZoom = Math.max(0.2, Math.min(10, newZoom));
        const newPanX = mouseX - (mouseX - pan.x) * (clampedZoom / oldZoom);
        const newPanY = mouseY - (mouseY - pan.y) * (clampedZoom / oldZoom);
        const bounds = getPanBounds(rect, imageDimensions, clampedZoom);
        setZoom(clampedZoom);
        setPan({
            x: Math.max(bounds.minX, Math.min(bounds.maxX, newPanX)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, newPanY)),
        });
    }, [zoom, pan, imageDimensions]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0 || !imageDimensions) return;
        e.preventDefault();
        panState.current = { isPanning: true, startX: e.clientX, startY: e.clientY, startPanX: pan.x, startPanY: pan.y };
    }, [pan, imageDimensions]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!panState.current.isPanning || !imageContainerRef.current || !imageDimensions) return;
        e.preventDefault();
        const dx = e.clientX - panState.current.startX;
        const dy = e.clientY - panState.current.startY;
        const newPanX = panState.current.startPanX + dx;
        const newPanY = panState.current.startPanY + dy;
        const rect = imageContainerRef.current.getBoundingClientRect();
        const bounds = getPanBounds(rect, imageDimensions, zoom);
        setPan({
            x: Math.max(bounds.minX, Math.min(bounds.maxX, newPanX)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, newPanY)),
        });
    }, [zoom, imageDimensions]);

    const handleMouseUp = useCallback(() => { panState.current.isPanning = false; }, []);

    const handleResetZoom = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (!imageContainerRef.current || !imageDimensions) return;
        const targetZoom = zoom > 1.1 ? 1 : 2;
        if (targetZoom === 1) { handleResetZoom(); return; }
        const rect = imageContainerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const oldZoom = zoom;
        const clampedZoom = Math.max(0.2, Math.min(10, targetZoom));
        const newPanX = mouseX - (mouseX - pan.x) * (clampedZoom / oldZoom);
        const newPanY = mouseY - (mouseY - pan.y) * (clampedZoom / oldZoom);
        const bounds = getPanBounds(rect, imageDimensions, clampedZoom);
        setZoom(clampedZoom);
        setPan({
            x: Math.max(bounds.minX, Math.min(bounds.maxX, newPanX)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, newPanY)),
        });
    }, [zoom, pan, imageDimensions, handleResetZoom]);
    
    if (!isOpen || !imageUrl) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex p-6 md:p-8 z-50 animate-fade-in" onClick={onClose}>
            {/* Image Viewer */}
            <div className="flex-grow h-full relative flex items-center justify-center" onClick={e => e.stopPropagation()}>
                <div
                    ref={imageContainerRef}
                    className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing rounded-xl"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onDoubleClick={handleDoubleClick}
                >
                    <div className="w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: 'transform 0.1s linear' }}>
                        <img key={imageUrl} src={imageUrl} alt="Generated art in focus" className="w-full h-full object-contain" style={{ filter: filterCss }} draggable={false} onLoad={handleImageLoad} />
                    </div>
                </div>
                 {/* Bottom Center Zoom Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md p-1 rounded-lg border border-gray-700/50 flex items-center space-x-1">
                    <button onClick={() => setZoom(z => Math.min(10, z * 1.2))} title="Ampliar" className="p-1.5 rounded-md hover:bg-gray-800 transition-colors"><Icon name="zoom-in" className="w-5 h-5"/></button>
                    <button onClick={handleResetZoom} title="Resetar Zoom" className="p-1.5 rounded-md hover:bg-gray-800 text-xs font-bold w-full transition-colors w-12 text-center">{Math.round(zoom * 100)}%</button>
                    <button onClick={() => setZoom(z => Math.max(0.2, z / 1.2))} title="Reduzir" className="p-1.5 rounded-md hover:bg-gray-800 transition-colors"><Icon name="zoom-out" className="w-5 h-5"/></button>
                </div>
            </div>

            {/* Side Panel for Actions */}
            <div className="w-80 lg:w-96 flex-shrink-0 ml-4 md:ml-6" onClick={e => e.stopPropagation()}>
                <div className="bg-gray-900/70 backdrop-blur-xl border border-gray-800/50 rounded-xl h-full flex flex-col p-5 animate-fade-in-up">
                    <div className="flex justify-between items-center pb-4 border-b border-gray-700/50">
                        <h2 className="text-xl font-bold text-white">Ações da Imagem</h2>
                        <button onClick={onClose} title="Fechar (Esc)" className="p-2 rounded-full hover:bg-gray-800 transition-colors -mr-2">
                            <Icon name="close" className="w-6 h-6"/>
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto py-4 space-y-6">
                        <div className="space-y-2">
                             <button onClick={onSendToEdit} title="Enviar para Edição" className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium">
                                <Icon name="magic" className="w-6 h-6 text-purple-400"/>
                                <span>Enviar para Edição</span>
                             </button>
                              <button onClick={onSendToEnhance} title="Enviar para Melhoria" className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium">
                                <Icon name="sparkles" className="w-6 h-6 text-purple-400"/>
                                <span>Enviar para Melhoria</span>
                             </button>
                        </div>
                        
                        {lastGenerationData && (
                            <div className="space-y-4 pt-2">
                                <h3 className="text-base font-semibold text-gray-200">Gerar Variações</h3>
                                <div className="space-y-2">
                                    <button onClick={() => onGenerateVariations('subtle')} title="Pequenas alterações mantendo o estilo e composição originais." className="w-full flex items-start space-x-3 p-3 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium">
                                        <Icon name="variations" className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0"/>
                                        <div>
                                            <span className="font-bold">Variações Sutis</span>
                                            <p className="text-xs text-gray-400">Pequenas alterações mantendo o estilo e composição originais.</p>
                                        </div>
                                    </button>
                                    <button onClick={() => onGenerateVariations('creative')} title="Gera um novo prompt a partir desta imagem para criar resultados mais diversos." className="w-full flex items-start space-x-3 p-3 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 transition-colors text-left font-medium">
                                        <Icon name="sparkles" className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0"/>
                                        <div>
                                            <span className="font-bold">Variações Criativas</span>
                                            <p className="text-xs text-gray-400">Gera um novo prompt a partir desta imagem para criar resultados diversos.</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-base font-semibold text-gray-200">Ampliar Qualidade</h3>
                            <div className="grid grid-cols-3 gap-2">
                               { [2,4,'4K'].map(val => <button key={val} onClick={() => setUpscaleValue(val as any)} className={`p-2 text-sm font-semibold rounded-md transition-colors ${upscaleValue === val ? 'bg-purple-500 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{val}{typeof val === 'number' ? 'x' : ''}</button>)}
                            </div>
                            <button 
                                onClick={() => onUpscale(upscaleValue)} 
                                disabled={isUpscaling} 
                                className="w-full flex items-center justify-center space-x-2 bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors transform active:scale-95 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                                title="Aplicar Ampliação"
                            >
                               {isUpscaling ? (
                                   <>
                                       <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                       </svg>
                                       <span>Ampliando...</span>
                                   </>
                                ) : (
                                   <>
                                       <Icon name="4k" className="w-5 h-5"/>
                                       <span>Aplicar Ampliação</span>
                                   </>
                                )}
                            </button>
                        </div>
                         <div className="space-y-4 pt-2">
                            <h3 className="text-base font-semibold text-gray-200">Exportar Imagem</h3>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Exportação Padrão</label>
                                <div className="flex space-x-2">
                                    <button onClick={() => setExportFormat('jpeg')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${exportFormat === 'jpeg' ? 'bg-purple-500 text-white font-semibold' : 'bg-gray-800 hover:bg-gray-700'}`}>JPEG</button>
                                    <button onClick={() => setExportFormat('png')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${exportFormat === 'png' ? 'bg-purple-500 text-white font-semibold' : 'bg-gray-800 hover:bg-gray-700'}`}>PNG</button>
                                </div>
                            </div>
                            {exportFormat === 'jpeg' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Qualidade: {exportQuality}%</label>
                                    <input type="range" min="10" max="100" value={exportQuality} onChange={e => setExportQuality(Number(e.target.value))} />
                                </div>
                            )}
                            <button 
                                onClick={() => onExport(exportFormat, exportQuality)} 
                                disabled={isExporting || isUpscaling}
                                className="w-full flex items-center justify-center space-x-2 bg-gray-800 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors transform active:scale-95 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                title="Baixar Imagem"
                            >
                                <Icon name="download" className="w-5 h-5"/>
                                <span>Baixar como {exportFormat.toUpperCase()}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DropOverlay: React.FC = () => (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-none animate-fade-in">
        <Icon name="upload" className="w-24 h-24 text-purple-400/80 mb-4" />
        <p className="text-2xl font-bold text-white">Solte a imagem para começar</p>
        <p className="text-gray-300">Sua imagem será adicionada ao painel esquerdo</p>
    </div>
);

// --- END of Helper Components ---

const createFunctions = [
  { id: CreateFunction.Free, name: "Prompt", icon: "sparkles" },
  { id: CreateFunction.Video, name: "Vídeo", icon: "video", sublabel: "(beta)" },
  { id: CreateFunction.Seedream4k, name: "4K Style", icon: "4k" },
  { id: CreateFunction.Cinema, name: "Cinema", icon: "cinema" },
  { id: CreateFunction.Scenario, name: "Cenário", icon: "scenario" },
  { id: CreateFunction.Portrait, name: "Retrato", icon: "portrait" },
];

const editFunctions = [
  { id: EditFunction.AddRemove, name: "Adicionar/Remover", icon: "add" },
  { id: EditFunction.MagicExpand, name: "Expansão Mágica", icon: "magic-expand" },
  { id: EditFunction.Retouch, name: "Retoque", icon: "retouch" },
  { id: EditFunction.Style, name: "Estilo", icon: "style" },
  { id: EditFunction.Compose, name: "Unir", icon: "compose" },
];

const enhanceFunctions = [
  { id: EnhanceFunction.Upscale, name: "Ampliar Qualidade", icon: "4k" },
  { id: EnhanceFunction.FixDetails, name: "Corrigir Detalhes", icon: "retouch" },
  { id: EnhanceFunction.AdjustColor, name: "Ajustar Cor", icon: "style" },
  { id: EnhanceFunction.AdjustLighting, name: "Ajustar Luz", icon: "cinema" },
];

const aspectRatios = [
    { id: '1:1', name: '1:1' },
    { id: '16:9', name: '16:9' },
    { id: '9:16', name: '9:16' },
    { id: '4:3', name: '4:3' },
    { id: '3:4', name: '3:4' },
];

const fileToImageFile = (file: File): Promise<ImageFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const base64WithPrefix = event.target.result;
                const base64 = base64WithPrefix.split(',')[1];
                resolve({
                    base64,
                    mimeType: file.type,
                    name: file.name
                });
            } else {
                reject(new Error('Failed to read file.'));
            }
        };
        reader.onerror = (error) => reject(error);
        // FIX: Corrected typo from readDataURL to readAsDataURL.
        reader.readAsDataURL(file);
    });
};

const dataUrlToImageFile = async (dataUrl: string, name: string): Promise<ImageFile> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], name, { type: blob.type });
    return fileToImageFile(file);
}

const initialEffects = {
    blur: 0,
    brightness: 100,
    contrast: 100,
    sepia: 0,
};

type Effects = typeof initialEffects;
type HistoryState = { image: string | null; effects: Effects };

// FIX: Removed local UserSettings interface; it is now imported from types.ts.
interface ReferenceImageState {
  id: string;
  previewUrl: string;
  imageFile: ImageFile | null; // Null while processing
}

const applyEffectsToImage = (
    imageUrl: string,
    filterCss: string,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg',
    quality: number = 92
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imageUrl;

        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context."));
                return;
            }
            
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            
            ctx.filter = filterCss;
            ctx.drawImage(image, 0, 0);

            const qualityForDataUrl = (format === 'image/jpeg') ? quality / 100 : undefined;
            resolve(canvas.toDataURL(format, qualityForDataUrl));
        };

        image.onerror = (err) => {
            console.error("Error loading image for applying effects:", err);
            reject(new Error("Failed to load image to apply effects."));
        };
    });
};

const parseApiError = (error: unknown): string => {
    console.error("API Error caught in UI:", error);

    let potentialMessage = '';

    // Step 1: Extract a string from the unknown error type
    if (error instanceof Error) {
        potentialMessage = error.message;
    } else if (typeof error === 'string') {
        potentialMessage = error;
    } else if (typeof error === 'object' && error !== null) {
        if ('message' in error && typeof (error as any).message === 'string') {
            potentialMessage = (error as any).message;
        } else {
             try {
                // If the object itself is the error, stringify it
                potentialMessage = JSON.stringify(error);
            } catch { /* ignore if not stringifiable */ }
        }
    }

    // Step 2: Check the string for known error messages from the API
    const lowerCaseMessage = potentialMessage.toLowerCase();
    if (lowerCaseMessage.includes('resource_exhausted') || lowerCaseMessage.includes('quota exceeded')) {
        return "A cota de uso da API foi excedida. Verifique sua chave de API no Google AI Studio.";
    }
    if (lowerCaseMessage.includes('api key not valid')) {
        return "A chave de API configurada não é válida. Verifique a chave e tente novamente.";
    }
    if (lowerCaseMessage.includes('permission denied')) {
        return "Permissão negada. Verifique se a API está habilitada para a sua chave.";
    }
    if (lowerCaseMessage.includes('payload size exceeds')) {
        return "O arquivo de imagem enviado é muito grande. Tente usar uma imagem menor.";
    }
    if (lowerCaseMessage.includes('deadline exceeded')) {
        return "A solicitação demorou muito para responder. Tente novamente mais tarde.";
    }

    // Step 3: Try parsing the string as JSON for more structured error details
    try {
        const jsonError = JSON.parse(potentialMessage);
        const apiError = jsonError.error || jsonError; // Handle nested error property
        
        if (apiError.status === 'RESOURCE_EXHAUSTED' || (apiError.message && apiError.message.toLowerCase().includes('quota'))) {
            return "A cota de uso da API foi excedida. Verifique sua chave de API no Google AI Studio.";
        }
        if (apiError.message) {
            return `Erro da IA: ${apiError.message}`;
        }
    } catch (e) {
        // Not a JSON string, or parsing failed. Fall through.
    }
    
    // Step 4: Fallback to the extracted message or a generic one
    return potentialMessage || 'Ocorreu um erro desconhecido durante a operação.';
};


export const StudioPage: React.FC<StudioPageProps> = ({
    currentUser,
    history,
    addToHistory,
    onClearHistory,
    onLogout,
    setToastError,
    setToastSuccess
}) => {
    const [prompt, setPrompt] = useState<string>('');
    const [negativePrompt, setNegativePrompt] = useState<string>('');
    const [activeCreateFunc, setActiveCreateFunc] = useState<CreateFunction>(CreateFunction.Free);
    const [activeEditFunc, setActiveEditFunc] = useState<EditFunction>(EditFunction.AddRemove);
    const [activeEnhanceFunc, setActiveEnhanceFunc] = useState<EnhanceFunction>(EnhanceFunction.Upscale);
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [videoMotionLevel, setVideoMotionLevel] = useState<'subtle' | 'moderate' | 'dynamic'>('moderate');
    
    // State for create mode with multiple reference images
    const [referenceImageFiles, setReferenceImageFiles] = useState<ReferenceImageState[]>([]);
    
    // State for video reference image
    const [videoReferenceImage, setVideoReferenceImage] = useState<ImageFile | null>(null);
    const [videoReferencePreview, setVideoReferencePreview] = useState<string | null>(null);

    // State for edit mode
    const [image1, setImage1] = useState<ImageFile | null>(null);
    const [image2, setImage2] = useState<ImageFile | null>(null);
    const [image1Preview, setImage1Preview] = useState<string | null>(null);
    const [image2Preview, setImage2Preview] = useState<string | null>(null);

    // State for enhance mode
    const [enhanceImage, setEnhanceImage] = useState<ImageFile | null>(null);
    const [enhanceImagePreview, setEnhanceImagePreview] = useState<string | null>(null);
    const [enhanceUpscaleValue, setEnhanceUpscaleValue] = useState<number | '4K'>(2);
    
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
    const [beforeImage, setBeforeImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    
    const [effects, setEffects] = useState(initialEffects);
    
    const [editHistory, setEditHistory] = useState<HistoryState[]>([{ image: null, effects: initialEffects }]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    const [progress, setProgress] = useState<number | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});
    const progressIntervalRef = useRef<any>(null);

    const [variations, setVariations] = useState<string[]>([]);
    const [originalForVariations, setOriginalForVariations] = useState<string | null>(null);
    const [isGeneratingVariations, setIsGeneratingVariations] = useState<boolean>(false);
    const [lastGenerationData, setLastGenerationData] = useState<{prompt: string, func: CreateFunction, ratio: string, negativePrompt?: string, referenceImages: ImageFile[]} | null>(null);
    const [isEnhancingPrompt, setIsEnhancingPrompt] = useState<boolean>(false);
    
    // Drag-and-drop state for reference images
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);
    
    const [isFocusViewOpen, setIsFocusViewOpen] = useState(false);
    
    // Panel state for adjustments and effects
    const [isAdjustmentsPanelOpen, setIsAdjustmentsPanelOpen] = useState(false);
    
    // Welcome Modal State
    const [showWelcome, setShowWelcome] = useState(false);
    const WELCOME_KEY = 'gx-verse-ai-studio-visited';

    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const exportButtonRef = useRef<HTMLDivElement>(null);
    
    // Global Drag-and-drop state
    const [isDraggingOverApp, setIsDraggingOverApp] = useState(false);
    const dragCounter = useRef(0);

    // MASKING STATE
    const [activeMaskTool, setActiveMaskTool] = useState<'brush' | 'eraser' | 'lasso'>('brush');
    const [maskBrushSize, setMaskBrushSize] = useState(40);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const lassoPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
    const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
    const imageRef = useRef<HTMLImageElement>(null);
    const isDrawingMask = useRef(false);

    // MAGIC EXPAND (OUTPAINTING) STATE
    const [expandTargetRatio, setExpandTargetRatio] = useState<string>('16:9');
    const [expandImagePos, setExpandImagePos] = useState({ x: 0, y: 0 });
    const expandDragState = useRef({ isDragging: false, startX: 0, startY: 0, startImgX: 0, startImgY: 0 });
    const expandFrameRef = useRef<HTMLDivElement>(null);

    const location = useLocation();
    const navigate = useNavigate();

    const mode = useMemo(() => {
        const path = location.pathname.split('/')[1];
        switch (path) {
            case 'edit': return Mode.Edit;
            case 'enhance': return Mode.Enhance;
            default: return Mode.Create;
        }
    }, [location.pathname]);

    const isMaskingModeActive = useMemo(() => {
        return mode === Mode.Edit && activeEditFunc === EditFunction.AddRemove && image1Preview && !generatedImage;
    }, [mode, activeEditFunc, image1Preview, generatedImage]);
    
    const isMagicExpandModeActive = useMemo(() => {
        return mode === Mode.Edit && activeEditFunc === EditFunction.MagicExpand && image1Preview && !generatedImage;
    }, [mode, activeEditFunc, image1Preview, generatedImage]);

    // Load user settings
    useEffect(() => {
        if (!currentUser) return;
        try {
            const settingsKey = `gx-verse-ai-studio-settings-${currentUser.name}`;
            const storedSettings = localStorage.getItem(settingsKey);
            if (storedSettings) {
                const settings: UserSettings = JSON.parse(storedSettings);
                if (settings.activeCreateFunc) setActiveCreateFunc(settings.activeCreateFunc);
                if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
            }
        } catch (error) {
            console.error("Failed to load settings from localStorage", error);
        }

        // Check if it's the user's first visit
        try {
            const hasVisited = localStorage.getItem(WELCOME_KEY);
            if (!hasVisited) {
                setShowWelcome(true);
            }
        } catch (error) {
            console.error("Failed to check welcome status from localStorage", error);
        }
    }, [currentUser]);

    // This effect handles loading a history item passed via navigation state
    useEffect(() => {
        if (location.state && location.state.loadHistoryItem) {
            handleSidebarHistoryClick(location.state.loadHistoryItem);
            // Clear the state so it doesn't re-trigger on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state]);


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
                setIsExportDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleCloseWelcome = () => {
        try {
            localStorage.setItem(WELCOME_KEY, 'true');
        } catch (error) {
            console.error("Failed to write to localStorage", error);
        }
        setShowWelcome(false);
    };

    // Effect to save user settings
    useEffect(() => {
        if (!currentUser) return;
        try {
            const settingsKey = `gx-verse-ai-studio-settings-${currentUser.name}`;
            const settings: UserSettings = {
                activeCreateFunc,
                aspectRatio,
            };
            localStorage.setItem(settingsKey, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings to localStorage", error);
        }
    }, [activeCreateFunc, aspectRatio, currentUser]);

    const isComposeMode = useMemo(() => mode === Mode.Edit && activeEditFunc === EditFunction.Compose, [mode, activeEditFunc]);

    // Cleanup object URLs on unmount or when previews change to prevent memory leaks
    useEffect(() => {
        return () => {
            referenceImageFiles.forEach(ref => URL.revokeObjectURL(ref.previewUrl));
            if (videoReferencePreview) URL.revokeObjectURL(videoReferencePreview);
            if (image1Preview) URL.revokeObjectURL(image1Preview);
            if (image2Preview) URL.revokeObjectURL(image2Preview);
            if (enhanceImagePreview) URL.revokeObjectURL(enhanceImagePreview);
            if(videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
        };
    }, []); // Run only on unmount

    const startLoadingProgress = (messages: string[]) => {
        setProgress(0);
        let currentProgress = 0;
        let messageIndex = 0;
        setProgressMessage(messages[messageIndex]);

        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setProgressMessage(messages[messageIndex]);
        }, 4000);

        progressIntervalRef.current = setInterval(() => {
            currentProgress += Math.random() * 2;
            if (currentProgress >= 99) {
                clearInterval(progressIntervalRef.current);
            } else {
                setProgress(currentProgress);
            }
        }, 100);
        return () => {
            clearInterval(progressIntervalRef.current);
            clearInterval(messageInterval);
        }
    };

    const finishLoadingProgress = () => {
        if(progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        setProgress(100);
        setProgressMessage("Finalizando...");
        setTimeout(() => {
            setProgress(null);
            setIsLoading(false);
            setIsUpscaling(false);
            setIsGeneratingVariations(false);
        }, 500);
    };

    const addStateToHistory = useCallback((state: HistoryState) => {
        const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
        const lastState = newHistory[newHistory.length - 1];
        if (lastState && lastState.image === state.image && JSON.stringify(lastState.effects) === JSON.stringify(state.effects)) return;
        newHistory.push(state);
        setEditHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
    }, [editHistory, currentHistoryIndex]);
    
    const handleEffectChange = useCallback((effect: keyof Effects, value: number) => {
        setEffects(prev => ({ ...prev, [effect]: value }));
    }, []);

    const handleCommitEffects = useCallback(() => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (currentImage) {
            addStateToHistory({ image: currentImage, effects });
        }
    }, [addStateToHistory, effects, currentHistoryIndex, editHistory]);

    const handleResetEffects = () => {
        setEffects(initialEffects);
        const currentImage = editHistory[currentHistoryIndex].image;
        if (currentImage) {
            addStateToHistory({ image: currentImage, effects: initialEffects });
        }
    };

    const setNewImageResult = useCallback((newImage: string, beforeImageSource: string | null) => {
        setGeneratedImage(newImage);
        setVideoBlobUrl(null); // Clear video result
        setBeforeImage(beforeImageSource);
        setEffects(initialEffects);
        // This is a new image, so we reset its specific edit history.
        setEditHistory([{ image: newImage, effects: initialEffects }]);
        setCurrentHistoryIndex(0);
        setIsAdjustmentsPanelOpen(true);
    }, []);
    
    const handleSelectFile = async (file: File, setImage: React.Dispatch<React.SetStateAction<ImageFile | null>>, setPreview: React.Dispatch<React.SetStateAction<string | null>>, uploaderId: string) => {
        setIsUploading(prev => ({ ...prev, [uploaderId]: true }));
        try {
            const previewUrl = URL.createObjectURL(file);
            setPreview(previewUrl); // Show preview immediately

            const imageFile = await fileToImageFile(file);
            setImage(imageFile);
            setToastSuccess(`${file.name} carregado.`);
            setGeneratedImage(null);
            setBeforeImage(null);
        } catch (error) {
            console.error("File processing error:", error);
            setToastError("Falha ao processar o arquivo.");
            setPreview(null);
        } finally {
            setIsUploading(prev => ({ ...prev, [uploaderId]: false }));
        }
    };
    
    const handleAddReferenceImage = (file: File) => {
        if (referenceImageFiles.length >= 5) {
            setToastError("Você pode enviar no máximo 5 imagens de referência.");
            return;
        }
        const id = `${Date.now()}-${file.name}`;
        const previewUrl = URL.createObjectURL(file);
        // Add with null imageFile first to show loading state
        setReferenceImageFiles(prev => [...prev, { id, previewUrl, imageFile: null }]);

        fileToImageFile(file)
            .then(imageFile => {
                setReferenceImageFiles(prev => prev.map(img => 
                    img.id === id ? { ...img, imageFile } : img
                ));
                setToastSuccess(`${file.name} adicionado como referência.`);
            })
            .catch(error => {
                console.error("File processing error:", error);
                setToastError(`Falha ao processar ${file.name}.`);
                setReferenceImageFiles(prev => prev.filter(img => img.id !== id));
                URL.revokeObjectURL(previewUrl);
            });
    };

    const handleRemoveReferenceImage = (idToRemove: string) => {
        const imageToRemove = referenceImageFiles.find(img => img.id === idToRemove);
        if (imageToRemove) {
            URL.revokeObjectURL(imageToRemove.previewUrl);
        }
        setReferenceImageFiles(prev => prev.filter(img => img.id !== idToRemove));
    };

    const handleRemoveVideoReferenceImage = () => {
        if (videoReferencePreview) {
            URL.revokeObjectURL(videoReferencePreview);
        }
        setVideoReferenceImage(null);
        setVideoReferencePreview(null);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnter = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (index !== draggedItemIndex) {
            setDragOverItemIndex(index);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };
    
    const handleDragLeave = (e: React.DragEvent) => {
        setDragOverItemIndex(null);
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.stopPropagation(); // Prevent app-level drop handler
        if (draggedItemIndex === null || draggedItemIndex === dropIndex) {
            setDraggedItemIndex(null);
            setDragOverItemIndex(null);
            return;
        }
        const newReferenceImageFiles = [...referenceImageFiles];
        const draggedItem = newReferenceImageFiles.splice(draggedItemIndex, 1)[0];
        newReferenceImageFiles.splice(dropIndex, 0, draggedItem);
        setReferenceImageFiles(newReferenceImageFiles);
        
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
    };


    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setToastError('Por favor, insira um prompt.');
            return;
        }
        if (referenceImageFiles.some(ref => ref.imageFile === null)) {
            setToastError("Aguarde o processamento de todas as imagens de referência.");
            return;
        }
        const validReferenceImages = referenceImageFiles
            .map(ref => ref.imageFile)
            .filter((img): img is ImageFile => img !== null);

        setIsLoading(true);
        setBeforeImage(null);
        setGeneratedImage(null);
        setVideoBlobUrl(null);
        setVariations([]);
        setOriginalForVariations(null);
        const stopProgress = startLoadingProgress(["Invocando a criatividade...", "Pintando pixels...", "Consultando as musas da IA..."]);

        try {
            const result = await generateImageWithGemini(prompt, activeCreateFunc, aspectRatio, validReferenceImages, negativePrompt);
            setNewImageResult(result, null);
            addToHistory({ 
                imageUrl: result, 
                prompt, 
                mode: Mode.Create,
                createFunction: activeCreateFunc, 
                aspectRatio, 
                negativePrompt 
            });
            setLastGenerationData({prompt, func: activeCreateFunc, ratio: aspectRatio, negativePrompt, referenceImages: validReferenceImages });
            setToastSuccess("Imagem gerada com sucesso!");
        } catch (error) {
            setToastError(parseApiError(error));
        } finally {
            stopProgress();
            finishLoadingProgress();
        }
    };

    const handleGenerateVideo = async (motionLevel: 'subtle' | 'moderate' | 'dynamic') => {
        if (!prompt.trim()) {
            setToastError('Por favor, insira um prompt para o vídeo.');
            return;
        }
        setIsLoading(true);
        setBeforeImage(null);
        setGeneratedImage(null);
        setVideoBlobUrl(null);
        setVariations([]);
        setOriginalForVariations(null);
        setProgress(0);

        const messages = [
            "Preparando a sua cena...",
            "Coreografando os pixels...",
            "Renderizando frame por frame...",
            "Aplicando iluminação cinematográfica...",
            "Sincronizando o movimento...",
            "Construindo seu universo digital...",
            "A magia da IA está acontecendo...",
            "Ajustando o foco da câmera virtual...",
            "Polindo os efeitos visuais...",
            "Finalizando a sua obra-prima..."
        ];
        let messageIndex = 0;
        setProgressMessage(messages[messageIndex]);

        const messageInterval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setProgressMessage(messages[messageIndex]);
        }, 4000);

        try {
            const onProgressUpdate = (progress: number, message: string) => {
                setProgress(progress);
                if(message) setProgressMessage(message);
            };

            // The service now handles the download and returns a blob URL directly.
            const blobUrl = await generateVideoWithGemini(prompt, onProgressUpdate, videoReferenceImage ?? undefined, motionLevel);
            
            clearInterval(messageInterval);

            setVideoBlobUrl(blobUrl);
            setToastSuccess("Vídeo gerado e pronto para visualização!");

            setProgress(100);
            setProgressMessage("Concluído!");
            setTimeout(() => {
                setProgress(null);
                setIsLoading(false);
            }, 1000);

        } catch (error) {
            clearInterval(messageInterval);
            setToastError(parseApiError(error));
            setProgress(null);
            setIsLoading(false);
        }
    };

    const handleApplyEdit = async () => {
        if (!image1) {
            setToastError('Por favor, carregue uma imagem para editar.');
            return;
        }
        
        setIsLoading(true);
        setVariations([]);
        setOriginalForVariations(null);

        if (isComposeMode && !image2) {
            setToastError('Por favor, carregue a segunda imagem para unir.');
            setIsLoading(false);
            return;
        }
        
        if (activeEditFunc !== EditFunction.MagicExpand && !prompt.trim()) {
             setToastError('Por favor, descreva a edição desejada.');
             setIsLoading(false);
             return;
        }

        const stopProgress = startLoadingProgress(["Aplicando magia digital...", "Ajustando a realidade...", "Processando sua obra-prima..."]);
        
        try {
            let maskImageFile: ImageFile | undefined = undefined;
            let imageToSend: ImageFile = image1;

            if (isMaskingModeActive && maskCanvasRef.current) {
                const maskCanvas = maskCanvasRef.current;
                const exportCanvas = document.createElement('canvas');
                const originalImage = new Image();
                originalImage.src = image1Preview!;
                await new Promise(resolve => { originalImage.onload = resolve; });

                exportCanvas.width = originalImage.naturalWidth;
                exportCanvas.height = originalImage.naturalHeight;
                
                const ctx = exportCanvas.getContext('2d');
                if (ctx) {
                    // Fill with black, then draw the mask
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                    ctx.drawImage(maskCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
                    
                    const maskDataUrl = exportCanvas.toDataURL('image/png');
                     // Check if not completely black (i.e., user has drawn something)
                    if (maskDataUrl !== exportCanvas.toDataURL('image/png', 0.1)) {
                        maskImageFile = await dataUrlToImageFile(maskDataUrl, 'mask.png');
                    }
                }
            } else if (isMagicExpandModeActive) {
                const [w, h] = expandTargetRatio.split(':').map(Number);
                const targetAspectRatio = w / h;

                const originalImage = new Image();
                originalImage.src = image1Preview!;
                await new Promise(resolve => { originalImage.onload = resolve; });
                const originalWidth = originalImage.naturalWidth;
                const originalHeight = originalImage.naturalHeight;
                
                let newWidth, newHeight;
                if (targetAspectRatio > (originalWidth / originalHeight)) {
                    newHeight = originalHeight;
                    newWidth = originalHeight * targetAspectRatio;
                } else {
                    newWidth = originalWidth;
                    newHeight = originalWidth / targetAspectRatio;
                }

                const imageCanvas = document.createElement('canvas');
                imageCanvas.width = newWidth;
                imageCanvas.height = newHeight;
                const imgCtx = imageCanvas.getContext('2d')!;
                // Center the image
                const imgX = (newWidth - originalWidth) / 2;
                const imgY = (newHeight - originalHeight) / 2;
                imgCtx.drawImage(originalImage, imgX, imgY);

                const maskCanvas = document.createElement('canvas');
                maskCanvas.width = newWidth;
                maskCanvas.height = newHeight;
                const maskCtx = maskCanvas.getContext('2d')!;
                maskCtx.fillStyle = 'white';
                maskCtx.fillRect(0, 0, newWidth, newHeight);
                maskCtx.fillStyle = 'black';
                maskCtx.fillRect(imgX, imgY, originalWidth, originalHeight);

                imageToSend = await dataUrlToImageFile(imageCanvas.toDataURL('image/png'), 'expand-image.png');
                maskImageFile = await dataUrlToImageFile(maskCanvas.toDataURL('image/png'), 'expand-mask.png');
            }

            const result = await editImageWithGemini(prompt, activeEditFunc, imageToSend, image2 ?? undefined, maskImageFile);
            setNewImageResult(result, image1Preview);
            addToHistory({
                imageUrl: result,
                beforeImageUrl: image1Preview || undefined,
                prompt,
                mode: Mode.Edit
            });
            setToastSuccess("Edição aplicada com sucesso!");
        } catch (error) {
            setToastError(parseApiError(error));
        } finally {
            stopProgress();
            finishLoadingProgress();
        }
    };
    
    const handleApplyEnhancement = async () => {
        if (!enhanceImage) {
            setToastError('Por favor, carregue uma imagem para melhorar.');
            return;
        }

        setIsLoading(true);
        setVariations([]);
        setOriginalForVariations(null);
        const stopProgress = startLoadingProgress(["Aplicando melhorias...", "Refinando a imagem...", "Polindo os detalhes..."]);

        try {
            const result = await enhanceImageWithGemini(prompt, activeEnhanceFunc, enhanceImage, enhanceUpscaleValue);
            setNewImageResult(result, enhanceImagePreview);
            addToHistory({
                imageUrl: result,
                beforeImageUrl: enhanceImagePreview || undefined,
                prompt: `${enhanceFunctions.find(f => f.id === activeEnhanceFunc)?.name || 'Melhoria'}${prompt ? `: ${prompt}` : ''}`,
                mode: Mode.Enhance,
                enhanceFunction: activeEnhanceFunc,
            });
            setToastSuccess("Melhoria aplicada com sucesso!");
        } catch (error) {
            setToastError(parseApiError(error));
        } finally {
            stopProgress();
            finishLoadingProgress();
        }
    };
    
    const handleEnhancePrompt = async () => {
        if (!prompt.trim()) {
            setToastError('Digite um prompt para melhorar.');
            return;
        }
        
        const firstRef = referenceImageFiles[0];
        if (mode === Mode.Create && firstRef && !firstRef.imageFile) {
            setToastError("Aguarde o processamento da imagem de referência.");
            return;
        }
        const referenceImageForEnhance = mode === Mode.Create ? (firstRef?.imageFile || undefined) : image1;
        setIsEnhancingPrompt(true);
        try {
            const enhanced = await enhancePromptWithGemini(prompt, referenceImageForEnhance);
            setPrompt(enhanced);
            setToastSuccess("Prompt melhorado com IA!");
        } catch (error) {
            setToastError(parseApiError(error));
        } finally {
            setIsEnhancingPrompt(false);
        }
    };

    const handleUpscale = async (upscaleValue: number | '4K') => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (!currentImage) {
            setToastError('Nenhuma imagem para ampliar.');
            return;
        }
        setIsUpscaling(true);
        setVariations([]);
        setOriginalForVariations(null);
        const stopProgress = startLoadingProgress(["Aumentando a resolução...", "Adicionando detalhes...", "Deixando tudo mais nítido..."]);
        try {
            const imageFile = await dataUrlToImageFile(currentImage, 'upscale.png');
            const result = await upscaleImageWithGemini(imageFile, upscaleValue);
            setNewImageResult(result, currentImage);
            addToHistory({
                imageUrl: result,
                beforeImageUrl: currentImage,
                prompt: `Ampliação ${upscaleValue}${typeof upscaleValue === 'number' ? 'x' : ''}`,
                mode: Mode.Enhance
            });
            setToastSuccess(`Imagem ampliada para ${upscaleValue}${typeof upscaleValue === 'number' ? 'x' : ''}!`);
        } catch (error) {
            setToastError(parseApiError(error));
        } finally {
            stopProgress();
            finishLoadingProgress();
        }
    };
    
    const handleGenerateVariations = async (type: 'subtle' | 'creative') => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (!lastGenerationData || !currentImage) {
            setToastError('Gere uma imagem primeiro para criar variações.');
            return;
        }
        setIsFocusViewOpen(false);
        setIsGeneratingVariations(true);
        
        try {
            const imageFile = await dataUrlToImageFile(currentImage, 'variation-base.png');
            let results: string[] = [];

            if (type === 'creative') {
                const stopProgress = startLoadingProgress(["Analisando referências...", "Buscando inspiração...", "Gerando variações criativas..."]);
                try {
                    // The current image becomes the primary reference, combined with originals
                    const allReferenceImages = [imageFile, ...(lastGenerationData.referenceImages || [])];
                    
                    const generationPromises = Array(4).fill(null).map(() => 
                        generateImageWithGemini(
                            lastGenerationData.prompt, // Use the original prompt
                            lastGenerationData.func, 
                            lastGenerationData.ratio, 
                            allReferenceImages, // Pass current image + original references
                            lastGenerationData.negativePrompt
                        ).catch(err => {
                            console.warn("A single creative variation failed:", err);
                            return null;
                        })
                    );

                    const settledResults = await Promise.all(generationPromises);
                    results = settledResults.filter((r): r is string => r !== null);
                } finally {
                    stopProgress();
                    finishLoadingProgress();
                }

            } else { // 'subtle'
                const stopProgress = startLoadingProgress(["Explorando novas ideias...", "Remixando a realidade...", "Criando universos paralelos..."]);
                try {
                    results = await generateVariationsWithGemini(lastGenerationData.prompt, imageFile, lastGenerationData.negativePrompt);
                } finally {
                    stopProgress();
                    finishLoadingProgress();
                }
            }
            
            if (results.length > 0) {
                setOriginalForVariations(currentImage);
                setVariations(results);
                setToastSuccess(`${results.length} variações geradas com sucesso!`);
            } else {
                throw new Error("A geração de variações falhou, nenhuma imagem foi retornada.");
            }

        } catch (error) {
            setToastError(parseApiError(error));
            setIsGeneratingVariations(false); 
            setProgress(null);
        } 
    };

    const handleSelectVariation = (imgSrc: string) => {
        setNewImageResult(imgSrc, originalForVariations);
        addToHistory({
            imageUrl: imgSrc,
            beforeImageUrl: originalForVariations || undefined,
            prompt: lastGenerationData?.prompt || 'Variação',
            mode: Mode.Create,
            createFunction: lastGenerationData?.func,
            aspectRatio: lastGenerationData?.ratio,
            negativePrompt: lastGenerationData?.negativePrompt
        });
    };

    const handleViewVariationDetails = (imgSrc: string) => {
        handleSelectVariation(imgSrc);
        setIsFocusViewOpen(true);
    };

    const handleUndo = () => {
        if (currentHistoryIndex > 0) {
            const newIndex = currentHistoryIndex - 1;
            setCurrentHistoryIndex(newIndex);
            const prevState = editHistory[newIndex];
            setGeneratedImage(prevState.image);
            setEffects(prevState.effects);
        }
    };
    const handleRedo = () => {
        if (currentHistoryIndex < editHistory.length - 1) {
            const newIndex = currentHistoryIndex + 1;
            setCurrentHistoryIndex(newIndex);
            const nextState = editHistory[newIndex];
            setGeneratedImage(nextState.image);
            setEffects(nextState.effects);
        }
    };

    const filterCss = useMemo(() => {
        return `blur(${effects.blur}px) brightness(${effects.brightness}%) contrast(${effects.contrast}%) sepia(${effects.sepia}%)`;
    }, [effects]);

    const handleSidebarHistoryClick = useCallback((item: HistoryItem) => {
        setNewImageResult(item.imageUrl, item.beforeImageUrl || null);
        setPrompt(item.prompt);
        switch(item.mode) {
            case Mode.Edit:
                navigate('/edit');
                break;
            case Mode.Enhance:
                navigate('/enhance');
                break;
            case Mode.Create:
            default:
                navigate('/');
        }
        setVariations([]);
        setOriginalForVariations(null);
    
        if (item.mode === Mode.Create) {
            setActiveCreateFunc(item.createFunction || CreateFunction.Free);
            setAspectRatio(item.aspectRatio || '1:1');
            setNegativePrompt(item.negativePrompt || '');
        }
        if (item.mode === Mode.Enhance) {
            setActiveEnhanceFunc(item.enhanceFunction || EnhanceFunction.Upscale);
        }
        setToastSuccess("Estado do histórico carregado.");
    }, [setNewImageResult, navigate, setToastSuccess]);

    const handleSendToEdit = async () => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (!currentImage) {
            setToastError("Nenhuma imagem para enviar para edição.");
            return;
        }
        setIsFocusViewOpen(false);
        navigate('/edit');
        setPrompt('');
        setNegativePrompt('');

        setIsUploading(prev => ({ ...prev, edit1: true }));
        try {
            const imageFile = await dataUrlToImageFile(currentImage, 'edit-image.png');
            setImage1(imageFile);
            setImage1Preview(currentImage); // Use the direct data URL for preview
            setGeneratedImage(null); // Clear main view
            setBeforeImage(null);
            setVariations([]);
            setOriginalForVariations(null);
            setToastSuccess("Imagem enviada para o modo de Edição.");
        } catch (error) {
            setToastError("Falha ao preparar imagem para edição.");
        } finally {
            setIsUploading(prev => ({ ...prev, edit1: false }));
        }
    };

    const handleSendToEnhance = async () => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (!currentImage) {
            setToastError("Nenhuma imagem para enviar para melhoria.");
            return;
        }
        setIsFocusViewOpen(false);
        navigate('/enhance');
        setPrompt('');
        setNegativePrompt('');

        setIsUploading(prev => ({ ...prev, enhance: true }));
        try {
            const imageFile = await dataUrlToImageFile(currentImage, 'enhance-image.png');
            setEnhanceImage(imageFile);
            setEnhanceImagePreview(currentImage);
            setGeneratedImage(null); // Clear main view
            setBeforeImage(null);
            setVariations([]);
            setOriginalForVariations(null);
            setToastSuccess("Imagem enviada para o modo de Melhoria.");
        } catch (error) {
            setToastError("Falha ao preparar imagem para melhoria.");
        } finally {
            setIsUploading(prev => ({ ...prev, enhance: false }));
        }
    };

    const handleExport = async (format: 'jpeg' | 'png', quality: number) => {
        const currentImage = editHistory[currentHistoryIndex].image;
        if (!currentImage) {
            setToastError("Não há imagem para exportar.");
            return;
        }
        try {
            const formatMime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const imageUrlWithEffects = await applyEffectsToImage(currentImage, filterCss, formatMime, quality);
            
            const link = document.createElement('a');
            link.href = imageUrlWithEffects;
            link.download = `arte-ia-${Date.now()}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setToastSuccess("Download da imagem iniciado!");
        } catch (error) {
            console.error("Export error:", error);
            setToastError("Falha ao exportar a imagem.");
        }
    };
    
    const clearReferenceImages = () => {
        referenceImageFiles.forEach(ref => URL.revokeObjectURL(ref.previewUrl));
        setReferenceImageFiles([]);
    };

    const handleAppDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOverApp(true);
        }
    };

    const handleAppDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setIsDraggingOverApp(false);
        }
    };

    const handleAppDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleAppDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverApp(false);
        dragCounter.current = 0;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (!file.type.startsWith('image/')) {
                setToastError("Por favor, solte um arquivo de imagem válido.");
                return;
            }

            switch (mode) {
                case Mode.Create:
                    if (activeCreateFunc === CreateFunction.Video) {
                        handleSelectFile(file, setVideoReferenceImage, setVideoReferencePreview, 'videoRef');
                    } else {
                        handleAddReferenceImage(file);
                    }
                    break;
                case Mode.Edit:
                    if (!image1) {
                         handleSelectFile(file, setImage1, setImage1Preview, 'edit1');
                    } else if (isComposeMode && !image2) {
                        handleSelectFile(file, setImage2, setImage2Preview, 'edit2');
                    } else {
                        handleSelectFile(file, setImage1, setImage1Preview, 'edit1');
                    }
                    break;
                case Mode.Enhance:
                    handleSelectFile(file, setEnhanceImage, setEnhanceImagePreview, 'enhance');
                    break;
            }
        }
    };
    
    // MASKING LOGIC
    const clearMaskCanvas = () => {
        const canvas = maskCanvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const handleMaskMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        isDrawingMask.current = true;
        const canvas = maskCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeMaskTool === 'lasso') {
            setLassoPoints([{ x, y }]);
        } else {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const handleMaskMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingMask.current) return;
        const canvas = maskCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (activeMaskTool === 'lasso') {
            const newPoints = [...lassoPoints, { x, y }];
            setLassoPoints(newPoints);

            const previewCanvas = lassoPreviewCanvasRef.current;
            const previewCtx = previewCanvas?.getContext('2d');
            if (previewCtx && previewCanvas) {
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.beginPath();
                previewCtx.moveTo(newPoints[0].x, newPoints[0].y);
                for (let i = 1; i < newPoints.length; i++) {
                    previewCtx.lineTo(newPoints[i].x, newPoints[i].y);
                }
                previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                previewCtx.lineWidth = 2;
                previewCtx.setLineDash([4, 4]); // Dashed line for selection
                previewCtx.stroke();
            }
        } else {
            ctx.globalCompositeOperation = activeMaskTool === 'brush' ? 'source-over' : 'destination-out';
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)'; // Brush color
            ctx.fillStyle = 'rgba(192, 132, 252, 0.7)';
            ctx.lineWidth = maskBrushSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.lineTo(x, y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const handleMaskMouseUp = () => {
        isDrawingMask.current = false;
        const maskCtx = maskCanvasRef.current?.getContext('2d');

        if (activeMaskTool === 'lasso' && maskCtx && lassoPoints.length > 1) {
            maskCtx.beginPath();
            maskCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
            for (let i = 1; i < lassoPoints.length; i++) {
                maskCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
            }
            maskCtx.closePath();
            
            maskCtx.globalCompositeOperation = 'source-over';
            maskCtx.fillStyle = 'rgba(192, 132, 252, 0.7)';
            maskCtx.fill();

            const previewCanvas = lassoPreviewCanvasRef.current;
            const previewCtx = previewCanvas?.getContext('2d');
            if (previewCtx && previewCanvas) {
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            }
            setLassoPoints([]);
        } else if (maskCtx) {
            maskCtx.closePath();
        }
    };


    // Resize canvas to match image
    useEffect(() => {
        const resizeCanvas = () => {
            if (isMaskingModeActive && imageRef.current && maskCanvasRef.current && lassoPreviewCanvasRef.current) {
                const { width, height } = imageRef.current.getBoundingClientRect();
                maskCanvasRef.current.width = width;
                maskCanvasRef.current.height = height;
                lassoPreviewCanvasRef.current.width = width;
                lassoPreviewCanvasRef.current.height = height;
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [isMaskingModeActive, image1Preview]);
    
    // MAGIC EXPAND LOGIC
    const handleExpandMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        expandDragState.current = { isDragging: true, startX: e.clientX, startY: e.clientY, startImgX: expandImagePos.x, startImgY: expandImagePos.y };
        
        const handleMove = (ev: MouseEvent) => {
            if (!expandDragState.current.isDragging || !expandFrameRef.current || !imageRef.current) return;

            const frameRect = expandFrameRef.current.getBoundingClientRect();
            const imageRect = imageRef.current.getBoundingClientRect();
            
            const dx = ev.clientX - expandDragState.current.startX;
            const dy = ev.clientY - expandDragState.current.startY;
            
            let newX = expandDragState.current.startImgX + dx;
            let newY = expandDragState.current.startImgY + dy;

            // Clamp positions
            const minX = 0;
            const minY = 0;
            const maxX = frameRect.width - imageRect.width;
            const maxY = frameRect.height - imageRect.height;
            
            newX = Math.max(minX, Math.min(newX, maxX));
            newY = Math.max(minY, Math.min(newY, maxY));
            
            setExpandImagePos({ x: newX, y: newY });
        };
        
        const handleUp = () => {
            expandDragState.current.isDragging = false;
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
        
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
    }, [expandImagePos]);


    const renderCreateFunctions = () => (
        <CollapsibleSection title="Estilo de Criação" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-2">
                {createFunctions.map((func) => (
                    <FunctionCard key={func.id} icon={func.icon} name={func.name} sublabel={(func as any).sublabel} isActive={activeCreateFunc === func.id} onClick={() => setActiveCreateFunc(func.id)} />
                ))}
            </div>
            {activeCreateFunc !== CreateFunction.Video && (
                <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Proporção</label>
                    <div className="flex space-x-2">
                         {aspectRatios.map(ratio => (
                            <button key={ratio.id} onClick={() => setAspectRatio(ratio.id)} className={`flex-1 p-2 rounded-md text-sm transition-colors ${aspectRatio === ratio.id ? 'bg-purple-500 text-white font-semibold animate-subtle-pulse' : 'bg-gray-800 hover:bg-gray-700'}`}>{ratio.name}</button>
                        ))}
                    </div>
                </div>
            )}
            {activeCreateFunc === CreateFunction.Video && (
                 <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Nível de Movimento</label>
                    <div className="flex space-x-2">
                        <button onClick={() => setVideoMotionLevel('subtle')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${videoMotionLevel === 'subtle' ? 'bg-purple-500 text-white font-semibold' : 'bg-gray-800 hover:bg-gray-700'}`}>Sutil</button>
                        <button onClick={() => setVideoMotionLevel('moderate')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${videoMotionLevel === 'moderate' ? 'bg-purple-500 text-white font-semibold' : 'bg-gray-800 hover:bg-gray-700'}`}>Moderado</button>
                        <button onClick={() => setVideoMotionLevel('dynamic')} className={`flex-1 p-2 rounded-md text-sm transition-colors ${videoMotionLevel === 'dynamic' ? 'bg-purple-500 text-white font-semibold' : 'bg-gray-800 hover:bg-gray-700'}`}>Dinâmico</button>
                    </div>
                </div>
            )}
        </CollapsibleSection>
    );

    const renderEditFunctions = () => (
         <CollapsibleSection title="Função de Edição" defaultOpen={true}>
            <div className="grid grid-cols-3 gap-2">
                {editFunctions.map((func) => (
                    <FunctionCard key={func.id} icon={func.icon} name={func.name} isActive={activeEditFunc === func.id} onClick={() => setActiveEditFunc(func.id)} />
                ))}
            </div>
            {isMagicExpandModeActive && (
                 <div className="pt-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Expandir Para Proporção</label>
                    <div className="flex space-x-2">
                         {aspectRatios.map(ratio => (
                            <button key={ratio.id} onClick={() => setExpandTargetRatio(ratio.id)} className={`flex-1 p-2 rounded-md text-sm transition-colors ${expandTargetRatio === ratio.id ? 'bg-purple-500 text-white font-semibold animate-subtle-pulse' : 'bg-gray-800 hover:bg-gray-700'}`}>{ratio.name}</button>
                        ))}
                    </div>
                </div>
            )}
        </CollapsibleSection>
    );
    
    const renderEnhanceFunctions = () => (
         <CollapsibleSection title="Função de Melhoria" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-2">
                {enhanceFunctions.map((func) => (
                    <FunctionCard key={func.id} icon={func.icon} name={func.name} isActive={activeEnhanceFunc === func.id} onClick={() => setActiveEnhanceFunc(func.id)} />
                ))}
            </div>
            {activeEnhanceFunc === EnhanceFunction.Upscale && (
                <div className="pt-4 space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Nível de Ampliação</label>
                    <div className="grid grid-cols-3 gap-2">
                       { [2,4,'4K'].map(val => <button key={val} onClick={() => setEnhanceUpscaleValue(val as any)} className={`p-2 text-sm font-semibold rounded-md transition-colors ${enhanceUpscaleValue === val ? 'bg-purple-500 text-white' : 'bg-gray-800 hover:bg-gray-700'}`}>{val}{typeof val === 'number' ? 'x' : ''}</button>)}
                    </div>
                </div>
            )}
        </CollapsibleSection>
    );

    const renderReferenceImages = () => {
        return (
            <div className="space-y-3 p-3 bg-gray-900/50 rounded-lg">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-300">
                        Imagens de Referência <span className="text-xs text-gray-500">(Opcional)</span>
                    </label>
                    {referenceImageFiles.length > 0 && (
                        <button onClick={clearReferenceImages} className="text-xs text-gray-400 hover:text-red-400 transition-colors">Limpar</button>
                    )}
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {referenceImageFiles.map((file, index) => (
                        <div
                            key={file.id}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`aspect-square transition-all duration-300 rounded-lg ${dragOverItemIndex === index ? 'drop-target-active' : ''}`}
                        >
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`relative w-full h-full group cursor-grab transition-all duration-300 rounded-lg overflow-hidden ${draggedItemIndex === index ? 'dragging-item' : 'hover:scale-105'}`}
                            >
                                <img src={file.previewUrl} className="w-full h-full object-cover" alt={`Reference ${index + 1}`} />
                                {file.imageFile === null && (
                                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-lg">
                                        <svg className="animate-spin h-5 w-5 text-purple-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                    <button onClick={() => handleRemoveReferenceImage(file.id)} className="p-2 rounded-full bg-black/50 hover:bg-red-500/80 transition-colors">
                                        <Icon name="close" className="w-4 h-4 text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {referenceImageFiles.length < 5 && (
                        <label htmlFor="ref-upload-input" className="aspect-square w-full h-full flex flex-col items-center justify-center bg-gray-900/50 border-2 border-dashed border-gray-700 hover:border-purple-500/50 rounded-lg cursor-pointer transition-all duration-300 hover:bg-gray-800/50 group">
                            <Icon name="add" className="w-6 h-6 text-gray-500 transition-colors group-hover:text-purple-400" />
                            <input id="ref-upload-input" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={(e) => e.target.files && handleAddReferenceImage(e.target.files[0])} />
                        </label>
                    )}
                </div>
            </div>
        );
    };
    
    const renderAdjustmentsPanel = () => (
        <CollapsibleSection title="Ajustes e Efeitos" defaultOpen={isAdjustmentsPanelOpen}>
             <div className="p-3 bg-gray-900/50 rounded-lg space-y-4">
                <EffectSlider label="Brilho" value={effects.brightness} min={0} max={200} unit="%" onChange={(v) => handleEffectChange('brightness', v)} onCommit={handleCommitEffects} />
                <EffectSlider label="Contraste" value={effects.contrast} min={0} max={200} unit="%" onChange={(v) => handleEffectChange('contrast', v)} onCommit={handleCommitEffects} />
                <EffectSlider label="Sépia" value={effects.sepia} min={0} max={100} unit="%" onChange={(v) => handleEffectChange('sepia', v)} onCommit={handleCommitEffects} />
                <EffectSlider label="Desfoque" value={effects.blur} min={0} max={20} unit="px" onChange={(v) => handleEffectChange('blur', v)} onCommit={handleCommitEffects} />
                 <div className="pt-2">
                    <button onClick={handleResetEffects} className="w-full flex items-center justify-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors py-2 rounded-lg bg-gray-800/70 hover:bg-gray-700/70">
                        <Icon name="reset" className="w-4 h-4" />
                        <span>Resetar Efeitos</span>
                    </button>
                </div>
            </div>
        </CollapsibleSection>
    );

    return (
        <div 
            className="min-h-screen text-white flex flex-col md:flex-row relative"
            onDragEnter={handleAppDragEnter}
            onDragLeave={handleAppDragLeave}
            onDragOver={handleAppDragOver}
            onDrop={handleAppDrop}
        >
            {isDraggingOverApp && <DropOverlay />}
            {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
            
            <FocusView
                isOpen={isFocusViewOpen}
                onClose={() => setIsFocusViewOpen(false)}
                imageUrl={editHistory[currentHistoryIndex]?.image || null}
                filterCss={filterCss}
                onSendToEdit={handleSendToEdit}
                onSendToEnhance={handleSendToEnhance}
                onUpscale={handleUpscale}
                isUpscaling={isUpscaling}
                onGenerateVariations={handleGenerateVariations}
                lastGenerationData={lastGenerationData}
                onExport={handleExport}
                isExporting={isExporting}
            />

            {/* Left Panel */}
            <aside className="w-full md:w-96 bg-gray-900/60 backdrop-blur-xl border-r border-gray-800/50 p-4 space-y-4 flex-shrink-0 flex flex-col" style={{height: '100vh'}}>
                <header className="flex justify-between items-center pb-4 pt-2 border-b border-gray-700/50">
                    <div>
                        <h1 className="font-extrabold text-3xl tracking-tight bg-gradient-to-br from-fuchsia-400 to-purple-500 bg-clip-text text-transparent">GX VERSE</h1>
                        <p className="text-sm font-semibold text-gray-400 tracking-widest">AI STUDIO</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-300 hidden sm:inline">Olá, {currentUser.name}</span>
                         <button onClick={() => navigate('/profile')} title="Ver Perfil" className="p-2.5 rounded-full bg-gray-800/80 hover:bg-gray-700/80 transition-colors">
                            <Icon name="user" className="w-5 h-5" />
                        </button>
                        <button onClick={onLogout} title="Sair" className="p-2.5 rounded-full bg-gray-800/80 hover:bg-gray-700/80 transition-colors">
                            <Icon name="logout" className="w-5 h-5" />
                        </button>
                    </div>
                </header>
                
                <div className="flex-grow overflow-y-auto pr-2 -mr-4 space-y-4">

                    <div className="flex bg-gray-800/70 p-1 rounded-lg">
                        <button onClick={() => navigate('/')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === Mode.Create ? 'bg-purple-500 text-white shadow' : 'hover:bg-gray-700/50'}`}>Criar</button>
                        <button onClick={() => navigate('/edit')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === Mode.Edit ? 'bg-purple-500 text-white shadow' : 'hover:bg-gray-700/50'}`}>Editar</button>
                        <button onClick={() => navigate('/enhance')} className={`flex-1 p-2 text-sm font-semibold rounded-md transition-colors ${mode === Mode.Enhance ? 'bg-purple-500 text-white shadow' : 'hover:bg-gray-700/50'}`}>Melhorar</button>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="prompt" className="text-sm font-medium text-gray-300">
                          {mode === Mode.Enhance ? 'Instrução Adicional' : activeEditFunc === EditFunction.MagicExpand ? 'Descreva a Expansão (Opcional)' : 'Prompt Principal'}
                        </label>
                        <div className="relative">
                           <textarea id="prompt" rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            className="w-full bg-gray-900/70 border border-gray-700/80 rounded-lg p-2.5 text-sm placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors pr-10"
                            placeholder={
                               mode === Mode.Create ? 'Ex: um astronauta surfando em uma onda cósmica' : 
                               mode === Mode.Edit && activeEditFunc === EditFunction.MagicExpand ? 'Ex: um céu estrelado com uma nebulosa' :
                               mode === Mode.Edit ? 'Ex: adicione um chapéu de mago no gato' :
                               'Ex: deixe as cores mais vibrantes (opcional)'
                            }/>
                            {mode === Mode.Create &&
                              <button
                                onClick={handleEnhancePrompt}
                                disabled={isEnhancingPrompt}
                                title="Melhorar prompt com IA"
                                className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-800 hover:bg-purple-900 text-purple-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                              >
                                {isEnhancingPrompt ? (
                                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                  <Icon name="sparkles" className="w-4 h-4" />
                                )}
                              </button>
                            }
                        </div>
                    </div>
                    
                    {mode === Mode.Create ? renderCreateFunctions() : 
                     mode === Mode.Edit ? renderEditFunctions() :
                     renderEnhanceFunctions()}

                    {mode === Mode.Create && activeCreateFunc === CreateFunction.Video && (
                        <div className="space-y-2 p-3 bg-gray-900/50 rounded-lg">
                            <label className="text-sm font-medium text-gray-300">
                                Imagem de Referência <span className="text-xs text-gray-500">(Opcional)</span>
                            </label>
                            {videoReferencePreview && videoReferenceImage ? (
                                <div className="flex items-center justify-between p-2 bg-gray-800 rounded-md animate-fade-in">
                                    <div className="flex items-center space-x-2 overflow-hidden">
                                        <img src={videoReferencePreview} alt="Video Reference Thumbnail" className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
                                        <span className="text-xs text-gray-300 truncate">{videoReferenceImage.name}</span>
                                    </div>
                                    <button onClick={handleRemoveVideoReferenceImage} className="p-1 rounded-full hover:bg-red-500/80 text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2">
                                        <Icon name="close" className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <UploadArea id="videoRef" onImageSelect={(file) => handleSelectFile(file, setVideoReferenceImage, setVideoReferencePreview, 'videoRef')} previewUrl={videoReferencePreview} title="Selecionar Imagem" isUploading={isUploading['videoRef']} isDual/>
                            )}
                        </div>
                    )}
                    
                    {mode === Mode.Create && activeCreateFunc !== CreateFunction.Video ? (
                        renderReferenceImages()
                    ) : null}

                    {mode === Mode.Edit && (
                        <div className="space-y-4">
                            <UploadArea id="edit1" onImageSelect={(file) => handleSelectFile(file, setImage1, setImage1Preview, 'edit1')} previewUrl={image1Preview} title="Enviar Imagem" isUploading={isUploading['edit1']} />
                            {isComposeMode && (
                                <UploadArea id="edit2" onImageSelect={(file) => handleSelectFile(file, setImage2, setImage2Preview, 'edit2')} previewUrl={image2Preview} title="Enviar Imagem 2" isUploading={isUploading['edit2']} isDual />
                            )}
                        </div>
                    )}
                    
                    {mode === Mode.Enhance && (
                        <div className="space-y-4">
                            <UploadArea id="enhance" onImageSelect={(file) => handleSelectFile(file, setEnhanceImage, setEnhanceImagePreview, 'enhance')} previewUrl={enhanceImagePreview} title="Enviar Imagem para Melhorar" isUploading={isUploading['enhance']} />
                        </div>
                    )}
                    
                    {generatedImage && renderAdjustmentsPanel()}

                    {mode === Mode.Create && (
                        <CollapsibleSection title="Opções Avançadas">
                            {activeCreateFunc !== CreateFunction.Video && (
                                <div className="space-y-2">
                                    <label htmlFor="negative-prompt" className="text-sm font-medium text-gray-300">Prompt Negativo</label>
                                    <input id="negative-prompt" type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)}
                                        className="w-full bg-gray-900/70 border border-gray-700/80 rounded-lg p-2 text-sm placeholder-gray-500 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
                                        placeholder="Ex: texto, marca d'água, deformado"/>
                                </div>
                            )}
                        </CollapsibleSection>
                    )}

                    <div className="py-2">
                        <HistoryPanel history={history} onHistoryClick={handleSidebarHistoryClick} onClearHistory={onClearHistory} />
                    </div>

                </div>
                 <div className="pt-2 flex-shrink-0">
                    {mode === Mode.Create && (
                        <button onClick={activeCreateFunc === CreateFunction.Video ? () => handleGenerateVideo(videoMotionLevel) : handleGenerate} disabled={isLoading} className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors transform active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed">
                            {isLoading ? 'Gerando...' : 'GERAR'}
                        </button>
                    )}
                     {mode === Mode.Edit && (
                        <button onClick={handleApplyEdit} disabled={isLoading} className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors transform active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed">
                             {isLoading ? 'Processando...' : activeEditFunc === EditFunction.MagicExpand ? 'APLICAR EXPANSÃO' : 'APLICAR EDIÇÃO'}
                        </button>
                    )}
                     {mode === Mode.Enhance && (
                        <button onClick={handleApplyEnhancement} disabled={isLoading} className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors transform active:scale-95 disabled:bg-gray-700 disabled:cursor-not-allowed">
                             {isLoading ? 'Melhorando...' : 'APLICAR MELHORIA'}
                        </button>
                    )}
                </div>
            </aside>

            {/* Right Panel (Main Content) */}
            <main className="flex-1 flex flex-col p-4 bg-black/30">
                <div className="flex-1 flex items-center justify-center relative bg-grid-pattern rounded-lg min-h-[300px] transition-all duration-300">
                    {isLoading && progress !== null && <ProgressBar progress={progress} message={progressMessage} />}
                    
                    {!isLoading && generatedImage && beforeImage && (
                        <div className="w-full h-full p-4 animate-fade-in-up">
                            <BeforeAfterSlider before={beforeImage} after={generatedImage} />
                        </div>
                    )}
                    
                    {!isLoading && generatedImage && !beforeImage && !videoBlobUrl && (
                         <div className="relative w-full h-full flex items-center justify-center group">
                            <img src={generatedImage} alt="Generated art" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50 animate-fade-in-up" style={{ filter: filterCss }} />
                            <button
                                onClick={() => setIsFocusViewOpen(true)}
                                className="absolute flex items-center justify-center px-5 py-2.5 bg-black/70 backdrop-blur-sm rounded-lg border border-white/20 text-white font-semibold transition-all duration-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:border-white/40 hover:scale-105 transform"
                                aria-label="Visualizar Detalhes"
                            >
                                <Icon name="expand" className="w-5 h-5 mr-2" />
                                Visualizar Detalhes
                            </button>
                        </div>
                    )}

                    {!isLoading && videoBlobUrl && (
                        <video src={videoBlobUrl} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50 animate-fade-in-up" />
                    )}
                    
                    {!isLoading && isMagicExpandModeActive && (
                        <div ref={expandFrameRef} className="relative w-full h-full flex items-center justify-center p-4">
                            {/* This inner div controls the aspect ratio of the frame */}
                            <div className="relative w-full h-full border-2 border-dashed border-purple-500/50 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: expandTargetRatio.replace(':', '/') }}>
                                <img
                                    ref={imageRef}
                                    src={image1Preview!}
                                    alt="Image to expand"
                                    className="absolute max-w-full max-h-full cursor-move shadow-2xl shadow-black/80"
                                    style={{ 
                                        left: `${expandImagePos.x}px`,
                                        top: `${expandImagePos.y}px`,
                                    }}
                                    onMouseDown={handleExpandMouseDown}
                                    draggable={false}
                                />
                            </div>
                        </div>
                    )}

                    {!isLoading && isMaskingModeActive && (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img ref={imageRef} src={image1Preview!} alt="Editing mask" className="max-w-full max-h-full object-contain pointer-events-none" onLoad={() => { /* trigger canvas resize */ }} />
                            <canvas
                                ref={maskCanvasRef}
                                className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                                onMouseDown={handleMaskMouseDown}
                                onMouseMove={handleMaskMouseMove}
                                onMouseUp={handleMaskMouseUp}
                                onMouseLeave={handleMaskMouseUp}
                            />
                            <canvas
                                ref={lassoPreviewCanvasRef}
                                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                            />
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-gray-700/50 flex items-center space-x-3 shadow-lg">
                                <button onClick={() => setActiveMaskTool('brush')} className={`p-2 rounded-md transition-colors ${activeMaskTool === 'brush' ? 'bg-purple-600' : 'hover:bg-gray-700'}`} title="Pincel">
                                    <Icon name="brush" className="w-5 h-5"/>
                                </button>
                                <button onClick={() => setActiveMaskTool('eraser')} className={`p-2 rounded-md transition-colors ${activeMaskTool === 'eraser' ? 'bg-purple-600' : 'hover:bg-gray-700'}`} title="Borracha">
                                    <Icon name="eraser" className="w-5 h-5"/>
                                </button>
                                <button onClick={() => setActiveMaskTool('lasso')} className={`p-2 rounded-md transition-colors ${activeMaskTool === 'lasso' ? 'bg-purple-600' : 'hover:bg-gray-700'}`} title="Laço">
                                    <Icon name="lasso" className="w-5 h-5"/>
                                </button>
                                {(activeMaskTool === 'brush' || activeMaskTool === 'eraser') && (
                                    <div className="flex items-center space-x-2">
                                        <input type="range" min="5" max="150" value={maskBrushSize} onChange={e => setMaskBrushSize(Number(e.target.value))} className="w-32" />
                                    </div>
                                )}
                                <button onClick={clearMaskCanvas} className="p-2 rounded-md hover:bg-gray-700 transition-colors" title="Limpar Máscara">
                                    <Icon name="reset" className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLoading && !generatedImage && !videoBlobUrl && !isMaskingModeActive && !isMagicExpandModeActive && (
                        <div className="text-center text-gray-500">
                             {mode === Mode.Edit && image1Preview ? (
                                <img src={image1Preview} alt="Image to edit" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50" />
                             ) : mode === Mode.Enhance && enhanceImagePreview ? (
                                 <img src={enhanceImagePreview} alt="Image to enhance" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl shadow-black/50" />
                             ) : (
                                <>
                                    <Icon name="image" className="w-24 h-24 mx-auto text-gray-700/50" />
                                    <p className="mt-4 font-semibold">Sua arte aparecerá aqui</p>
                                    <p className="text-sm">Ajuste as configurações e clique em "Gerar"</p>
                                </>
                             )}
                        </div>
                    )}
                    
                    {generatedImage && !isLoading && (
                        <>
                            <div className="absolute top-2 right-2 flex items-center space-x-1 bg-black/50 backdrop-blur-md p-1 rounded-lg border border-gray-700/50">
                                <button onClick={handleUndo} disabled={currentHistoryIndex === 0} title="Desfazer" className="p-1.5 rounded-md hover:bg-gray-800 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"><Icon name="undo" className="w-5 h-5"/></button>
                                <button onClick={handleRedo} disabled={currentHistoryIndex === editHistory.length - 1} title="Refazer" className="p-1.5 rounded-md hover:bg-gray-800 transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"><Icon name="redo" className="w-5 h-5"/></button>
                            </div>
                            <div className="absolute bottom-4 right-4" ref={exportButtonRef}>
                                <div className="flex items-center space-x-2">
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsExportDropdownOpen(prev => !prev)}
                                            title="Baixar Imagem"
                                            className="flex items-center space-x-2 bg-gray-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors transform active:scale-95 shadow-lg"
                                        >
                                            <Icon name="download" className="w-5 h-5" />
                                            <span>Baixar</span>
                                            <Icon name="chevron-down" className={`w-4 h-4 transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isExportDropdownOpen && (
                                            <div className="absolute bottom-full mb-2 right-0 w-48 bg-gray-800/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl overflow-hidden animate-fade-in-up z-10">
                                                <ul className="py-1">
                                                    <li>
                                                        <button onClick={() => { handleExport('jpeg', 92); setIsExportDropdownOpen(false); }} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/80 transition-colors">
                                                            <span>Baixar como JPEG</span>
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => { handleExport('png', 100); setIsExportDropdownOpen(false); }} className="w-full text-left flex items-center space-x-3 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700/80 transition-colors">
                                                             <span>Baixar como PNG</span>
                                                        </button>
                                                    </li>
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
                 {isGeneratingVariations && progress !== null && (
                    <div className="mt-4 h-32">
                        <ProgressBar progress={progress} message={progressMessage} />
                    </div>
                 )}

                {originalForVariations && !isGeneratingVariations && (
                    <div className="mt-4 p-2 bg-gray-900/50 rounded-lg animate-fade-in-up">
                        <h3 className="text-sm font-semibold mb-2 text-gray-300 px-1">Variações</h3>
                        <div className="flex space-x-3 p-1 overflow-x-auto filmstrip-scrollbar">
                            {[originalForVariations, ...variations].map((imgSrc, index) => {
                                const isActive = imgSrc === generatedImage;
                                return (
                                    <div 
                                        key={index}
                                        className={`relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden group transition-all duration-200 ${isActive ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-500/20' : 'ring-1 ring-gray-700'}`}
                                    >
                                        <img 
                                            src={imgSrc} 
                                            alt={`Variação ${index}`} 
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200 cursor-pointer"
                                            onClick={() => handleSelectVariation(imgSrc)}
                                            title={isActive ? "Variação atual" : `Selecionar Variação ${index}`}
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                            <button 
                                                onClick={() => handleViewVariationDetails(imgSrc)}
                                                className="p-2 rounded-full bg-black/50 hover:bg-purple-500/80 transition-colors"
                                                title="Visualizar Detalhes"
                                            >
                                                <Icon name="expand" className="w-5 h-5 text-white" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};