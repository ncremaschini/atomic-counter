import { DynamoDBClient, UpdateItemCommand, UpdateItemCommandOutput } from "@aws-sdk/client-dynamodb";

import { handler } from '../lib/lambda/dynamo/index';

// Ensure mDynamoDBClient is properly typed
const mDynamoDBClient = new DynamoDBClient({}) as jest.Mocked<DynamoDBClient>;

// Create a typed mock function for send
const mockSend = jest.fn().mockImplementation((command: UpdateItemCommand) => {
    return Promise.resolve({} as UpdateItemCommandOutput);
});

// Create a typed mocke function for reject
const mockReject = jest.fn().mockImplementation((error: Error) => {
    return Promise.reject(error);
});

// Assign the mock function to mDynamoDBClient.send
mDynamoDBClient.send = mockSend;

describe('handler', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });

    afterAll(() => {
        process.env = OLD_ENV;
    });

    it('should return status code 200 and the updated counter', async () => {
        const event = { pathParameters: { id: '1' } };
        
        const mockDynamoDBResponse: UpdateItemCommandOutput = {
            Attributes: { atomic_counter: { N: '5' } },
            $metadata: { httpStatusCode: 200, requestId: 'mockRequestId', extendedRequestId: 'mockExtendedRequestId', cfId: 'mockCfId', attempts: 1, totalRetryDelay: 0 }
        };
        
        mockSend.mockResolvedValueOnce(mockDynamoDBResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5 });
    });

    it('should return status code 409 when ConditionalCheckFailedException occurs', async () => {
        const event = { pathParameters: { id: '123' } };
        
        const dbError = new Error('ConditionalCheckFailedException');
        mockReject(dbError);

        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const result = await handler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({ error: "Counter has reached its maximum value of: 10" });
    });

    it('should return status code 500 for other errors', async () => {
        const event = { pathParameters: { id: '123' } };
        const dbError = new Error('Some other error');
        mockReject(dbError);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({ error: "Internal server error" });
    });
});