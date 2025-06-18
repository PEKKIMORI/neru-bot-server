import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { IImageLLMService } from '../interfaces/imageLLM.service.interface';

// This should be in a config file, but following the pattern from gemmaLLM.service.ts
const ai = new GoogleGenAI({ apiKey: "AIzaSyB1RnQt9FUwyQEGBLM-jR0tWVHt3nrYaCY"});

@Injectable()
export class ImageLLMService implements IImageLLMService {
    private readonly logger = new Logger(ImageLLMService.name);
    private readonly modelName = 'gemma-3-12b-it';

    async analyzeImage(
        imageBuffer: Buffer,
        taskDescription: string,
    ): Promise<string> {
        try {
            const prompt = `The task is: ${taskDescription}. Based on the image, did the user complete the task? Respond with "YES" or "NO".`;
            this.logger.log(
                `Analyzing image to see if the task "${taskDescription}" is complete.`,
            );

            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString('base64'),
                    mimeType: 'image/jpeg', // Assuming jpeg, can be parameterized
                },
            };

            const result = await ai.models.generateContent({
                model: this.modelName,
                contents: [{role: 'user', parts: [{ text: prompt }, imagePart]}]
            });

            if (result && result.candidates && result.candidates.length > 0) {
                const candidate = result.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].text) {
                    return candidate.content.parts[0].text;
                }
            }
            throw new ServiceUnavailableException('LLM call failed: No response from GenAI');
        } catch (error) {
            this.logger.error(
                'Failed to analyze image with Google GenAI.',
                error,
            );
            throw new Error('Image analysis failed');
        }
    }
}
