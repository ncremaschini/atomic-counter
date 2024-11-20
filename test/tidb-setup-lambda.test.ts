import * as TiDbClientFactory from '../lib/lambda/tiDB/clientFactory/tiDbClientFactory';

import { Connection } from "mysql2/promise";
import { handler as setupHandler } from '../lib/lambda/tiDB/setupLambda';

describe('handler', () => {
    const OLD_ENV = process.env;

    const executeMock = jest.fn();
    const endConnectionMock = jest.fn();

    const createConnectionMock = {
        execute: executeMock,
        end: endConnectionMock
    }  as unknown as Promise<Connection>;

   
    beforeAll(async () => {

    })

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        
        executeMock.mockReset();
        endConnectionMock.mockReset();
    
        jest.spyOn(TiDbClientFactory, 'createDbConnection').mockResolvedValueOnce(createConnectionMock);

        endConnectionMock.mockResolvedValueOnce({});

    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should return status code 200', async () => {
    
        const event = {};
        
        executeMock.mockResolvedValue([{}, {}]);

        const result = await setupHandler(event);

        expect(result.statusCode).toBe(200);
    });

    it('should return status code 500', async () => {

        const event = {};

        executeMock.mockRejectedValueOnce(new Error('error'));

        const result = await setupHandler(event);

        expect(result.statusCode).toBe(500);
    });
});