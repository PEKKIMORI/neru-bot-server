/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConversationService } from './conversation.service';
import {
  CONVERSATION_REPOSITORY,
  IConversationRepository,
} from '../interfaces/IConversation.repository.interface';
import { Conversation } from '../interfaces/IConversation.interface';

const mockConversationRepository: IConversationRepository = {
  findByUserIdAndContext: vi.fn(),
  save: vi.fn(),
};

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: CONVERSATION_REPOSITORY,
          useValue: mockConversationRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMessage', () => {
    const testData = {
      userId: 'user-1',
      context: 'journal',
      role: 'user' as const,
      content: 'Hello, world!',
    };

    it('should add a message to an existing conversation', async () => {
      // Arrange: Mock an existing conversation
      const existingConversation = new Conversation(
        testData.userId,
        testData.context,
      );
      existingConversation.addMessage = vi.fn(); // Also mock the method on the instance

      vi.mocked(
        mockConversationRepository.findByUserIdAndContext,
      ).mockResolvedValue(existingConversation);

      // Act
      const result = await service.addMessage(
        testData.userId,
        testData.context,
        testData.role,
        testData.content,
      );

      // Assert
      expect(
        mockConversationRepository.findByUserIdAndContext,
      ).toHaveBeenCalledWith(testData.userId, testData.context);
      expect(existingConversation.addMessage).toHaveBeenCalledWith(
        testData.role,
        testData.content,
      );
      expect(mockConversationRepository.save).toHaveBeenCalledWith(
        existingConversation,
      );
      expect(result).toBe(existingConversation);
    });

    it('should create a new conversation if one does not exist', async () => {
      // Arrange: Mock that no conversation is found
      vi.mocked(
        mockConversationRepository.findByUserIdAndContext,
      ).mockResolvedValue(null);

      // Act
      await service.addMessage(
        testData.userId,
        testData.context,
        testData.role,
        testData.content,
      );

      // Assert
      expect(
        mockConversationRepository.findByUserIdAndContext,
      ).toHaveBeenCalledWith(testData.userId, testData.context);

      expect(mockConversationRepository.save).toHaveBeenCalled();
      const savedConversation = vi.mocked(mockConversationRepository.save).mock
        .calls[0][0];
      expect(savedConversation).toBeInstanceOf(Conversation);
      expect(savedConversation.userId).toBe(testData.userId);
      expect(savedConversation.context).toBe(testData.context);
      expect(savedConversation.messages).toHaveLength(1);
      expect(savedConversation.messages[0].content).toBe(testData.content);
    });
  });

  describe('getConversation', () => {
    it('should return a conversation if found', async () => {
      const existingConversation = new Conversation('user-1', 'test');
      vi.mocked(
        mockConversationRepository.findByUserIdAndContext,
      ).mockResolvedValue(existingConversation);

      const result = await service.getConversation('user-1', 'test');

      expect(result).toBe(existingConversation);
    });

    it('should return null if not found', async () => {
      vi.mocked(
        mockConversationRepository.findByUserIdAndContext,
      ).mockResolvedValue(null);

      const result = await service.getConversation('user-1', 'test');

      expect(result).toBeNull();
    });
  });
});
