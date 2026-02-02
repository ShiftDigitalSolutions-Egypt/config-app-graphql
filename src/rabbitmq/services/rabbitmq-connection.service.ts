import { Injectable, Logger, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import { 
  PACKAGE_UPDATE_EXCHANGE_NAMES,
  PACKAGE_UPDATE_QUEUE_NAMES,
  PACKAGE_UPDATE_ROUTING_KEYS
} from '../interfaces/package-update.interface';
import {
  QUEUE_NAMES,
  EXCHANGE_NAMES,
  ROUTING_KEYS
} from '../interfaces/qr-configuration.interface';
import { RabbitMQConfig } from '../config/rabbitmq.config';

@Injectable()
export class RabbitMQConnectionService implements OnModuleInit, OnApplicationShutdown {
  
  private readonly logger = new Logger(RabbitMQConnectionService.name);
  private connection: AmqpConnectionManager;
  private publisherChannel: ChannelWrapper;
  private consumerChannel: ChannelWrapper;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (!this.isInitialized) {
      return this.initialize();
    }
    this.logger.warn('RabbitMQ connection already initialized, skipping...');
    return Promise.resolve();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn('RabbitMQ already initialized, skipping...');
      return;
    }

    try {
      const rabbitmqUrl = this.configService.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
      
      this.logger.log(`Connecting to RabbitMQ at ${rabbitmqUrl}`);
      
      // Create connection with reconnection options
      this.connection = amqp.connect([rabbitmqUrl], {
        reconnectTimeInSeconds: 5,
        heartbeatIntervalInSeconds: 60, // Increase heartbeat interval for cloud service
        connectionOptions: {
          timeout: 10000, // 10 second timeout
        },
      });

      this.connection.on('connect', () => {
        this.logger.log('Successfully connected to RabbitMQ');
      });

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`Disconnected from RabbitMQ: ${err}`);
      });

      this.connection.on('connectFailed', (err) => {
        this.logger.error(`Failed to connect to RabbitMQ: ${err}`);
      });

      // Add error handler for the connection manager
      this.connection.on('error', (err) => {
        this.logger.error(`RabbitMQ connection error: ${err}`);
      });

      // Create publisher channel for sending messages
      this.publisherChannel = this.connection.createChannel({
        json: true,
        setup: async (channel: ConfirmChannel) => {
          try {
            await this.setupPublisherChannel(channel);
          } catch (error) {
            this.logger.error(`Failed to setup publisher channel: ${error.message}`);
            throw error;
          }
        },
      });

      // Create consumer channel for receiving messages
      this.consumerChannel = this.connection.createChannel({
        json: true,
        setup: async (channel: ConfirmChannel) => {
          try {
            await this.setupConsumerChannel(channel);
          } catch (error) {
            this.logger.error(`Failed to setup consumer channel: ${error.message}`);
            throw error;
          }
        },
      });

      this.isInitialized = true;
      this.logger.log('RabbitMQ channels created successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize RabbitMQ connection: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async setupPublisherChannel(channel: ConfirmChannel): Promise<void> {
    try {
      // Declare exchange for package update events
      await channel.assertExchange(PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE, 'topic', {
        durable: true,
        autoDelete: false,
      });
      // Declare exchange for QR configuration events
      await channel.assertExchange(EXCHANGE_NAMES.QR_CONFIGURATION, 'direct', {
        durable: true,
        autoDelete: false,
      });

      this.logger.log('Publisher channel setup completed');
    } catch (error) {
      this.logger.error(`Error setting up publisher channel: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async setupConsumerChannel(channel: ConfirmChannel): Promise<void> {
    try {
      this.logger.log('Setting up consumer channel...');

      // Declare exchange for package updates
      await channel.assertExchange(PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE, 'topic', {
        durable: true,
        autoDelete: false,
      });

      // Declare package update queues
      await channel.assertQueue(PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE, {
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: {
          'x-message-ttl': 1800000, // 30 minutes TTL for package updates
          'x-max-retries': 3,
          // Optional: Add dead letter exchange for failed messages
          // 'x-dead-letter-exchange': 'dlx.package.update',
        },
      });

      await channel.assertQueue(PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS, {
        durable: true,
        exclusive: false,
        autoDelete: false,
      });

      // Bind package update queues to exchange
      await channel.bindQueue(
        PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_REQUEST
      );

      await channel.bindQueue(
        PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS,
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_UPDATE_RESULT
      );

      // Bind package cycle routing keys to the same queue (different processing logic based on routing key)
      await channel.bindQueue(
        PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_REQUEST
      );

      await channel.bindQueue(
        PACKAGE_UPDATE_QUEUE_NAMES.PACKAGE_UPDATE_RESULTS,
        PACKAGE_UPDATE_EXCHANGE_NAMES.PACKAGE_UPDATE,
        PACKAGE_UPDATE_ROUTING_KEYS.PACKAGE_CYCLE_RESULT
      );

      // Declare exchange for QR configuration
      await channel.assertExchange(EXCHANGE_NAMES.QR_CONFIGURATION, 'direct', {
        durable: true,
        autoDelete: false,
      });

       // Declare QR configuration queues
      await channel.assertQueue(QUEUE_NAMES.QR_CONFIGURATION,  {
        durable: true,
        arguments: {
          'x-max-retries': 3,
          'x-message-ttl': 300000, // 5 minutes
        },
      });

      await channel.assertQueue(QUEUE_NAMES.QR_CONFIGURATION_RESULTS, {
        durable: true,
      });

      // Bind QR configuration queues to exchange
      await channel.bindQueue(
        QUEUE_NAMES.QR_CONFIGURATION,
        EXCHANGE_NAMES.QR_CONFIGURATION,
        ROUTING_KEYS.QR_CONFIGURE
      );
      await channel.bindQueue(
        QUEUE_NAMES.QR_CONFIGURATION_RESULTS,
        EXCHANGE_NAMES.QR_CONFIGURATION,
        ROUTING_KEYS.QR_CONFIGURE_RESULT
      );

      this.logger.log('Consumer channel setup completed');
    } catch (error) {
      this.logger.error(`Error setting up consumer channel: ${error.message}`, error.stack);
      throw error;
    }
  }

  getPublisherChannel(): ChannelWrapper {
    if (!this.publisherChannel) {
      throw new Error('Publisher channel not initialized. Call initialize() first.');
    }
    return this.publisherChannel;
  }

  getConsumerSession(): ChannelWrapper {
    if (!this.consumerChannel) {
      throw new Error('Consumer channel not initialized. Call initialize() first.');
    }
    return this.consumerChannel;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Shutting down RabbitMQ connection (signal: ${signal})`);
    
    try {
      if (this.publisherChannel) {
        await this.publisherChannel.close();
        this.logger.log('Publisher channel closed');
      }

      if (this.consumerChannel) {
        await this.consumerChannel.close();
        this.logger.log('Consumer channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        this.logger.log('RabbitMQ connection closed');
      }

      this.isInitialized = false;
    } catch (error) {
      this.logger.error(`Error during RabbitMQ shutdown: ${error.message}`, error.stack);
    } finally {
      this.isInitialized = false;
    }
  }

  
}