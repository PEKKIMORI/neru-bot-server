import Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { ConversationManagerService } from './conversationManager.service';
import { AIFunctionsHandler } from 'src/ai/services/AIFunctionsHandler.service';
import { ILLMService } from 'src/ai/interfaces/LLM.service.interface';
import { GemmaLLM } from 'src/ai/services/gemmaLLM.service';
import { RedisConversationRepository } from '../infrastructure/persistence/redis-conversation.repository';
import { RedisService } from 'src/redis/redis.service';
import { ConversationService } from './conversation.service';

async function testConversationContext(
  managerService: ConversationManagerService,
  redisClient: Redis,
) {
  const logger = new Logger('TestScript');

  console.log('--- Starting Manual Conversation Context Test ---');

  const testUserId = 'manual-test-user-sakuma';
  const testContext = 'user-name-remember-test';

  try {
    // Clean the DB for a fresh start
    await redisClient.del(`conversation:${testUserId}:${testContext}`);

    logger.log(`Using User ID: ${testUserId}, Context: ${testContext}\n`);

    // --- Message 1: Tell the AI the user's name ---
    const firstMessage = 'Hi there. My name is Sakuma.';
    console.log(`> User: ${firstMessage}`);
    const firstReply = await managerService.getAiReply(
      testUserId,
      testContext,
      firstMessage,
    );
    console.log(`< AI: ${firstReply}`);

    console.log('\n--- Asking the follow-up question... ---\n');

    // --- Message 2: Ask the AI what the user's name is ---
    const secondMessage = 'What is my name?';
    console.log(`> User: ${secondMessage}`);
    const finalReply = await managerService.getAiReply(
      testUserId,
      testContext,
      secondMessage,
    );

    // --- Verification Step ---
    console.log('-------------------------------------------');
    console.log('FINAL AI RESPONSE TO VERIFY:');
    console.log(`< AI: ${finalReply}`);
    console.log('-------------------------------------------');
    console.log(
      `(Please verify if the AI correctly remembered the user's name is "Sakuma".)`,
    );
  } catch (error) {
    console.error('\n\n--- An error occurred during the test ---');
    console.error(error);
  } finally {
    // This is crucial for allowing the script to exit.
    await redisClient.quit();
    console.log('\n--- Test Script Ended ---');
  }
}

// --- Manual Dependency Injection Chain ---
// This part remains unchanged as the service structure is the same.

// 1. Bottom-level dependencies
const functionsHandler = new AIFunctionsHandler();
const redisClient = new Redis({ host: 'localhost', port: 6379, db: 2 });

// 2. Services that depend on the bottom-level instances
const llmService: ILLMService = new GemmaLLM(functionsHandler);
const cacheService = new RedisService(redisClient);

// 3. Repository that depends on the cache service
const conversationRepo = new RedisConversationRepository(cacheService);

// 4. Application service that depends on the repository
const conversationAppService = new ConversationService(conversationRepo);

// 5. Top-level manager service that depends on the app service and LLM service
const managerService = new ConversationManagerService(
  conversationAppService,
  llmService,
);

// --- Run the test with our manually created service instance ---
testConversationContext(managerService, redisClient);
