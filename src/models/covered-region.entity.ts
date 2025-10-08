import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Document } from 'mongoose';
import { Governorate } from './governorate.entity';
import { District } from './district.entity';

export interface Segments {
    segment: string;
    isDefault: boolean;
}

export interface verticalType {
    vertical: string;
    jsonVersion: number;
    syncData: boolean;
}

export interface Region {
    governorate: Actions;
    districts: string;

}

export enum WalletType {
    POINTS = 'POINTS',
    CASH = 'CASH',
}

export enum Actions {
    PURCHASE = 'PURCHASE',
    SELLS = 'SELLS',
    USE = 'USE',
}

export enum QrCodeType {
    INNER = 'INNER',
    OUTER = 'OUTER',
    ORDER = 'ORDER',
    PACKAGE = 'PACKAGE',
    PALLET = 'PALLET',
    QUANTIFIED = 'QUANTIFIED',
}

export type CoveredRegionDocument = CoveredRegion & Document;

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
export class CoveredRegion {
    id?: string;

    @Prop({ type: String })
    name: string;
    @Prop(
        raw([
            {
                _id: false,
                governorate: {
                    type: MongooseSchema.Types.ObjectId,
                    ref: Governorate.name,
                    required: false,
                },
                districts: [
                    {
                        type: MongooseSchema.Types.ObjectId,
                        ref: District.name,
                        required: false,
                        // autopopulate: true,
                    },
                ]

            },
        ]),
    )
    region: Region[];
}

const CoveredRegionSchema = SchemaFactory.createForClass(CoveredRegion);

export { CoveredRegionSchema };
