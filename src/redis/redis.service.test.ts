import {
  describe,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  it,
  expect,
  vi,
} from 'vitest';
import Redis from 'ioredis';
import { Test, TestingModule } from '@nestjs/testing';
import { REDIS_CLIENT, RedisService } from 'src/redis/redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let redisClient: Redis;

  beforeAll(() => {
    redisClient = new Redis({ host: 'localhost', port: 6379 });
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(async () => {
    await redisClient.flushdb();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setValue and getValue', () => {
    it('should set and get a string value', async () => {
      const key = 'test-key-string';
      const value = 'test-value';
      await service.setValue(key, value);
      const result = await service.getValue(key);

      expect(result).toBe(value);
    });

    it('should set and get an object value correctly', async () => {
      const key = 'test-key-object';
      const value = { id: 1, name: 'Alice', active: true };

      await service.setValue(key, value);
      const result = await service.getValue<typeof value>(key);

      expect(result).toEqual(value);
    });

    it('should set and get an array of objects', async () => {
      const key = 'test-key-array';
      const value = [
        { id: 1, task: 'Write tests' },
        { id: 2, task: 'Deploy' },
      ];
      await service.setValue(key, value);
      const result = await service.getValue<typeof value>(key);
      expect(result).toEqual(value);
    });

    it('should return null for a non-existent key', async () => {
      const result = await service.getValue('non-existent-key');
      expect(result).toBeNull();
    });

    it('should expire a key after the specified time', async () => {
      vi.useFakeTimers();

      const key = 'test-key-expiry';
      const value = 'i will disappear';
      const expiryInSeconds = 10;

      await service.setValue(key, value, expiryInSeconds);

      const resultBeforeExpiry = await service.getValue(key);
      expect(resultBeforeExpiry).toBe(value);

      await vi.advanceTimersByTimeAsync(11 * 1000);

      const resultAfterExpiry = await service.getValue(key);
      expect(resultAfterExpiry).toBeNull();

      vi.useRealTimers();
    });
  });
});
