#!/usr/bin/env node

import 'source-map-support/register';

import * as cdk from 'aws-cdk-lib';

import { AtomicCounterStack } from '../lib/atomic-counter-stack';

const app = new cdk.App();
const stack = new AtomicCounterStack(app, 'AtomicCounterStack', {});

cdk.Tags.of(stack).add('Service', 'atomic-counter');
