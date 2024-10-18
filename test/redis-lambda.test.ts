import { handler } from '../lib/lambda/redis/index';
import { redisClient } from '../lib/lambda/redis/redisClient';

jest.mock('../lib/lambda/redis/redisClient');


describe('handler', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        redisClient.eval = jest.fn().mockReset();
    });

    afterAll(async() => {        
        process.env = {
            ...OLD_ENV,
            REDIS_URL: 'localhost',
            REDIS_PORT: '0000',
        };

        redisClient.disconnect();
        jest.restoreAllMocks();
        
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };
        redisClient.eval = jest.fn().mockResolvedValueOnce("100");

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 100, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        redisClient.eval = jest.fn().mockResolvedValueOnce("5");

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5, useConditionalWrites: true });
    });

    it('should return status code 409', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        redisClient.eval = jest.fn().mockResolvedValueOnce('Counter has reached its maximum value of: 10');

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
        redisClient.eval = jest.fn().mockRejectedValueOnce(new Error('Internal server error'));

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error"
        });
    });
});
