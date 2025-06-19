export interface IImageLLMService {
    /**
     * Analyzes an image buffer to determine task completion.
     * @param imageBuffer - The raw image data as a Buffer.
     * @param taskDescription - Description of the task to verify.
     * @returns A promise that resolves to "YES" or "NO" based on analysis.
     */
    analyzeImage(imageBuffer: Buffer, taskDescription: string): Promise<string>;
}
