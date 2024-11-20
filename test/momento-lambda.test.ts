import * as MomentoClientFactory from '../lib/lambda/momento/momentoClientFactory';

import { CacheClient, CacheGetResponse, CacheIncrementResponse, CacheSetIfAbsentResponse, CacheSetIfPresentAndNotEqualResponse } from '@gomomento/sdk';

import { handler } from '../lib/lambda/momento';

describe('handler', () => {
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

    beforeAll(async () => {

    })

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

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

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
    });

    it('should return status code 200 and the updated counter with conditional writes and existing counter', async () => {
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
            type: CacheSetIfPresentAndNotEqualResponse.Stored,
            value(): number {
                return 6;
            }
        } as unknown as CacheSetIfPresentAndNotEqualResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5, useConditionalWrites: true });
    });

    it('should return status code 409 for max counter valued reached', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            value(): number {
                return 10;
            },
            type: CacheGetResponse.Hit,
        } as unknown as CacheGetResponse);

        setIfPresentAndNotEqualMock.mockResolvedValueOnce({
            type: CacheSetIfPresentAndNotEqualResponse.NotStored,
        } as unknown as CacheSetIfPresentAndNotEqualResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({
            error: "Counter has reached its maximum value of: " + process.env.MAX_COUNTER_VALUE,
            useConditionalWrites: true
        });
    });

    it('should return status code 409 for conditional race found', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        getMock.mockResolvedValueOnce({
            value(): number {
                return 10;
            },
            type: CacheGetResponse.Miss,
        } as unknown as CacheGetResponse);

        setIfAbsentMock.mockResolvedValueOnce({
            type: CacheSetIfPresentAndNotEqualResponse.NotStored
        } as unknown as CacheSetIfAbsentResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({
            error: "Race conditions! Please try again",
            useConditionalWrites: true
        });
    });

    it('should return status code 500', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        incrementMock.mockRejectedValueOnce(new Error('Internal server error'));

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error",
        });
    });
});