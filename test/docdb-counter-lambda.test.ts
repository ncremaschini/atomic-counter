import * as DocDbClientFactory from '../lib/lambda/documentDB/clientFactory/documentDbClientFactory';
import * as docDbUpdateOneFailure from './docDbResponses/docDbUpdateOnFailure.json';
import * as docDbUpdateOneSuccess from './docDbResponses/docDbUpdateOneSuccess.json';

import { MongoClient } from "mongodb";
import { handler as incrementerHandler } from '../lib/lambda/documentDB/counterLambda';

describe('handler', () => {
    const OLD_ENV = process.env;

    const connectMock = jest.fn();
    const updateOneMock = jest.fn();
    const findOneMock = jest.fn();

    const collectionMock = jest.fn().mockReturnValue({
        updateOne: updateOneMock,
        findOne: findOneMock
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
        updateOneMock.mockReset();
        findOneMock.mockReset();
        connectMock.mockReset();

        jest.spyOn(DocDbClientFactory, 'buildDocumentDbClient').mockResolvedValueOnce(buildDocDbClientMockValue);

        connectMock.mockResolvedValueOnce({});

    });

    afterAll(() => {
        jest.restoreAllMocks();
        process.env = OLD_ENV;
    });

    it('should return status code 200 and the updated counter without conditional writes', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'false';

        const event = { pathParameters: { id: '1' } };

        updateOneMock.mockResolvedValueOnce(docDbUpdateOneSuccess);

        findOneMock.mockResolvedValueOnce({
            atomic_counter: 101
        });

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 101, useConditionalWrites: false });
    });

    it('should return status code 200 and the updated counter with conditional writes and existing counter', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        updateOneMock.mockResolvedValueOnce(docDbUpdateOneSuccess);

        findOneMock.mockResolvedValueOnce({
            atomic_counter: 5
        });

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body)).toEqual({ counter: 5, useConditionalWrites: true });
    });

    it('should return status code 409 for max counter valued reached', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        updateOneMock.mockRejectedValueOnce(new Error('E11000 duplicate key error collection: counters index: counter_id_index'));

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(409);
        expect(JSON.parse(result.body)).toEqual({
            error: "Counter has reached its maximum value of: " + process.env.MAX_COUNTER_VALUE,
            useConditionalWrites: true
        });
    });

    it('should return status code 500 on update exception', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        updateOneMock.mockRejectedValueOnce(new Error('Internal server error'));

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error",
        });
    });

    it('should return status code 500 on no records upserted', async () => {
        process.env.USE_CONDITIONAL_WRITES = 'true';
        process.env.MAX_COUNTER_VALUE = '10';

        const event = { pathParameters: { id: '1' } };

        updateOneMock.mockResolvedValueOnce(docDbUpdateOneFailure);

        const result = await incrementerHandler(event);

        expect(result.statusCode).toBe(500);
        expect(JSON.parse(result.body)).toEqual({
            error: "Internal server error",
        });
    });
});