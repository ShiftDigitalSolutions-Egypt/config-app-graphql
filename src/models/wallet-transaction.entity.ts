import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { QrCode, QrCodeDocument } from './qr-code.entity';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';

import { User, UserDocument } from './_user.model';

export type WalletTransactionDocument = WalletTransaction & Document;

export enum SubjectType {
  USERS = 'users',
  USERGIFT = 'usergifts',
  QRCODES = 'QrCode',
  QRCODESOld = 'qrcodes',
  SCANS = 'scans',
  ENDOFMONTHLOGS = 'endofmonths',
  CLIENTREQUEST = 'clientrequests',
  MARKETPLACE_ORDERS = 'MarketPlaceOrder',
  MARKETPLACE_CASHBACK = 'MarketPlaceCashback',
  DEDUCTION = 'deduction',
  REFUND = 'refund',
  WELCOMEBONUS = 'QrCode',
  VOUCHERSQRCODES = 'vouchersqrcodes',
  PAYMENTS = 'PaymentLog',
}

export enum TransactionType {
  SCANIN = 'SCANIN',
  SCANOUT = 'SCANOUT',
  SCANUSE = 'SCANUSE',
  REFERING = 'REFERING',
  GIFTS = 'GIFTS',
  CASHINCENTIVE = 'CASHINCENTIVE',
  ENDOFMONTH = 'ENDOFMONTH',
  REWARD = 'REWARD',
  CASHINCENTIVEWALA = 'CASHINCENTIVEWALA',
  TRAANSFERINCENTIVE = 'TRAANSFERINCENTIVE',
  DEDUCT = 'deduct',
  REFUND = 'refund',
  CASHBACK = 'cashback',
  WELCOMEBONUS = 'WELCOMEBONUS',
  RECIEVETRANSFEREDINCENTIVE = 'RECIEVETRANSFEREDINCENTIVE',
  TRANSFEREBALANCE = 'TRANSFEREBALANCE',
  TRANSFERCASH = 'TRANSFERCASH',
  RECIEVETRANSFEREDCASH = 'RECIEVETRANSFEREDCASH',
  CONTINUITYINCENTIVE = 'CONTINUITYINCENTIVE',
  EXTRAINCENTIVE = 'EXTRAINCENTIVE',
  DEDUCTIONINCENTIVE = 'DEDUCTIONINCENTIVE',
  SPECIALBONUS = 'SPECIALBONUS',
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
export class WalletTransaction {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: true,
  })
  user?: string | UserDocument | ObjectId;

  @Prop({ type: Number, required: true })
  value?: number;

  @Prop({ type: Number, required: true })
  balanceBefore?: number;

  @Prop({ type: Number, required: true })
  balanceAfter?: number;

  @Prop({ required: true, type: String, enum: Object.values(SubjectType) })
  subjectType?: SubjectType;

  @Prop({ required: true, type: String, enum: Object.values(TransactionType) })
  transactionType?: TransactionType;

  @Prop({ type: MongooseSchema.Types.ObjectId, refPath: 'subjectType', required: true /*autopopulate: true */ })
  subject?: string | QrCodeDocument | ObjectId;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Boolean, default: false })
  disableIncentive?: boolean;

  @Prop({ type: String })
  referenceNumber?: string;

  @Prop({ type: Boolean })
  isHoldedForKafka?: boolean;
}
const WalletTransactionSchema = SchemaFactory.createForClass(WalletTransaction);
WalletTransactionSchema.index({ user: 1, subjectType: 1, subject: 1 }); //compound index
export { WalletTransactionSchema };
``;
