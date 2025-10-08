import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Schema as MongooseSchema } from 'mongoose';

export type QaraServiceDocument = QaraService & Document;

@Schema({
    timestamps: true,
    toJSON: {
        getters: true,
        virtuals: true,
        transform: (_, doc: Record<string, unknown>) => {
            //prevent this fields from returning in a response
            delete doc.__v;
            delete doc._id;
            return {
                ...doc,
            };
        },
    },
})
export class QaraService {

    @Prop({ type: String, required: true })
    name: string;
}
export const QaraServiceSchema = SchemaFactory.createForClass(QaraService);