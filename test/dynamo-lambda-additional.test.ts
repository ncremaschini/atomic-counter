import * as DynamoDBClientFactory from '../lib/lambda/dynamo/dynamoDbClientFactory';
import * as dynamoUpdateSuccessUnconditionalWrites from './dynamoResponses/dynamoUpdateSuccessUnconditionalWrites.json';

import { DynamoDBClient, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";

import { handler } from '../lib/lambda/dynamo';

describe('DynamoDB Lambda Additional Tests', () => {
    const OLD_ENV = process.env;

    const sendMock = jest.fn();

    const buildDynamoClientMockValue = {
        send: sendMock
    } as unknown as Promise<DynamoDBClient>;
    
    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        sendMock.mockReset();

        jest.spyOn(DynamoDBClientFactory, 'buildDynamoDbClient').mockResolvedValueOnce(buildDynamoClientMockValue);
        
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should use default MAX_COUNTER_VALUE when not provided', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        delete process.env.MAX_COUNTER_VALUE;
        process.env.TABLE_NAME = 'test-table';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        await handler(event);

        // Check that the default MAX_COUNTER_VALUE (10) was used
        const commandArg = sendMock.mock.calls[0][0];
        expect(commandArg.input.ExpressionAttributeValues[':max'].N).toBe('10');
    });

    it('should use custom MAX_COUNTER_VALUE when provided', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '25';
        process.env.TABLE_NAME = 'test-table';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        await handler(event);

        // Check that the custom MAX_COUNTER_VALUE (25) was used
        const commandArg = sendMock.mock.calls[0][0];
        expect(commandArg.input.ExpressionAttributeValues[':max'].N).toBe('25');
    });

    it('should handle missing pathParameters', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';
        process.env.TABLE_NAME = 'test-table';

        const event = {}; // Missing pathParameters
        
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should handle missing id in pathParameters', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';
        process.env.TABLE_NAME = 'test-table';

        const event = { pathParameters: {} }; // Missing id
        
        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });

    it('should use default TABLE_NAME when not provided', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';
        delete process.env.TABLE_NAME;

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        await handler(event);

        // Check that an empty string was used for TABLE_NAME
        const commandArg = sendMock.mock.calls[0][0];
        expect(commandArg.input.TableName).toBe('');
    });

    it('should use unconditional write params when USE_CONDITIONAL_WRITES is false', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';
        process.env.TABLE_NAME = 'test-table';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        await handler(event);

        // Check that unconditional write params were used (no ConditionExpression)
        const commandArg = sendMock.mock.calls[0][0];
        expect(commandArg.input.ConditionExpression).toBeUndefined();
    });

    it('should use conditional write params when USE_CONDITIONAL_WRITES is true', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';
        process.env.TABLE_NAME = 'test-table';

        const event = { pathParameters: { id: '1' } };

        sendMock.mockResolvedValueOnce(dynamoUpdateSuccessUnconditionalWrites as UpdateItemCommandOutput);
    
        await handler(event);

        // Check that conditional write params were used (has ConditionExpression)
        const commandArg = sendMock.mock.calls[0][0];
        expect(commandArg.input.ConditionExpression).toBeDefined();
        expect(commandArg.input.ConditionExpression).toContain('atomic_counter < :max');
    });
});
