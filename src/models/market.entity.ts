// export class Market {}
import {
    Prop,
    Schema,
    SchemaFactory,
    DiscriminatorOptions,
    raw,
} from '@nestjs/mongoose';
import { Types, Schema as MongooseSchema, Document } from 'mongoose';
//   import { Document, Model, ObjectId, Mongoose } from 'mongoose';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { UserRole } from './_user.model';
import { Constants } from '../utils/constants';


export type MarketDocument = Market & Document;



@Schema({
    timestamps: true,
    toJSON: {
        getters: true,
        virtuals: true,
        transform: (_, doc: Record<string, unknown>) => {
            delete doc.__v;
            delete doc._id;
            return {
                ...doc,
            };
        },
    },
})
export class Market {

    id?: string;

    @Prop({ type: String })
    nameAr: string;

    @Prop({ type: String })
    nameEn: string;

}

const MarketSchema = SchemaFactory.createForClass(Market);



export { MarketSchema };
