import { buildRedisClient } from '../lib/lambda/redis/redisClientFactory';

// Mock the Redis constructor
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((options) => {
      return { options };
    })
  };
});

// Import after mocking
const Redis = require('ioredis').default;

describe('Redis Client Factory', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.REDIS_URL = 'test-redis-url';
    process.env.REDIS_PORT = '6380';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should create a Redis client with environment variables', async () => {
    const client = await buildRedisClient();
    
    expect(client).toBeDefined();
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith({
      host: 'test-redis-url',
      port: 6380
    });
  });

  it('should use default port if REDIS_PORT is not defined', async () => {
    delete process.env.REDIS_PORT;
    
    const client = await buildRedisClient();
    
    expect(client).toBeDefined();
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith({
      host: 'test-redis-url',
      port: 6379
    });
  });
});
