import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { UserType, UserTypeDocument } from './user-type.entity';
import { SupplierExtended, User, UserDocument, UserRole } from './_user.model';
import { Constants } from '../utils/constants';
import { Supplier } from './supplier.entity';

export type JoiningRequestHistoryDocument = JoiningRequestHistory & Document;

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
export class JoiningRequestHistory {
    id?: string;

    @Prop({
        get: (firstName: string) => {
            return firstName;
        },
        set: (firstName: string) => {
            return firstName.trim();
        },
        required: true,
    })
    firstName: string;

    @Prop({
        get: (lastName: string) => {
            return lastName;
        },
        set: (lastName: string) => {
            return lastName.trim();
        },
        required: true,
    })
    lastName: string;

    @Prop({
        index: true,
        match: Constants.PHONE_REGX,
    })
    phone: string;

    @Prop({
        type: String,
        required: false,
        default: undefined
    })
    whyRejected: string;
    @Prop({
        type: String,
        required: false,
    })
    comment: string;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: UserType.name,
        required: true,
    })
    userType: string | UserTypeDocument;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Governorate.name,
        required: true,
    })
    governorate: string | GovernorateDocument;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: District.name,
        required: true,
    })
    district: string | DistrictDocument;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
    })
    referal?: string | UserDocument;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
    })
    canceledBy?: string | UserDocument;

    @Prop({ type: Date, required: false })
    canceledAt: Date;

    @Prop({ type: Date, required: false })
    requestDate: Date;

    @Prop({ default: false, type: Boolean })
    isRefered?: boolean;

    @Prop(
        raw({
            _id: false,
            id: {
                type: MongooseSchema.Types.ObjectId,
                ref: Supplier.name,
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
        }),
    )
    supplier?: SupplierExtended;
}
const JoiningRequestHistorySchema = SchemaFactory.createForClass(JoiningRequestHistory);
export { JoiningRequestHistorySchema };
