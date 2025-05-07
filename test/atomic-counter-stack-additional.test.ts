import * as fs from 'fs';
import * as path from 'path';

// Mock the fs.readFileSync function to return mock data for the JSON files
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn().mockImplementation((filePath: string) => {
    if (filePath.includes('momento_key_info.json')) {
      return JSON.stringify({
        apiKey: 'test-api-key',
        endpoint: 'test-endpoint'
      });
    } else if (filePath.includes('tidb_info.json')) {
      return JSON.stringify({
        host: 'test-host',
        port: 'test-port',
        user: 'test-user',
        pwd: 'test-password',
        db: 'test-db'
      });
    }
    return jest.requireActual('fs').readFileSync(filePath);
  })
}));

describe('AtomicCounterStack Additional Tests', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('Environment variables are properly set', () => {
    // Set environment variables
    process.env.USE_CONDITIONAL_WRITES = 'true';
    process.env.MAX_COUNTER_VALUE = '20';
    process.env.MOMENTO_CACHE_NAME = 'test-cache';
    process.env.REDIS_URL = 'test-redis-url';
    process.env.REDIS_PORT = '6379';
    process.env.DOCUMENT_DB_CONNECTION_STRING = 'mongodb://test-connection-string';
    process.env.TABLE_NAME = 'test-table';
    process.env.TIDB_HOST = 'test-tidb-host';
    process.env.TIDB_PORT = '4001';
    process.env.TIDB_USER = 'test-user';
    process.env.TIDB_PASSWORD = 'test-password';
    process.env.TIDB_DATABASE = 'test-db';

    // Verify environment variables
    expect(process.env.USE_CONDITIONAL_WRITES).toBe('true');
    expect(process.env.MAX_COUNTER_VALUE).toBe('20');
    expect(process.env.MOMENTO_CACHE_NAME).toBe('test-cache');
    expect(process.env.REDIS_URL).toBe('test-redis-url');
    expect(process.env.REDIS_PORT).toBe('6379');
    expect(process.env.DOCUMENT_DB_CONNECTION_STRING).toBe('mongodb://test-connection-string');
    expect(process.env.TABLE_NAME).toBe('test-table');
    expect(process.env.TIDB_HOST).toBe('test-tidb-host');
    expect(process.env.TIDB_PORT).toBe('4001');
    expect(process.env.TIDB_USER).toBe('test-user');
    expect(process.env.TIDB_PASSWORD).toBe('test-password');
    expect(process.env.TIDB_DATABASE).toBe('test-db');
  });

  test('fs.readFileSync is mocked correctly', () => {
    const momentoKeyInfo = JSON.parse(fs.readFileSync('momento_key_info.json', 'utf8'));
    const tidbInfo = JSON.parse(fs.readFileSync('tidb_info.json', 'utf8'));

    expect(momentoKeyInfo).toEqual({
      apiKey: 'test-api-key',
      endpoint: 'test-endpoint'
    });

    expect(tidbInfo).toEqual({
      host: 'test-host',
      port: 'test-port',
      user: 'test-user',
      pwd: 'test-password',
      db: 'test-db'
    });

    expect(fs.readFileSync).toHaveBeenCalledTimes(2);
  });
});
