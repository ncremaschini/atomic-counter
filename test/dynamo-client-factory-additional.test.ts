import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { buildDynamoDbClient } from '../lib/lambda/dynamo/dynamoDbClientFactory';

jest.mock('@aws-sdk/client-dynamodb', () => {
  return {
    DynamoDBClient: jest.fn().mockImplementation((options) => {
      return { options };
    })
  };
});

describe('DynamoDB Client Factory Additional Tests', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should create a DynamoDB client with default configuration', async () => {
    const client = await buildDynamoDbClient();
    
    expect(client).toBeDefined();
    expect(DynamoDBClient).toHaveBeenCalledTimes(1);
    expect(DynamoDBClient).toHaveBeenCalledWith({});
  });

  it('should create a DynamoDB client with environment variables', async () => {
    // Set AWS environment variables that might be used in a real scenario
    process.env.AWS_REGION = 'us-east-1';
    process.env.AWS_ENDPOINT = 'http://localhost:8000';
    
    // Note: The current implementation doesn't use these variables,
    // but this test is future-proofed in case the implementation changes
    const client = await buildDynamoDbClient();
    
    expect(client).toBeDefined();
    expect(DynamoDBClient).toHaveBeenCalledTimes(1);
    expect(DynamoDBClient).toHaveBeenCalledWith({});
  });
});
