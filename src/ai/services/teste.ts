import {
  ILLMService,
  PromptContext,
} from '../interfaces/LLM.service.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';
import { GemmaLLM } from './gemmaLLM.service';
import * as readline from 'readline';

async function chatWithAI(chatService: ILLMService) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('--- Terminal Chat with AI ---');
  console.log('Type your message and press Enter. Type "exit" to quit.');

  while (true) {
    const userPrompt = await new Promise<string>((resolve) => {
      rl.question('\nYou: ', resolve);
    });
    if (userPrompt.trim().toLowerCase() === 'exit') break;

    const context: PromptContext = {
      prompt: userPrompt,
      userId: 'user1332',
    };
    try {
      process.stdout.write('AI: ');
      const generator = chatService.generateResponse(context);
      for await (const token of generator) {
        process.stdout.write(token);
      }
      process.stdout.write('\n');
    } catch (error) {
      console.error('\n[Error]', error);
    }
  }
  rl.close();
  console.log('--- Chat Ended ---');
}

const functionsHandler = new AIFunctionsHandler();
chatWithAI(new GemmaLLM(functionsHandler));
// testFunctionCallingService(new GemmaLLM(functionsHandler));
