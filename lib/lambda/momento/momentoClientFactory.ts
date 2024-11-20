import { CacheClient } from '@gomomento/sdk';

export const buildMomentoClient = async () : Promise<CacheClient> =>{
	return CacheClient.create({eagerConnectTimeout: 1000, defaultTtlSeconds: 86400 });
}

