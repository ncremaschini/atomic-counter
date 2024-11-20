import * as DocDbClientFactory from '../lib/lambda/documentDB/clientFactory/documentDbClientFactory';

import { MongoClient } from "mongodb";
import { handler as setupHandler } from '../lib/lambda/documentDB/setupLambda';

describe('handler', () => {
    const OLD_ENV = process.env;

    const connectMock = jest.fn();
    const createIndexMock = jest.fn();

    const collectionMock = jest.fn().mockReturnValue({
        createIndex: createIndexMock,
    });

    const dbbMock = jest.fn().mockReturnValue({
        collection: collectionMock
    });

    const buildDocDbClientMockValue = {
        connect: connectMock,
        db: dbbMock,
    }  as unknown as Promise<MongoClient>;

    beforeAll(async () => {

    })

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
        jest.spyOn(console, 'error').mockImplementation(jest.fn());
        jest.spyOn(console, 'log').mockImplementation(jest.fn());
        createIndexMock.mockReset();
        connectMock.mockReset();

        jest.spyOn(DocDbClientFactory, 'buildDocumentDbClient').mockResolvedValueOnce(buildDocDbClientMockValue);

        connectMock.mockResolvedValueOnce({});

    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should return status code 200', async () => {

        const event = {};
        createIndexMock.mockResolvedValueOnce({

        });

        const result = await setupHandler(event);

        expect(result.statusCode).toBe(200);
    });

    
    it('should return status code 500', async () => {

        const event = { };

        createIndexMock.mockRejectedValueOnce(new Error("Internal server error"));

        const result = await setupHandler(event);

        expect(result.statusCode).toBe(500);
    });
});