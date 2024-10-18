import * as dynamoConditionalCheckError from './dynamoConditionalCheckFailed.json';
import * as dynamoUpdateSuccesConditionalWrites from './dynamoUpdateSuccesConditionalWrites.json';
import * as dynamoUpdateSuccessUnconditionalWrites from './dynamoUpdateSuccessUnconditionalWrites.json';

import { UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";
import { dynamoDBClient } from '../lib/lambda/dynamo/dynamoDbClient';
import { handler } from '../lib/lambda/dynamo/index';

jest.mock('../lib/lambda/dynamo/dynamoDbClient');

describe('handler', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        dynamoDBClient.send = jest.fn().mockReset();
    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = {
            ...OLD_ENV,
            TABLE_NAME: 'test-table',
        };
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };
        dynamoDBClient.send = jest.fn().mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 100, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        dynamoDBClient.send = jest.fn().mockResolvedValueOnce(dynamoUpdateSuccesConditionalWrites as UpdateItemCommandOutput);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 1, useConditionalWrites: true });
    });

    it('should return status code 409', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };
        dynamoDBClient.send = jest.fn().mockRejectedValueOnce(dynamoConditionalCheckError);

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
        dynamoDBClient.send = jest.fn().mockRejectedValueOnce(new Error('Internal server error'));

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error"
        });
    });
});