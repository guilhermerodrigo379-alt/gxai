import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { ImageFile } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const enhancePromptWithGemini = async (prompt: string, referenceImage?: ImageFile): Promise<string> => {
  if (!prompt.trim()) {
    return prompt;
  }

  try {
    if (referenceImage) {
      const imagePart = {
        inlineData: {
          data: referenceImage.base64,
          mimeType: referenceImage.mimeType,
        },
      };
      const textPart = {
        text: `Prompt do usuário: "${prompt}"`,
      };
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction: `Você é um especialista em análise de arte e engenharia de prompts. Sua missão é criar um prompt de geração de imagem detalhado e evocativo a partir de um texto do usuário (o "assunto") e uma imagem de referência (o "estilo").

1.  **Análise de Estilo:** Extraia meticulosamente as características visuais da imagem de referência. Identifique e descreva: o estilo artístico (ex: fotorrealismo, pintura a óleo, arte vetorial), a paleta de cores predominante, o tipo de iluminação (ex: suave, dramática, luz do dia), a composição, as texturas visíveis e a atmosfera geral.
2.  **Construção do Prompt:** Combine o "assunto" do usuário com a sua "análise de estilo". O novo prompt deve descrever claramente o assunto desejado, mas renderizado com todas as características estilísticas que você extraiu da imagem de referência.

O resultado final deve ser um único parágrafo de texto: o prompt aprimorado, pronto para ser usado. Não inclua nenhuma outra informação, explicação, ou formatação como aspas ou marcadores. Apenas o texto do prompt.`,
          temperature: 0.7,
        },
      });
      return response.text.trim();
    } else {
      // Fallback to text-only enhancement
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Prompt do usuário: "${prompt}"`,
        config: {
          systemInstruction: `Você é um assistente criativo que expande prompts de usuário simples em prompts detalhados, descritivos e vívidos para um modelo de geração de imagem de IA (como Midjourney ou DALL-E).
- Foque nos detalhes visuais: Descreva o assunto, o fundo, cores, texturas e atmosfera.
- Sugira um estilo: ex., fotorrealista, pintura a óleo, arte vetorial, renderização 3D, iluminação cinematográfica.
- Adicione detalhes de câmera: ex., foto em grande angular, macro, vista aérea.
- Sua resposta deve ser APENAS o texto do prompt aprimorado, sem frases introdutórias, explicações ou aspas. Apenas o prompt puro, pronto para ser usado.`,
          temperature: 0.8,
        },
      });
      return response.text.trim();
    }
  } catch (error) {
    console.error("Error enhancing prompt:", error);
    throw error;
  }
};

const getMimeType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
};

const getStylePrompt = (prompt: string, createFunction: string): string => {
  switch(createFunction) {
    case 'seedream4k':
      return `Masterpiece, best quality, cinematic film still of ${prompt}. Shot on 70mm film, capturing hyper-detailed textures and lifelike features. Professional color grading, dramatic, award-winning photography, 4K UHD, ultra-realistic, sharp focus, volumetric lighting, epic composition.`;
    case 'cinema':
      return `Cinematic film still of ${prompt}, dramatic cinematic lighting, shallow depth of field, 35mm film grain, anamorphic lens flare, professionally color graded, ultra realistic.`;
    case 'scenario':
      return `Breathtaking fantasy landscape concept art of ${prompt}. A beautiful scenic digital painting, epic scale, highly detailed environment, atmospheric lighting.`;
    case 'portrait':
      return `Professional studio portrait photograph of ${prompt}, hyper-realistic, sharp focus, detailed skin texture, expressive, neutral background, dramatic lighting.`;
    default: // free
      return `A highly detailed, photorealistic image of: ${prompt}.`;
  }
};

const getModifiedPrompt = (prompt: string, createFunction: string, negativePrompt?: string): string => {
  const basePrompt = getStylePrompt(prompt, createFunction);
  if (negativePrompt && negativePrompt.trim()) {
    // This syntax is effective for Imagen models.
    return `${basePrompt} --no ${negativePrompt.trim()}`;
  }
  return basePrompt;
};

export const generateImageWithGemini = async (
  prompt: string, 
  createFunction: string,
  aspectRatio: string,
  baseImages?: ImageFile[],
  negativePrompt?: string
): Promise<string> => {

  if (baseImages && baseImages.length > 0) {
    const imageParts = baseImages.map(img => ({
      inlineData: {
        data: img.base64,
        mimeType: img.mimeType,
      },
    }));
    
    const styledPrompt = getStylePrompt(prompt, createFunction);
    
    const newPrompt = `**Instrução Crítica: Fidelidade Visual Absoluta.** Sua tarefa é gerar uma nova imagem que combine os elementos do prompt de texto com o estilo visual e a composição das imagens de referência fornecidas. A fidelidade às referências é a prioridade máxima.

1.  **Imagem Principal (a primeira da lista):** Esta é a sua referência principal. A imagem gerada deve replicar fielmente o **assunto, a composição, a pose e a atmosfera geral** desta imagem.
2.  **Imagens de Estilo Adicionais (as restantes, se houver):** Use estas imagens para refinar o estilo. Extraia e aplique características como a **paleta de cores, texturas, iluminação e o estilo artístico geral** delas.
3.  **Prompt de Texto:** O prompt de texto descreve as modificações ou o tema central que deve ser aplicado ao conteúdo da Imagem Principal. Se o prompt disser "um gato com um chapéu de mago", e a imagem principal for um cachorro, você deve gerar uma imagem de um *gato* na mesma pose e estilo da imagem do cachorro, usando o chapéu de mago. O prompt tem prioridade para o *conteúdo*, enquanto as imagens têm prioridade para o *estilo e composição*.
4.  **Resultado Final:** A imagem final deve ser uma fusão coesa, parecendo que o artista que criou as imagens de referência também criou esta nova imagem com base no prompt. A consistência visual é essencial.

**NÃO GERE UMA VARIAÇÃO SOLTA.** A tarefa é uma recriação estilisticamente fiel com base no prompt.

**Prompt de Texto (Conteúdo/Modificações):** "${styledPrompt}"
${negativePrompt && negativePrompt.trim() ? `\n**Restrições (Prompt Negativo):** A imagem gerada NÃO DEVE conter os seguintes elementos: ${negativePrompt.trim()}` : ''}`;
    
    const textPart = { text: newPrompt };
    
    const parts: any[] = [...imageParts, textPart];
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    if (response.promptFeedback?.blockReason) {
        const reason = response.promptFeedback.blockReasonMessage || response.promptFeedback.blockReason;
        throw new Error(`Geração bloqueada por segurança. Motivo: ${reason}. Ajuste o prompt ou a imagem.`);
    }

    const firstCandidate = response.candidates?.[0];
    if (!firstCandidate?.content?.parts) {
      throw new Error('Resposta inválida do modelo de IA. A geração pode ter sido interrompida. Tente novamente.');
    }

    const imagePart = firstCandidate.content.parts.find(p => p.inlineData);
    if (imagePart?.inlineData) {
      const { data, mimeType } = imagePart.inlineData;
      return `data:${mimeType};base64,${data}`;
    }

    const textPartFound = firstCandidate.content.parts.find(p => p.text);
    if (textPartFound?.text) {
      throw new Error(`A geração de imagem falhou. A IA respondeu: ${textPartFound.text}`);
    }

    throw new Error('A geração com imagem de referência falhou. Nenhuma imagem foi retornada na resposta. Verifique se o prompt é claro.');
  } else {
    const modifiedPrompt = getModifiedPrompt(prompt, createFunction, negativePrompt);
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: modifiedPrompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio as "1:1" | "16:9" | "9:16" | "4:3" | "3:4",
      },
    });

    // FIX: The `GenerateImagesResponse` type does not have a `promptFeedback` property.
    // A blocked request will result in an empty `generatedImages` array,
    // which is handled by the logic below.
    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    } else {
      throw new Error('A geração de imagem falhou, nenhuma imagem foi retornada. O prompt pode ser muito complexo, vago ou violar as políticas de segurança.');
    }
  }
};

export const generateVideoWithGemini = async (
  prompt: string,
  onProgress: (progress: number, message: string) => void,
  referenceImage?: ImageFile,
  motionLevel: 'subtle' | 'moderate' | 'dynamic' = 'moderate'
): Promise<string> => {
  onProgress(1, "Enviando solicitação de vídeo...");

  let finalPrompt: string;

  if (referenceImage) {
    switch(motionLevel) {
      case 'subtle':
        finalPrompt = `**Instrução Absoluta: Animação Sutil e Fiel.** Sua única missão é animar sutilmente a imagem de referência, como um 'cinemagraph'. O resultado deve parecer a imagem estática ganhando vida com movimentos mínimos e naturais (ex: cabelo ao vento, vapor subindo, piscar de olhos). **NÃO introduza movimentos de câmera.** Preserve 100% do estilo, composição, cores e iluminação. O prompt do usuário define apenas a *natureza* do movimento sutil. Prompt do Usuário: "${prompt}"`;
        break;
      case 'moderate':
        finalPrompt = `**Instrução: Animação Cinematográfica Moderada.** Sua missão é criar um vídeo que se baseia na imagem de referência. Anime a cena com movimentos naturais. Preserve o estilo artístico, os personagens e o ambiente da imagem, mas introduza um movimento de câmera suave (como um leve travelling, pan ou tilt) para dar mais vida à cena. O prompt do usuário define a ação principal. Prompt do Usuário: "${prompt}"`;
        break;
      case 'dynamic':
        finalPrompt = `**Instrução: Vídeo Dinâmico Baseado em Referência.** Use a imagem de referência como ponto de partida. Crie um vídeo dinâmico e cinematográfico. O estilo e os elementos principais devem ser inspirados na imagem, mas você tem liberdade para introduzir movimentos de câmera significativos (zoom, travelling rápido, câmera na mão), animações energéticas e até expandir a cena. O prompt do usuário define a ação principal. Prompt do Usuário: "${prompt}"`;
        break;
    }
  } else {
    switch(motionLevel) {
      case 'subtle':
        finalPrompt = `**Estilo: Cinemagraph/Sutil.** Gere um vídeo de altíssima qualidade focado em movimentos mínimos, delicados e atmosféricos. Ideal para retratos em movimento ou paisagens tranquilas. A composição deve ser majoritariamente estática, com movimentos de câmera quase imperceptíveis, se houver. Renderize em 4K, com iluminação natural. Prompt do Usuário: "${prompt}"`;
        break;
      case 'moderate':
        finalPrompt = `**Estilo: Cinematográfico Padrão.** Gere um vídeo de alta qualidade com movimentos de câmera padrão (pan, tilt, travelling suave) e ação moderada. Foque em movimento suave, texturas realistas e iluminação dramática. Qualidade de produção, 4K. Prompt do Usuário: "${prompt}"`;
        break;
      case 'dynamic':
        finalPrompt = `**Estilo: Ação/Dinâmico.** Gere uma cena cinematográfica de alta energia. Use movimentos de câmera dinâmicos (câmera na mão, travelling rápido, cortes, ângulos dramáticos) para criar um ritmo rápido. A iluminação deve ser intensa e o movimento, enérgico. Qualidade de filme de ação, 4K. Prompt do Usuário: "${prompt}"`;
        break;
    }
  }


  const requestPayload: any = {
    model: 'veo-2.0-generate-001',
    prompt: finalPrompt,
    config: {
      numberOfVideos: 1,
    },
  };

  if (referenceImage) {
    requestPayload.image = {
      imageBytes: referenceImage.base64,
      mimeType: referenceImage.mimeType,
    };
  }

  let operation = await ai.models.generateVideos(requestPayload);

  onProgress(5, "Operação de vídeo iniciada. Aguardando progresso...");
  
  const startTime = Date.now();
  const timeoutMinutes = 10;
  const timeoutMillis = timeoutMinutes * 60 * 1000;

  while (!operation.done) {
    if (Date.now() - startTime > timeoutMillis) {
      throw new Error(`A geração de vídeo excedeu o tempo limite de ${timeoutMinutes} minutos.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });

    const progressPercent = (operation.metadata as any)?.progressPercent;
    
    if (typeof progressPercent === 'number') {
        const displayProgress = 5 + Math.floor(progressPercent * 0.9);
        onProgress(displayProgress, "Renderizando seu vídeo...");
    }
  }

  if (operation.error) {
    throw new Error(`A geração de vídeo falhou: ${operation.error.message}`);
  }

  onProgress(95, "Quase pronto! Finalizando o vídeo...");

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    throw new Error('A geração de vídeo falhou, nenhum link de download foi retornado.');
  }

  onProgress(97, "Baixando vídeo...");

  if (!process.env.API_KEY) {
    throw new Error("A chave de API não está configurada para baixar o vídeo.");
  }
  
  // Using a header for the API key is a more standard and robust method for authorization.
  const response = await fetch(downloadLink, {
    headers: {
        'x-goog-api-key': process.env.API_KEY,
    }
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Falha ao baixar o vídeo. Ocorreu um problema de autorização ao tentar baixar o vídeo.`);
    }
    const errorText = await response.text();
    throw new Error(`Falha ao baixar o vídeo. O servidor respondeu com status ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.startsWith('video/')) {
      throw new Error('Falha ao baixar o vídeo: a resposta do servidor não foi um arquivo de vídeo válido.');
  }

  const videoBlob = await response.blob();
  const blobUrl = URL.createObjectURL(videoBlob);
  return blobUrl;
};

export const generatePromptFromImage = async (image: ImageFile): Promise<string> => {
  try {
    const imagePart = {
      inlineData: {
        data: image.base64,
        mimeType: image.mimeType,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart] },
      config: {
        systemInstruction: `Você é um especialista em engenharia de prompts para modelos de geração de imagem de IA. Sua tarefa é analisar a imagem fornecida e criar um prompt de texto detalhado, evocativo e artístico que possa ser usado para gerar uma imagem semelhante.

1.  **Analise o conteúdo:** Identifique o assunto principal, os elementos de fundo e quaisquer detalhes importantes.
2.  **Descreva o estilo:** Determine o estilo artístico (ex: fotorrealismo, pintura a óleo, arte de fantasia, estilo anime, renderização 3D).
3.  **Capture a atmosfera:** Descreva a iluminação (ex: dramática, luz suave, néon), a paleta de cores e o humor geral (ex: melancólico, vibrante, misterioso).
4.  **Adicione palavras-chave de qualidade:** Inclua termos como "obra-prima, alta qualidade, altamente detalhado, foco nítido".

O resultado final deve ser um único parágrafo de texto: o prompt aprimorado. Não inclua nenhuma outra informação, explicação, ou formatação como aspas ou marcadores. Apenas o texto do prompt.`,
        temperature: 0.7,
      },
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating prompt from image:", error);
    throw error;
  }
};

export const generateVariationsWithGemini = async (
  prompt: string,
  baseImage: ImageFile,
  negativePrompt?: string
): Promise<string[]> => {

  const imagePart = {
    inlineData: {
      data: baseImage.base64,
      mimeType: baseImage.mimeType,
    },
  };

  const variationPrompt = `**Instrução Crítica: Criar Variações Fiéis.**
Sua tarefa é gerar uma imagem que seja uma variação sutil da imagem de referência fornecida. Mantenha o mesmo assunto, composição, cores e estilo artístico geral. Introduza pequenas alterações em detalhes, como iluminação, texturas ou elementos de fundo secundários. O resultado deve ser claramente reconhecível como a mesma cena, mas com uma nova perspectiva. Não altere o assunto principal.
${negativePrompt && negativePrompt.trim() ? `\n**Restrições (Prompt Negativo):** A imagem gerada NÃO DEVE conter os seguintes elementos: ${negativePrompt.trim()}` : ''}
\n**Prompt Original (para contexto):** "${prompt}"`;

  const textPart = { text: variationPrompt };
  const parts: any[] = [imagePart, textPart];
  
  const generateSingleVariation = async (): Promise<string | null> => {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: parts },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });
      
      if (response.promptFeedback?.blockReason) {
          console.warn(`Variation generation blocked: ${response.promptFeedback.blockReason}`);
          return null;
      }

      const imagePartRes = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (imagePartRes?.inlineData) {
        const { data, mimeType } = imagePartRes.inlineData;
        return `data:${mimeType};base64,${data}`;
      }
      return null;
    } catch (error) {
      console.error("Error generating single variation:", error);
      return null;
    }
  };
  
  const variationPromises = Array(4).fill(null).map(() => generateSingleVariation());
  const results = await Promise.all(variationPromises);
  const successfulVariations = results.filter((r): r is string => r !== null);

  if (successfulVariations.length > 0) {
    return successfulVariations;
  } else {
    throw new Error('A geração de variações falhou, nenhuma imagem foi retornada. A imagem original ou o prompt podem violar as políticas de segurança.');
  }
};

export const editImageWithGemini = async (
  prompt: string, 
  editFunction: string,
  image1: ImageFile, 
  image2?: ImageFile,
  mask?: ImageFile
): Promise<string> => {
  
  const imagePart1 = {
    inlineData: {
      data: image1.base64,
      mimeType: image1.mimeType,
    },
  };
  
  const parts: any[] = [imagePart1];
  let finalPrompt: string;

  if (mask && (editFunction === 'add-remove' || editFunction === 'magic-expand')) {
    const maskPart = {
      inlineData: {
        data: mask.base64,
        mimeType: mask.mimeType,
      },
    };
    parts.push(maskPart);
    if (editFunction === 'magic-expand') {
        finalPrompt = `**CRITICAL INSTRUCTION: OUTPAINTING TASK**
You are an expert image editor. Your goal is to extend the **first image (source image)** based on the user's text prompt.
- The **second image (mask image)** defines the area to be filled.
- You MUST ONLY fill in the **white areas** of the mask image.
- The **black areas** of the mask image (which contain the source image) must be perfectly preserved.
- Blend the new content seamlessly with the source image, matching its style, lighting, and texture.
- The user's text prompt describes the desired content for the new areas. If the prompt is empty, creatively extend the existing scene.

**User Prompt:** "${prompt}"`;
    } else { // add-remove inpainting
        finalPrompt = `**CRITICAL INSTRUCTION: INPAINTING TASK**
You are an expert image editor. Your goal is to modify the **first image (source image)** based on the user's text prompt.
- The **second image (mask image)** defines the area to be modified.
- You MUST ONLY change the pixels in the source image that correspond to the **white areas** of the mask image.
- The **black areas** of the mask image must be preserved perfectly from the source image.
- Blend the new content seamlessly into the surrounding image.
- The user's text prompt describes the desired change for the masked area.

**User Prompt:** "${prompt}"`;
    }
  } else {
    if (editFunction === 'compose' && image2) {
      const imagePart2 = {
        inlineData: {
          data: image2.base64,
          mimeType: image2.mimeType,
        },
      };
      parts.push(imagePart2);
    }
    
    switch (editFunction) {
        case 'compose':
            finalPrompt = `Sua tarefa é unir as duas imagens fornecidas de forma criativa e coesa, seguindo a instrução do usuário. A primeira imagem é a base. Analise os elementos de ambas as imagens (assuntos, fundos, estilos) e combine-os em uma única imagem. Instrução: "${prompt}"`;
            break;
        case 'style':
            finalPrompt = `Aplique um novo estilo artístico à imagem fornecida com base na seguinte descrição. O conteúdo principal e a composição da imagem devem ser preservados, mas a estética (cores, texturas, iluminação, etc.) deve ser completamente transformada para corresponder ao prompt. Novo estilo: "${prompt}"`;
            break;
        case 'add-remove':
            finalPrompt = `Modifique a imagem fornecida seguindo esta instrução precisa. Adicione ou remova objetos, pessoas ou elementos conforme descrito. Tente manter o resto da imagem o mais consistente possível com o original. Instrução: "${prompt}"`;
            break;
        case 'retouch':
            finalPrompt = `Realize um retoque sutil na imagem com base na seguinte instrução. Melhore a qualidade, corrija pequenas imperfeições ou ajuste a aparência geral sem alterar drasticamente o conteúdo. Instrução: "${prompt}"`;
            break;
        default:
            finalPrompt = prompt;
    }
  }
  
  parts.push({ text: finalPrompt });

  const contents: any = { parts };
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: contents,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  if (response.promptFeedback?.blockReason) {
    const reason = response.promptFeedback.blockReasonMessage || response.promptFeedback.blockReason;
    throw new Error(`Edição bloqueada por segurança. Motivo: ${reason}. Ajuste o prompt ou a imagem.`);
  }

  const firstCandidate = response.candidates?.[0];
  if (!firstCandidate?.content?.parts) {
    throw new Error('Resposta inválida do modelo de IA durante a edição. Tente novamente.');
  }

  const imagePart = firstCandidate.content.parts.find(p => p.inlineData);
  if (imagePart?.inlineData) {
    const { data, mimeType } = imagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  const textPart = firstCandidate.content.parts.find(p => p.text);
  if (textPart?.text) {
    throw new Error(`A edição de imagem falhou. A IA respondeu: ${textPart.text}`);
  }

  throw new Error('A edição de imagem falhou, nenhuma imagem foi retornada. Tente reformular sua instrução.');
};

export const upscaleImageWithGemini = async (
  image: ImageFile,
  upscaleValue: number | '4K'
): Promise<string> => {
  const imagePart = {
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType,
    },
  };

  let promptText: string;
  if (upscaleValue === '4K') {
      promptText = `Upscale this image to 4K resolution (approximately 3840 pixels on the longest side), significantly enhancing its resolution, sharpness, and fine details without changing the core content or style. Make it ultra high-definition.`;
  } else {
      promptText = `Upscale this image by ${upscaleValue}x, significantly enhancing its resolution, sharpness, and fine details without changing the core content or style. Make it high-definition.`;
  }

  const promptPart = { text: promptText };

  const contents: any = { parts: [imagePart, promptPart] };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: contents,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  if (response.promptFeedback?.blockReason) {
    const reason = response.promptFeedback.blockReasonMessage || response.promptFeedback.blockReason;
    throw new Error(`Upscale bloqueado por segurança. Motivo: ${reason}.`);
  }

  const firstCandidate = response.candidates?.[0];
  if (!firstCandidate?.content?.parts) {
    throw new Error('Resposta inválida do modelo de IA durante o upscale. Tente novamente.');
  }

  const foundImagePart = firstCandidate.content.parts.find(p => p.inlineData);
  if (foundImagePart?.inlineData) {
    const { data, mimeType } = foundImagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  const textPart = firstCandidate.content.parts.find(p => p.text);
  if (textPart?.text) {
    throw new Error(`O upscale da imagem falhou. A IA respondeu: ${textPart.text}`);
  }
  
  throw new Error('O upscale da imagem falhou, nenhuma imagem foi retornada na resposta.');
};

export const enhanceImageWithGemini = async (
  prompt: string,
  enhanceFunction: string,
  image: ImageFile,
  upscaleValue?: number | '4K'
): Promise<string> => {
  if (enhanceFunction === 'upscale') {
    if (!upscaleValue) throw new Error("O valor de upscale é necessário para a função de ampliar.");
    return upscaleImageWithGemini(image, upscaleValue);
  }

  const imagePart = {
    inlineData: {
      data: image.base64,
      mimeType: image.mimeType,
    },
  };
  
  let finalPrompt: string;
  switch (enhanceFunction) {
      case 'fix-details':
          finalPrompt = `Sua tarefa é atuar como um retocador de fotos profissional. Analise a imagem em busca de pequenas imperfeições, ruído ou falta de nitidez. Melhore sutilmente os detalhes, aumente a nitidez dos elementos-chave e limpe quaisquer artefatos visuais. A imagem final deve ser uma versão mais clara, nítida e de maior fidelidade do original, sem alterar o conteúdo. Se o usuário fornecer uma instrução, leve-a em consideração. Instrução do usuário: "${prompt}"`;
          break;
      case 'adjust-color':
          finalPrompt = `Analise criticamente a imagem fornecida e realize uma correção e gradação de cores profissional. Melhore a vivacidade e o equilíbrio das cores para tornar a imagem mais atraente, mantendo o realismo. Não altere o conteúdo ou a composição da imagem. O objetivo é uma melhoria sutil, mas significativa, na qualidade da cor. Se o usuário fornecer uma instrução (ex: 'deixe as cores mais quentes'), siga-a. Instrução do usuário: "${prompt}"`;
          break;
      case 'adjust-lighting':
          finalPrompt = `Analise a iluminação na imagem fornecida. Sua tarefa é melhorar sutilmente a iluminação para adicionar mais profundidade e dimensão. Melhore os realces e as sombras para criar uma aparência mais dramática e profissional, como se fosse iluminada por um fotógrafo profissional. Não altere o assunto ou a composição. Se o usuário der uma instrução (ex: 'adicione luz de contorno'), siga-a. Instrução do usuário: "${prompt}"`;
          break;
      default:
          throw new Error(`Função de melhoria desconhecida: ${enhanceFunction}`);
  }
  
  const parts: any[] = [imagePart, { text: finalPrompt }];

  const contents: any = { parts };
  
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: contents,
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  if (response.promptFeedback?.blockReason) {
    const reason = response.promptFeedback.blockReasonMessage || response.promptFeedback.blockReason;
    throw new Error(`Melhoria bloqueada por segurança. Motivo: ${reason}.`);
  }

  const firstCandidate = response.candidates?.[0];
  if (!firstCandidate?.content?.parts) {
    throw new Error('Resposta inválida do modelo de IA durante a melhoria. Tente novamente.');
  }

  const foundImagePart = firstCandidate.content.parts.find(p => p.inlineData);
  if (foundImagePart?.inlineData) {
    const { data, mimeType } = foundImagePart.inlineData;
    return `data:${mimeType};base64,${data}`;
  }

  const textPart = firstCandidate.content.parts.find(p => p.text);
  if (textPart?.text) {
    throw new Error(`A melhoria da imagem falhou. A IA respondeu: ${textPart.text}`);
  }
  
  throw new Error('A melhoria da imagem falhou, nenhuma imagem foi retornada na resposta.');
};