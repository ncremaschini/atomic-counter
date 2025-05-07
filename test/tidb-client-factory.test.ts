import { createConnection } from 'mysql2/promise';
import { createDbConnection } from '../lib/lambda/tiDB/clientFactory/tiDbClientFactory';

jest.mock('mysql2/promise', () => {
  return {
    createConnection: jest.fn().mockResolvedValue({})
  };
});

describe('TiDB Client Factory', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
    process.env.TIDB_HOST = 'test-tidb-host';
    process.env.TIDB_PORT = '4001';
    process.env.TIDB_USER = 'test-user';
    process.env.TIDB_PASSWORD = 'test-password';
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should create a TiDB connection with environment variables', async () => {
    const dbName = 'test-db';
    const connection = await createDbConnection(dbName);
    
    expect(connection).toBeDefined();
    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(createConnection).toHaveBeenCalledWith({
      host: 'test-tidb-host',
      port: 4001,
      user: 'test-user',
      password: 'test-password',
      database: 'test-db',
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      namedPlaceholders: true
    });
  });

  it('should use default values if environment variables are not defined', async () => {
    delete process.env.TIDB_HOST;
    delete process.env.TIDB_PORT;
    delete process.env.TIDB_USER;
    delete process.env.TIDB_PASSWORD;
    
    const connection = await createDbConnection(null);
    
    expect(connection).toBeDefined();
    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(createConnection).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 4000,
      user: 'root',
      password: '',
      database: null,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      namedPlaceholders: true
    });
  });
});
