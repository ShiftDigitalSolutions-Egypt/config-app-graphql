import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document, Model, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { UserRoles, UserType, WalletType } from './user-type.entity';
import { Constants } from '../utils/constants';
import { Supplier } from './supplier.entity';
import { ScanAction } from './scan.entity';
import { User, UserDocument } from './_user.model';

export type DeletedAccountDocument = DeletedAccount & Document;

export interface UserTypeInterFace {
    id: string;
    _id?: string;
    name: string;
    isSubProfile?: boolean;
}

export enum DeletedAccountStatus {
    PENDING = 'PENDING',
    REJECTED = 'REJECTED',
    ACCEPTED = 'ACCEPTED'
}

export interface SegmentInterFace {
    id: string;
    name: string;
}

export enum DeviceType {
    android = 'android',
    ios = 'ios',
    web = 'web',
}

export interface PushToken {
    deviceType: DeviceType;
    deviceToken: string;
}

export interface Region {
    governorate: string;
    districts: string;
}

export interface SupplierExtended {
    name: string;
    id: string;
}

export interface IScanDetailsForFirstTransaction {
    scanAction: ScanAction;
    date: Date;
}
@Schema({
    // plugin(autoIncrement.plugin, 'Book'),
    timestamps: true,
    toJSON: {
        getters: true,
        virtuals: true,
        transform: (_, doc: Record<string, unknown>) => {
            //prevent this fields from returning in a response
            delete doc.__v;
            delete doc._id;
            delete doc.password;
            return {
                ...doc,
            };
        },
    },
})
export class DeletedAccount {
    id?: string;

    @Prop({ type: Number,})
    userId: number;

    @Prop({ required: false, type: String, enum: Object.values(UserRoles) })
    role: UserRoles;

    @Prop({ required: false, type: String, enum: Object.values(WalletType) })
    walletType: WalletType;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        default: null,
        // required: true,
    })
    parentProfile?: string | UserDocument;

    @Prop({ type: Number, required:false})
    parentId: number;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        default: null,
        // required: true,
    })
    user?: string | UserDocument;


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
        // index: true,
        match: Constants.PHONE_REGX,
    })
    phone: string;
    
    @Prop({ required: false, type: String, enum: Object.values(DeletedAccountStatus) })
    status: DeletedAccountStatus;

    @Prop({ default: true, type: Boolean })
    isMainAccount: boolean;


    @Prop({ default: false, type: Boolean })
    hasSubAccounts: boolean;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Governorate.name,
        required: false,
    })
    governorate: string | GovernorateDocument;

    // this for susbend user
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        default: null,
        required:false
    })
    blockedBy: null | string; // will use it after applay the authentication in dashboard
 
    @Prop({
        type: String,
        default: 'Admin',
    })
    AdminAccount: null | string;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: District.name,
        required: false,
    })
    district: string | DistrictDocument;

    @Prop(
        raw({
            _id: false,
            id: {
                type: MongooseSchema.Types.ObjectId,
                ref: UserType.name,
                required: false,
            },
            name: {
                type: String,
                required: true,
            },
        }),
    )
    originalUserType: UserTypeInterFace;

    // @Prop(
    //     raw({
    //         _id: false,
    //         id: {
    //             type: MongooseSchema.Types.ObjectId,
    //             ref: UserType.name,
    //             required: false,
    //         },
    //         name: {
    //             type: String,
    //             required: false,
    //         },
    //     }),
    // )
    // newUserType: UserTypeInterFace;

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

    @Prop(
        raw({
            _id: false,
            id: {
                type: MongooseSchema.Types.ObjectId,
                ref: UserType.name,
                required: false,
            },
            name: {
                type: String,
                required: false,
            },
        }),
    )
    segment?: SegmentInterFace;   

    @Prop({ type: Number, default: 0 })
    totalPoints: number;
    
    @Prop({ type: Number, default: 0 })
    totalCash: number;

    @Prop({ type: Date, required: false })
    registrationdate: Date;

}

const DeletedAccountSchema = SchemaFactory.createForClass(DeletedAccount);

export { DeletedAccountSchema };
