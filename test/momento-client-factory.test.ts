import { CacheClient } from '@gomomento/sdk';
import { buildMomentoClient } from '../lib/lambda/momento/momentoClientFactory';

jest.mock('@gomomento/sdk', () => {
  return {
    CacheClient: {
      create: jest.fn().mockResolvedValue({})
    }
  };
});

describe('Momento Client Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a Momento client', async () => {
    const client = await buildMomentoClient();
    
    expect(client).toBeDefined();
    expect(CacheClient.create).toHaveBeenCalledTimes(1);
    expect(CacheClient.create).toHaveBeenCalledWith({
      eagerConnectTimeout: 1000,
      defaultTtlSeconds: 86400
    });
  });
});
