import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from 'path';

import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';

import { Construct } from 'constructs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class AtomicCounterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new cdk.aws_ec2.Vpc(this, "AtomicCounterVpc", {
      vpcName: "AtomicCounterVpc",
      maxAzs: 2,
      ipAddresses: cdk.aws_ec2.IpAddresses.cidr("10.0.0.0/23"),

      subnetConfiguration: [
        {
          name: "atc-public",
          subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
          cidrMask: 25,
          mapPublicIpOnLaunch: true,
          reserved: false,
        },
        {
          name: "atc-private",
          subnetType: cdk.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 25,
          reserved: false,
        },
      ],
      natGateways: 1,
      createInternetGateway: true,
    });

    // create a security group for the redis cluster
    const redisSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Redis cluster',
      securityGroupName: 'redis-sg',
    });

    //create a security group for the lambda function
   const lambdaSecurityGroup = new cdk.aws_ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Security group for Lambda function',
      securityGroupName: 'lambda-sg',
    });

    redisSecurityGroup.addIngressRule(lambdaSecurityGroup, cdk.aws_ec2.Port.tcp(6379), 'Allow inbound traffic on port 6379');
    
    // create a dynamodb table name atomic-counter with a primary key of 'id' and a numeric attribute 'counter''
    const table = new cdk.aws_dynamodb.Table(this, 'AtomicCounterTable', {
      tableName: 'atomic-counter',
      partitionKey: { name: 'id', type: cdk.aws_dynamodb.AttributeType.STRING },
      billingMode: cdk.aws_dynamodb.BillingMode.PROVISIONED,
      readCapacity: 10,
      writeCapacity: 10,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    //create a subnet group for the redis cluster
    const subnetGroup = new cdk.aws_elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      cacheSubnetGroupName: 'redis-subnet-group',
      subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // create a redis cluster with 1 shard and 1 replica inside the vpc
    const redis = new cdk.aws_elasticache.CfnCacheCluster(this, 'AtomicCounterRedis', {
      engine: 'redis',
      clusterName: 'atomic-counter-redis',
      numCacheNodes: 1,
      cacheNodeType: 'cache.t3.micro',
      cacheSubnetGroupName: subnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });
    redis.addDependency(subnetGroup);

    const nodeJsFunctionProps: NodejsFunctionProps = {
      memorySize: 512,
      runtime: Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(5),
    };

    //create a lambda functiiion that will increment the counter in the dynamodb table
    const dynamoLambda = new NodejsFunction(this, 'AtomicCounterDynamoLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'dynamo', 'index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterDynamoLambda',
      description: 'Function to increment counter in DynamoDB',
      handler: 'index.handler',
      environment: {
        TABLE_NAME: table.tableName,
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    // grant the lambda function read/write permissions to the dynamodb table
    table.grantReadWriteData(dynamoLambda);

    //create a lambda function that will increment the counter in the redis cluster
    const redisLambda = new NodejsFunction(this, 'AtomicCounterRedisLambda', {
      bundling: {
        minify: true,
      },
      entry: path.join(__dirname, 'lambda', 'redis', 'index.ts'),
      ...nodeJsFunctionProps,
      functionName: 'AtomicCounterRedisLambda',
      description: 'Function to increment counter in Redis',
      handler: 'index.handler',
      environment: {
        REDIS_URL: redis.attrRedisEndpointAddress,
        REDIS_PORT: redis.attrRedisEndpointPort
      },
      vpc: vpc,
      securityGroups: [lambdaSecurityGroup],
      logRetention: logs.RetentionDays.ONE_DAY,
    });

    const api = new cdk.aws_apigateway.RestApi(this, 'AtomicCounterApi', {
      restApiName: 'AtomicCounterApi',
      description: 'API for Atomic Counter increment on redis and dynamodb',
      defaultCorsPreflightOptions: {
        allowOrigins: cdk.aws_apigateway.Cors.ALL_ORIGINS,
        allowMethods: cdk.aws_apigateway.Cors.ALL_METHODS,
      },
      //add id path parameter to the api
      defaultMethodOptions: {
        requestParameters: {
          'method.request.path.id': true,
        },
      },
    });

    //create a request validator for the api to check id path parameter
    const requestValidator = new cdk.aws_apigateway.RequestValidator(this, 'AtomicCounterRequestValidator', {
      restApi: api,
      validateRequestBody: false,
      validateRequestParameters: true,
      requestValidatorName: 'validate-id-param',
    });

    const dynamoResource = api.root.addResource('dynamo');
    const dynamoIdResource = dynamoResource.addResource('{id}');
    const dynamoIntegration = new cdk.aws_apigateway.LambdaIntegration(dynamoLambda);
    dynamoResource.addMethod('POST', dynamoIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator,
    });
    
    dynamoIdResource.addMethod('POST', dynamoIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    const redisResource = api.root.addResource('redis');
    const redisIdResource = redisResource.addResource('{id}');
    const redisIntegration = new cdk.aws_apigateway.LambdaIntegration(redisLambda);
    
    redisResource.addMethod('POST', redisIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    });

    redisIdResource.addMethod('POST', redisIntegration, {
      apiKeyRequired: true,
      requestValidator: requestValidator
    })

    const plan = api.addUsagePlan('AtomicCounterUsagePlan', {
      name: 'AtomicCounterUsagePlan',
      throttle: { burstLimit: 500, rateLimit: 1000 },
      quota: { limit: 1000000, period: cdk.aws_apigateway.Period.DAY },
      apiStages: [{ api, stage: api.deploymentStage }],
    });

    //add an api key to the usage plan
    const key = api.addApiKey('AtomicCounterApiKey');
    plan.addApiKey(key);

    //print out the api key
    new cdk.CfnOutput(this, 'AtomicCounterApiKey', { value: key.keyId });

    new logs.MetricFilter(this, "DynamoLambdaMetricFilter", {
      logGroup: dynamoLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "DynamoAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

    new logs.MetricFilter(this, "RedisLambdaMetricFilter", {
      logGroup: redisLambda.logGroup,
      metricNamespace: "AtomicCounter",
      metricName: "RedisAtomicCounter",
      filterPattern: logs.FilterPattern.exists("$.counter"),
      metricValue: "$.counter",
      defaultValue: 0,
      unit: cloudwatch.Unit.COUNT,
    });

  }
}
