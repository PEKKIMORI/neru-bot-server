import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ICacheSystemService } from './cacheSystem.service.interface';
export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements ICacheSystemService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setValue<T>(key: string, value: T, time?: number): Promise<'OK'> {
    const stringValue = JSON.stringify(value);

    try {
      let result: string | null;

      if (time) {
        result = await this.redis.set(key, stringValue, 'EX', time);
      } else {
        result = await this.redis.set(key, stringValue);
      }

      if (result === 'OK') {
        return 'OK';
      } else {
        this.logger.error(
          `Redis SET command for key "${key}" did not return "OK".`,
        );
        throw new Error(`Failed to set cache for key: ${key}`);
      }
    } catch (error) {
      this.logger.error(`Error executing Redis SET for key "${key}":`, error);
      throw error;
    }
  }

  async getValue<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (data === null) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      this.logger.error(
        `Error getting or parsing value for key "${key}":`,
        error,
      );
      return null;
    }
  }
}
