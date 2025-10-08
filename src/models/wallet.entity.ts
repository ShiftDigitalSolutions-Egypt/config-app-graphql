import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { WalletType } from './covered-region.entity';
import { QrCode } from './qr-code.entity';
import { UserDocument } from './_user.model';

export type WalletDocument = Wallet & Document;

export enum SubjectType {
  USERS = 'users',
  USERGIFT = 'usergifts',
  SCANS = 'scans',
  QRCODES = 'QrCode',
  WELCOMEBONUS = 'QrCode',
  PAYMENTS = 'PaymentLog',
}

export enum TransactionType {
  SCANIN = 'SCANIN',
  SCANOUT = 'SCANOUT',
  SCANUSE = 'SCANUSE',
  REFERING = 'REFERING',
  GIFTS = 'GIFTS',
  CASHINCENTIVE = 'CASHINCENTIVE',
  REWARD = 'REWARD',
  ENDOFMONTH = 'ENDOFMONTH',
  DEDUCTIONINCENTIVE = 'DEDUCTIONINCENTIVE',
  PAYMENTTRANSFERPAYMOBWALLET = 'PAYMENTTRANSFERPAYMOB_WALLET',
  PAYMENTTRANSFERPAYMOBBANK = 'PAYMENTTRANSFERPAYMOB_BANK',
  PAYMENTTRANSFERPAYMOBBANKWALLET = 'PAYMENTTRANSFERPAYMOB_BANKWALLET',
  PAYMENTTRANSFERPAYMOBFIALED = 'PAYMENTTRANSFERPAYMOBFIALED',
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
      return {
        ...doc,
      };
    },
  },
})
export class Wallet {
  id?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    // ref: User?.name,
    required: true,
  })
  user: string | UserDocument;

  @Prop({ required: true, type: String, enum: Object.values(WalletType) })
  type: TransactionType;
}
const WalletSchema = SchemaFactory.createForClass(Wallet);
export { WalletSchema };
