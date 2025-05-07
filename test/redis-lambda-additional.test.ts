import * as RedisClientFactory from '../lib/lambda/redis/redisClientFactory';

import Redis from 'ioredis';
import { handler } from '../lib/lambda/redis';

describe('Redis Lambda Additional Tests', () => {
    const OLD_ENV = process.env;

    const evalMock = jest.fn();
    const buildRedisClientMockValue = {
        eval: evalMock
    } as unknown as Promise<Redis>;
    
    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        evalMock.mockReset();
        jest.spyOn(RedisClientFactory, 'buildRedisClient').mockResolvedValueOnce(buildRedisClientMockValue);
        
        process.env = {
            ...OLD_ENV,
            REDIS_URL: 'localhost',
            REDIS_PORT: '6379',
        };
    });

    afterAll(() => {        
        process.env = OLD_ENV;
        jest.restoreAllMocks();
    });

    it('should use default MAX_COUNTER_VALUE when not provided', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        delete process.env.MAX_COUNTER_VALUE;

        const event = { pathParameters: { id: '1' } };
        evalMock.mockResolvedValueOnce("5");
        
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5, useConditionalWrites: true });
        expect(evalMock).toHaveBeenCalledWith(expect.any(String), 1, '1', '10');
    });

    it('should handle missing pathParameters', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = {}; // Missing pathParameters
        
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should handle missing id in pathParameters', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: {} }; // Missing id
        
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should use unconditional script when USE_CONDITIONAL_WRITES is false', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };
        evalMock.mockResolvedValueOnce("100");
        
        await handler(event);

        // Check that the unconditional script was used (doesn't contain maxValue)
        const scriptArg = evalMock.mock.calls[0][0];
        expect(scriptArg).not.toContain('maxValue');
        expect(scriptArg).toContain('INCR');
    });

    it('should use conditional script when USE_CONDITIONAL_WRITES is true', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '15';

        const event = { pathParameters: { id: '1' } };
        evalMock.mockResolvedValueOnce("5");
        
        await handler(event);

        // Check that the conditional script was used (contains maxValue)
        const scriptArg = evalMock.mock.calls[0][0];
        expect(scriptArg).toContain('maxValue');
        expect(scriptArg).toContain('ARGV[1]');
    });
});
