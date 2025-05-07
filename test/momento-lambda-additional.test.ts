import * as MomentoClientFactory from '../lib/lambda/momento/momentoClientFactory';

import { CacheClient, CacheGetResponse, CacheIncrementResponse, CacheSetIfAbsentResponse, CacheSetIfPresentAndNotEqualResponse } from '@gomomento/sdk';

import { handler } from '../lib/lambda/momento';

describe('handler additional tests', () => {
    const OLD_ENV = process.env;

    const incrementMock = jest.fn();
    const getMock = jest.fn();
    const setIfAbsentMock = jest.fn();
    const setIfPresentAndNotEqualMock = jest.fn();
    const pingMock = jest.fn();

    const buildMomentoClientMockValue = {
        increment: incrementMock,
        get: getMock,
        setIfAbsent: setIfAbsentMock,
        setIfPresentAndNotEqual: setIfPresentAndNotEqualMock,
        ping: pingMock 
    }  as unknown as Promise<CacheClient>;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        incrementMock.mockReset();
        getMock.mockReset();
        setIfAbsentMock.mockReset();
        setIfPresentAndNotEqualMock.mockReset();
        pingMock.mockReset();

        jest.spyOn(MomentoClientFactory, 'buildMomentoClient').mockResolvedValueOnce(buildMomentoClientMockValue);
    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should return status code 200 and create a new counter with conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            type: CacheGetResponse.Miss,
        } as unknown as CacheGetResponse);

        setIfAbsentMock.mockResolvedValueOnce({
            type: CacheSetIfAbsentResponse.Stored,
        } as unknown as CacheSetIfAbsentResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 1, useConditionalWrites: true });
    });

    it('should return status code 500 when increment operation fails', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };

        incrementMock.mockResolvedValueOnce({
            type: CacheIncrementResponse.Error,
            message: () => 'Increment operation failed'
        } as unknown as CacheIncrementResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should return status code 500 when get operation fails', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            type: CacheGetResponse.Error,
            toString: () => 'Get operation failed'
        } as unknown as CacheGetResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should return status code 500 when setIfPresentAndNotEqual operation fails', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            value(): number {
                return 4;
            },
            type: CacheGetResponse.Hit,
        } as unknown as CacheGetResponse);

        setIfPresentAndNotEqualMock.mockResolvedValueOnce({
            type: CacheSetIfPresentAndNotEqualResponse.Error,
            message: () => 'SetIfPresentAndNotEqual operation failed'
        } as unknown as CacheSetIfPresentAndNotEqualResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should return status code 500 when setIfAbsent operation fails', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            type: CacheGetResponse.Miss,
        } as unknown as CacheGetResponse);

        setIfAbsentMock.mockResolvedValueOnce({
            type: CacheSetIfAbsentResponse.Error,
            message: () => 'SetIfAbsent operation failed'
        } as unknown as CacheSetIfAbsentResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should use default values for environment variables', async () => {
        delete process.env.USE_CONDITIONAL_WRITES;
        delete process.env.MAX_COUNTER_VALUE;
        delete process.env.MOMENTO_CACHE_NAME;

        const event = { pathParameters: { id: '1' } };

        incrementMock.mockResolvedValueOnce({
            value(): number {
                return 101;
            },
            type: CacheIncrementResponse.Success,
        } as unknown as CacheIncrementResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 101, useConditionalWrites: false });
        expect(incrementMock).toHaveBeenCalledWith('cache', '1', 1);
    });
});
