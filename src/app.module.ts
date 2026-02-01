import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { join } from "path";
import { ChannelModule } from "./channel/channel.module";
import { ConfigurationModule } from "./configuration/configuration.module";
import { RabbitMQModule } from "./rabbitmq/rabbitmq.module";

@Module({
  imports: [
    // Global configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // MongoDB connection with async configuration
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>("MONGODB_URI"),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
      inject: [ConfigService],
    }),

    // GraphQL configuration with subscriptions
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), "schema.gql"),
        sortSchema: true,
        playground: configService.get<boolean>("GRAPHQL_PLAYGROUND"),
        introspection: true,
        subscriptions: {
          "graphql-ws": {
            // Keep connection alive with ping/pong
            connectionInitWaitTimeout: 30000,
            onConnect: (context) => {
              console.log("Client connected to subscription");
            },
            onDisconnect: (context) => {
              console.log("Client disconnected from subscription");
            },
          },
          "subscriptions-transport-ws": {
            keepAlive: 10000, // Send keep-alive every 10 seconds
            onConnect: (connectionParams) => {
              console.log("Client connected (legacy transport)");
              return true;
            },
          },
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
    RabbitMQModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
