import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ChannelModule } from './channel/channel.module';
import { ConfigurationModule } from './configuration/configuration.module';

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // MongoDB connection with async configuration
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),
    
    // GraphQL configuration with subscriptions
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'schema.gql'),
        sortSchema: true,
        playground: configService.get<boolean>('GRAPHQL_PLAYGROUND'),
        introspection: true,
        subscriptions: {
          'graphql-ws': true,
          'subscriptions-transport-ws': true,
        },
        context: ({ req, res, connection }) => {
          if (connection) {
            // For subscriptions
            return { req: connection.context };
          }
          // For queries and mutations
          return { req, res };
        },
      }),
      inject: [ConfigService],
    }),
    
    // Feature modules
    ChannelModule,
    ConfigurationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}