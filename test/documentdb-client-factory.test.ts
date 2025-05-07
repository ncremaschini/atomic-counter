import { MongoClient } from 'mongodb';
import { buildDocumentDbClient } from '../lib/lambda/documentDB/clientFactory/documentDbClientFactory';

jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn().mockImplementation(() => {
      return {};
    })
  };
});

describe('DocumentDB Client Factory', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.DOCUMENT_DB_CONNECTION_STRING = 'mongodb://test-connection-string';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should create a DocumentDB client with the connection string', async () => {
    const client = await buildDocumentDbClient();
    
    expect(client).toBeDefined();
    expect(MongoClient).toHaveBeenCalledTimes(1);
    expect(MongoClient).toHaveBeenCalledWith('mongodb://test-connection-string', {
      monitorCommands: true,
      authSource: 'admin',
      retryWrites: false
    });
  });

  it('should throw an error if connection string is not defined', async () => {
    delete process.env.DOCUMENT_DB_CONNECTION_STRING;
    
    await expect(buildDocumentDbClient()).rejects.toThrow('DOCUMENT_DB_CONNECTION_STRING is not defined');
  });
});
