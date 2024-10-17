import * as dynamoConditionalCheckError from './dynamoConditionalCheckFailed.json';
import * as dynamoUpdateSuccess from './dynamoUpdateSuccess.json';

import { DynamoDBClient, UpdateItemCommand, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";

import { handler } from '../lib/lambda/dynamo/index';
import { mockClient } from 'aws-sdk-client-mock';

const mockDynamoDBClient = mockClient(DynamoDBClient);

describe('handler', () => {
    beforeAll(() => {
        process.env.TABLE_NAME = 'test-table';    
        process.env.MAX_COUNTER_VALUE = '10';
        process.env.AWS_REGION = 'us-west-2';
        process.env.AWS_ACCESS_KEY_ID = 'fakeAccessKeyId';
        process.env.AWS_SECRET_ACCESS_KEY = 'fakeSecretAccessKey';
    });

    beforeEach(() => {
        jest.resetModules();
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        mockDynamoDBClient.reset();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        const event = { pathParameters: { id: '1' } };
        
        mockDynamoDBClient.on(UpdateItemCommand).resolves(dynamoUpdateSuccess as UpdateItemCommandOutput);
        
        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5 });
    });
});