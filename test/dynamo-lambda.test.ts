import * as DynamoDBClientFactory from '../lib/lambda/dynamo/dynamoDbClientFactory';
import * as dynamoConditionalCheckError from './dynamoResponses/dynamoConditionalCheckFailed.json';
import * as dynamoUpdateSuccesConditionalWrites from './dynamoResponses/dynamoUpdateSuccesConditionalWrites.json';
import * as dynamoUpdateSuccessUnconditionalWrites from './dynamoResponses/dynamoUpdateSuccessUnconditionalWrites.json';

import { DynamoDBClient, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";

import { handler } from '../lib/lambda/dynamo';

describe('handler', () => {
    const OLD_ENV = process.env;

    const sendMock = jest.fn();

    const buildDynamoClientMockValue = {
        send: sendMock
    }  as unknown as Promise<DynamoDBClient>;
    
    beforeAll(async () => {
      
    })

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        sendMock.mockReset();

        jest.spyOn(DynamoDBClientFactory, 'buildDynamoDbClient').mockResolvedValueOnce(buildDynamoClientMockValue);
    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = {
            ...OLD_ENV
        };
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 100, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccesConditionalWrites as UpdateItemCommandOutput);
    
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 1, useConditionalWrites: true });
    });

    it('should return status code 409', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockRejectedValueOnce(dynamoConditionalCheckError);
    
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

        sendMock.mockRejectedValueOnce(new Error('Internal server error'));
    
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error"
        });
    });
});