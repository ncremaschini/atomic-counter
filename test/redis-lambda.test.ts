import * as RedisClientFactory from '../lib/lambda/redis/redisClientFactory';

import Redis from 'ioredis';
import { handler } from '../lib/lambda/redis';

describe('handler', () => {
    const OLD_ENV = process.env;

    const evalMock = jest.fn();
    const buildRedisClientMockValue = {
        eval: evalMock
    }  as unknown as Promise<Redis>;
    
    beforeAll(async () => {
    
    })
    
    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        evalMock.mockReset();
        jest.spyOn(RedisClientFactory, 'buildRedisClient').mockResolvedValueOnce(buildRedisClientMockValue);
        
        process.env = {
            ...OLD_ENV,
            REDIS_URL: 'localhost',
            REDIS_PORT: '0000',
        };
    });

    afterAll(async() => {        
        process.env = {
            ...OLD_ENV
        };
        jest.restoreAllMocks();
        
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };
        evalMock.mockResolvedValueOnce("100");
        
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 100, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
    
        evalMock.mockResolvedValueOnce("5");
        
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5, useConditionalWrites: true });
    });

    it('should return status code 409', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        evalMock.mockResolvedValueOnce('Counter has reached its maximum value of: 10');
        
        const result = await handler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({
            error: "Counter has reached its maximum value of: 10",
            useConditionalWrites: true,
        });
    });

    it('should return status code 500', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        evalMock.mockRejectedValueOnce(new Error('Internal server error'));
        
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error"
        });
    });
});
