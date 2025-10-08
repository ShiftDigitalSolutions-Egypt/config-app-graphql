import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { ProductType } from './product-type.entity';
import { Property } from './property.entity';
import { PropertyValue } from './property-value.entity';
import { Supplier } from './supplier.entity';
import { Vertical } from './vertical.entity';
import { User, UserDocument } from './_user.model';
import { Gift, GiftDocument } from './gift.entity';
import { Wheel, WheelDocument } from './wheel.entity';

export type VouchersQrcodeDocument = VouchersQrcode & Document;

export enum VoucherType {
    CASH = 'CASH',
    POINTS = 'POINTS',
    GIFTS = 'GIFTS',
    WHEEL = 'WHEEL',
}

export enum VoucherTransactionType {
    WELCOMEBONUS = 'WELCOMEBONUS',
    CONTINUITYINCENTIVE = 'CONTINUITYINCENTIVE',
    EXTRAINCENTIVE = 'EXTRAINCENTIVE',
    SPECIALBONUS = 'SPECIALBONUS'
}

export interface ObjectExtended {
    name: string;
    id: string;
}

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
export class VouchersQrcode {
    id?: string;

    @Prop({ type: Number })
    patchId: number;

    @Prop({ type: String })
    patchName: string;

    @Prop({ type: String })
    nameEn: string;

    @Prop({ type: String })
    nameAr: string;

    @Prop({ type: String })
    dialogAr: string;

    @Prop({ type: String })
    dialogEn: string;

    @Prop({ type: Number })
    value: number;

    @Prop({ type: Boolean, default: true, required: false })//todo if we need to desable voucher 
    enabled: boolean;

    @Prop({ type: Boolean, default: false, required: false })//todo if we need to desable voucher 
    isUsed: boolean;

    @Prop({ enum: VoucherType, default: VoucherType.CASH })
    type: VoucherType;

    @Prop({ enum: VoucherTransactionType, default: VoucherTransactionType.EXTRAINCENTIVE })
    transactionType: VoucherTransactionType;

    @Prop({ type: Boolean, default: true, required: false })
    forManySupplier: boolean;

    @Prop({ type: Boolean, default: true, required: false })
    fixedForUserType: boolean; // if true that's mean this vouchers for one or many userTypes else this voucher for all usertype under on or many supplier 

    @Prop({ type: Boolean, default: true, required: false })//
    forManyUserType: boolean;
    
    @Prop({ type: Date, })
    startDate: Date;
  
    @Prop({ type: Date, })
    expirationDate: Date;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Gift.name,
        required: false,
    })
    gift: string | GiftDocument;

    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: Wheel.name,
        required: false,
    })
    wheel: string | WheelDocument;
    @Prop(
        raw([
            {
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
            }
        ]),
    )
    suppliers: ObjectExtended[];
    @Prop(
        raw([
            {
                _id: false,
                id: {
                    type: MongooseSchema.Types.ObjectId,
                    ref: Supplier.name,
                    required: false,
                },
                name: {
                    type: String,
                    required: false,
                },
            }
        ]),
    )
    userTypes: ObjectExtended[];
    @Prop({
        type: MongooseSchema.Types.ObjectId,
        ref: User.name,
        required: false,
    })
    scannedBy: string | UserDocument;

    @Prop({ type: Date, })
    scannedAt: Date;
}

export const VouchersQrcodeSchema = SchemaFactory.createForClass(VouchersQrcode);
