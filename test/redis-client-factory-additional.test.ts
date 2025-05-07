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

describe('Redis Client Factory Additional Tests', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should handle undefined REDIS_URL', async () => {
    process.env.REDIS_PORT = '6379';
    delete process.env.REDIS_URL;
    
    const client = await buildRedisClient();
    
    expect(client).toBeDefined();
    expect(Redis).toHaveBeenCalledTimes(1);
    expect(Redis).toHaveBeenCalledWith({
      host: undefined,
      port: 6379
    });
  });

  it('should handle invalid REDIS_PORT format', async () => {
    process.env.REDIS_URL = 'test-redis-url';
    process.env.REDIS_PORT = 'not-a-number';
    
    const client = await buildRedisClient();
    
    expect(client).toBeDefined();
    expect(Redis).toHaveBeenCalledTimes(1);
    // When parseInt fails on 'not-a-number', it returns NaN
    const callArgs = Redis.mock.calls[0][0];
    expect(callArgs.host).toBe('test-redis-url');
    expect(isNaN(callArgs.port)).toBe(true);
  });
});
