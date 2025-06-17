import {
  ILLMService,
  PromptContext,
} from '../interfaces/LLM.service.interface';
import { AIFunctionsHandler } from './AIFunctionsHandler.service';
import { GemmaLLM } from './gemmaLLM.service';

async function testFunctionCallingService(chatService: ILLMService) {
  console.log('--- Starting AI Function Calling Test ---');

  // --- Setup remains the same ---
  // const functionsHandler = new AIFunctionsHandler();
  // const chatService = new deepseekLLM(functionsHandler);

  const context: PromptContext = {
    prompt: 'Get me a summary of my habits this week?',
    userId: 'user1332',
  };

  try {
    console.log(`\nUser Prompt: "${context.prompt}"`);
    console.log('------------------------------------');
    console.log('AI Final Response Stream:');

    const generator = chatService.generateResponse(context);

    for await (const token of generator) {
      process.stdout.write(token);
    }

    console.log('\n\n--- Stream Finished ---');
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('\n\n--- An error occurred during the test ---');
    console.error(error);
  } finally {
    console.log('\n--- Test Script Ended ---');
  }
}
const functionsHandler = new AIFunctionsHandler();
testFunctionCallingService(new GemmaLLM(functionsHandler));
