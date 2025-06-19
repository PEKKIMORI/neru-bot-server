import { ImageLLMService } from './imageLLM.service';
import * as fs from 'fs';
import * as path from 'path';

async function testImage() {
  // Parse command-line arguments for image path and optional task description
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: ts-node testImage.ts <imagePath> [taskDescription]');
    process.exit(1);
  }

  const imagePathArg = args[0];
  const imagePath = path.resolve(process.cwd(), imagePathArg);
  
  // Join all remaining arguments as the task description
  const taskDescription = args.length > 1 ? args.slice(1).join(' ') : 'Is the object in the image a cat?';

  // Read the image file into a buffer
  let imageBuffer: Buffer;
  try {
    imageBuffer = fs.readFileSync(imagePath);
  } catch (err) {
    console.error(`Failed to read image at ${imagePath}:`, err);
    process.exit(1);
  }

  const service = new ImageLLMService();
  try {
    const result = await service.analyzeImage(imageBuffer, taskDescription);
    console.log(`Analysis Result: ${result}`);
  } catch (error) {
    console.error('[Error]', error);
  }
}

testImage();
