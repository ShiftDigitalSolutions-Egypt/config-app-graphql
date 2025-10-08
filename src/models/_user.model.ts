import { UnprocessableEntityException } from '@nestjs/common';
import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import * as admin from 'firebase-admin';
import { Document, Model, Schema as MongooseSchema, ObjectId } from 'mongoose';
import { District, DistrictDocument } from './district.entity';
import { Governorate, GovernorateDocument } from './governorate.entity';
import { Track, TrackDocument } from './milestone.entity';
import { Permission } from './permission.entity';
import { ReferralModelName } from './referral-model.entity';
import { ReferralWheel } from './referral-wheel.model';
import { UserRoles, UserType, WalletType } from './user-type.entity';
import { Wallet, WalletDocument } from './wallet.entity';
import { Constants } from '../utils/constants';
import { Supplier } from './supplier.entity';
import { Password } from '../utils/Password';
import { ScanAction } from '../dto/create-scan.dto';
import { UserLocation, UserLocationSchema } from './user-location.schema';

export type UserDocument = User & Document;

export interface UserTypeInterFace {
  id: string;
  _id?: string;
  name: string;
  isSubProfile?: boolean;
}

export interface SegmentInterFace {
  id: string;
  name: string;
}

export interface PermissionsInterFace {
  id: string;
  permissionGroup: [string];
}

export interface WelcomeWheel {
  wheel: string;
  isPalyed: boolean;
}
export interface CoveredRegionInterFace {
  id: string;
  region: [];
}
// export interface CoveredRegionInterFace {
//   // id: string;
//   region: [];
// }

export interface ReferralModelType {
  name: ReferralModelName;
  percentagePerScan: number;
  referralPeriod: number;
  referralRewardValue: number;
  minConsumption: number;
}

export enum UserRole {
  ADMINS = 'ADMINS',
  OPERATION = 'OPERATION',
  USERS = 'USERS',
  FIELDFORCE = 'FIELDFORCE',
}

export enum ExcellType {
  MISSING = 'MISSING',
  REGULAR = 'REGULAR',
}

export enum EndOfMonthFilters {
  SEGMENT = 'SEGMENT',
  GOVERNORATE = 'GOVERNORATE',
  DISTRICT = 'DISTRICT',
  REGION = 'REGION',
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
export class User {
  id?: string;

  @Prop({ type: Number, unique: true })
  userId: number;

  @Prop({ required: false, type: String, enum: Object.values(UserRoles) })
  role: UserRoles;

  @Prop({ required: false, type: String, enum: Object.values(WalletType) })
  walletType: WalletType;

  @Prop({
    get: (firstName: string) => {
      return firstName.toUpperCase();
    },
    set: (firstName: string) => {
      return firstName.trim();
    },
    required: true,
  })
  firstName: string;

  @Prop({
    get: (lastName: string) => {
      return lastName.toUpperCase();
    },
    set: (lastName: string) => {
      return lastName.trim();
    },
    required: true,
  })
  lastName: string;

  @Prop({ type: String })
  entityName: string;

  @Prop({ type: String })
  currentVersion: string;

  @Prop({ type: String, required: false })
  shopName: string;

  @Prop({ required: false })
  coordinates: number[];

  @Prop({
    type: UserLocationSchema, // Reference the sub-schema here
    required: false, // Optional sub-document
  })
  location?: UserLocation;

  @Prop({ type: String })
  ssid: string;

  @Prop({ type: Date })
  lastAccess: Date;

  @Prop({ type: Date })
  notification: Date;

  @Prop({ type: Number, default: 0 })
  totalmoney: number;

  @Prop({ type: Number, default: 0 })
  holdBalance: number;

  @Prop({ type: Number, default: 0 })
  totalpoints: number;

  @Prop({ type: Number, default: 0 })
  numberOfWheels: number;

  @Prop({ type: String })
  password: string;

  @Prop({ type: Number, default: 0 })
  parentLevel: number;

  @Prop({ type: Number, default: 0 })
  level: number;

  @Prop({ type: String, required: false })
  firebaseId?: string;

  // this for susbend user
  @Prop({ type: String, required: false })
  holdComment?: string;

  @Prop({
    index: true,
    match: Constants.PHONE_REGX,
  })
  phone: string;

  @Prop({ type: Date, default: Date.now() })
  registrationdate: Date;

  // this for susbend user
  @Prop({ default: false, type: Boolean }) // tofo using  in joining request
  enabled: boolean;

  // this for susbend user
  @Prop({ default: false, type: Boolean }) // todo using for blocking user like  joining request
  isBlocked: boolean;

  // this for susbend user
  @Prop({ default: false, type: Boolean, required: false }) // todo using for soft delete  user or change account
  isRequestedToChange: boolean;

  @Prop({ default: false, type: Boolean, required: false }) // todo using for soft delete  user or change account
  verifiedAccount?: boolean;


  // todo for change accounts
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
    default: null
  })
  verifiedBy: string | UserDocument;



  // todo for change accounts
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: UserType.name,
    required: false,
  })
  newUserType: UserTypeInterFace;

  @Prop({ type: String, required: false })
  shopImage: string;

  @Prop({ type: String, required: false })
  photo: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Governorate.name,
    required: false,
  })
  governorate: string | GovernorateDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    // required: false,
    default: null,

  })
  oldAccount: string | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    default: null,
  })
  blockedBy: null | string;

  @Prop({ type: Date, required: false })
  blockedAt?: Date;


  @Prop({ type: Date, required: false })
  verifiedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: District.name,
    required: false,
  })
  district: string | DistrictDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    default: null,
    // required: true,
  })
  referal?: ObjectId | UserDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    default: null,
    // required: true,
  })
  parentProfile?: string | UserDocument;

  @Prop({ default: false, type: Boolean })
  isRefered?: boolean;

  @Prop({ default: true, type: Boolean, })
  isFirstLogin?: boolean;


  @Prop(
    // [{ type: String, required: false }]

    raw({
      _id: false,
      id: {
        type: MongooseSchema.Types.ObjectId,
        ref: Permission.name,
        required: false,
      },
      permissionGroup: [{ type: String, required: false }],
    }),
  )
  permissions?: PermissionsInterFace;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Track.name,
    default: null,
  })
  milestone?: string | TrackDocument;

  @Prop(
    raw({
      _id: false,
      wheel: {
        type: MongooseSchema.Types.ObjectId,
        ref: ReferralWheel.name,
        required: false,
      },
      isPalyed: {
        type: Boolean,
        required: false,
        default: false,
      },
    }),
  )
  welcomeWheel: WelcomeWheel;

  @Prop(
    raw([
      {
        _id: false,
        governorate: {
          id: {
            type: MongooseSchema.Types.ObjectId,
            ref: Governorate.name,
            required: false,
          },
          name: { type: String },
        },
        districts: [
          {
            _id: false,
            id: {
              type: MongooseSchema.Types.ObjectId,
              ref: District.name,
              required: false,
              // autopopulate: true,
            },
            name: { type: String },
          },
        ],
      },
    ]),
  )
  coveredRegion: Region[];

  @Prop(
    raw({
      _id: false,
      name: {
        required: false,
        type: String,
        enum: Object.values(ReferralModelName),
        default: ReferralModelName.ONETIME,
      },
      percentagePerScan: {
        type: Number,
        required: false,
        default: 0,
      },

      referralPeriod: {
        type: Number,
        required: false,
        default: 0,
      },

      referralRewardValue: {
        type: Number,
        required: false,
        default: 0,
      },

      minConsumption: {
        type: Number,
        required: false,
        default: 0,
      },
    }),
  )
  referalModelType: ReferralModelType;

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
  userType: UserTypeInterFace;

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

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Wallet.name,
    required: false,
  })
  walletCash: string | WalletDocument;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: Wallet.name,
    required: false,
  })
  walletPoint: string | WalletDocument;

  @Prop(
    raw([
      {
        _id: false,
        deviceType: {
          type: String,
          enum: ['android', 'ios', 'web'],
          required: true,
        },
        deviceToken: {
          type: String,
          required: true,
        },
      },
    ]),
  )
  pushTokens: PushToken[];

  @Prop({ type: Number, default: 0 })
  wheelPoints: number;

  @Prop({ type: Boolean, default: true })
  referralStatus: boolean;

  @Prop({ type: String, required: false })
  whyRejected: string;

  @Prop({ type: String, required: false })
  whyDesabled: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
    required: false,
  })
  createdBy: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: String, required: false })
  userHoldComment: string;

  @Prop({ type: String, required: false })
  userHoldMessage: string;

  @Prop(
    raw({
      scanAction: { type: String, required: false, enum: Object.values(ScanAction) },
      date: { type: Date, required: false },
    }),
  )
  scanDetailsForFirstTransaction?: IScanDetailsForFirstTransaction;

  @Prop({ default: false, type: Boolean, })
  isNewLoginAfterLogout?: boolean;

  @Prop({ type: String, required: false })
  activeLanguage?: string;
}

const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
  const user = this;

  const nullableFields = ['phone'];
  for (let i = 0; i < nullableFields.length; i++) {
    if (user.isModified(nullableFields[i])) {
      const value = user[nullableFields[i]];
      if (value === '' || value === null) user[nullableFields[i]] = undefined;
    }
  }

  const uniqueFields = ['apple_id', 'fb_id', 'email'];
  for (let i = 0; i < uniqueFields.length; i++) {
    if (user.isModified(uniqueFields[i])) {
      // be true if was undefined then set value to it , be false if same value set to it
      const value = user[uniqueFields[i]];
      if (value === undefined) continue;
      const filter = {};
      filter[uniqueFields[i]] = value;
      const model = <Model<User>>this.constructor;
      const count = await model.countDocuments(filter);
      if (count) {
        throw new UnprocessableEntityException(`${uniqueFields[i]} : ${value} is not a uniqu value`);
      }
    }
  }
});

// //Notificiation
// UserSchema.methods.sendNotification = async function (message) {
//   const user = this;
//   let changed = false;
//   let len = user['pushTokens'].length;

//   console.log('user =============== inbside user modules')
//   console.log(user)
//   console.log('user =============== inbside user push token ')

//   console.log(user['pushTokens'][len].deviceToken)
//   console.log('user =============== inbside user modules')
//   console.log(user['pushTokens'])
//   while (len--) {
//     const deviceToken = user['pushTokens'][len].deviceToken;

//     message.token = deviceToken;
//     try {
//       const notification = admin.app('notification');
//       await notification.messaging().send(message);
//     } catch (error) {
//       user['pushTokens'].splice(len, 1);
//       changed = true;
//     }
//   }

//   if (changed) await this.save();
// };

// working
// UserSchema.methods.sendNotification = async function (encodedMessage) {
//   const user = this;
//   let changed = false;
//   let len = user['pushTokens'].length;

//   console.log('user =============== inside user modules');
//   console.log(user.pushTokens);

//   // Exit if no push tokens exist
//   if (len === 0) {
//     console.log('No push tokens found');
//     return;
//   }

//   while (len--) {
//     const deviceToken = user['pushTokens'][len]?.deviceToken; // Safe access with ?.

//     console.log(`Sending notification to token: ${deviceToken}`);

//     // Check for a valid token
//     if (!deviceToken) {
//       console.log(`Invalid or missing deviceToken at index ${len}`);
//       continue;
//     }
//     console.log('encodedMessage from user schemaaaaaaaaa ================')
//     console.log(encodedMessage)
//     // Prepare the notification payload
//     const notificationPayload = {
//       token: deviceToken,
//       notification: {
//         title: encodedMessage.webpush.notification.titleAr ,//|| encodedMessage.notification.titleEn || 'Default Title',
//         body: encodedMessage.webpush.notification.bodyAr ,//|| encodedMessage.notification.bodyEn || 'Default Body',
//       },
//       data: {
//         ...encodedMessage.webpush.data, // Combine data from the webpush section
//         ...encodedMessage.android.data,   // Combine data from the android section
//         requireInteraction: encodedMessage.webpush.data.requireInteraction,
//         link: encodedMessage.webpush.fcmOptions.link,
//       },
//     };

//     try {
//       console.log('message================================')
//       console.log(notificationPayload)
//       const notification = admin.app('notification');
//       await notification.messaging().send(notificationPayload);
//     } catch (error) {
//       console.log('Failed to send message:', error.message);
//       user['pushTokens'].splice(len, 1); // Remove the invalid token
//       changed = true;
//     }
//   }

//   if (changed) {
//     await this.save();
//     console.log('User push tokens updated');
//   }
// };


UserSchema.methods.sendNotification = async function (encodedMessage) {
  const user = this;
  const tokens = user['pushTokens'].map(tokenObj => tokenObj.deviceToken).filter(Boolean);

  console.log('user =============== inside user modules');
  console.log(tokens);

  console.log(encodedMessage)
  // Exit if no push tokens exist
  if (tokens.length === 0) {
    console.log('No push tokens found');
    return;
  }

  const notificationPromises = tokens.map(async (deviceToken) => {
    const message = encodedMessage.webpush.notification;
    console.log('message from user schemaaaaaaaaa ================')
    console.log(message)
    const body = message.lang && message.lang == 'en'
    ? message.bodyEn || ''
    : message.bodyAr || '';
    const title = message.lang && message.lang == 'en'
    ? message.titleEn || ''
    : message.titleAr || '';
    // Prepare the notification payload
    const notificationPayload = {
      token: deviceToken,
      notification: {
        title: title || 'Default Title',
        body: body || 'Default Body',
      },
      data: {
        ...encodedMessage.webpush.data,
        requireInteraction: encodedMessage.webpush.data.requireInteraction,
        link: encodedMessage.webpush.fcmOptions.link,
      },
    };

    try {
      console.log(`Sending notification to token: ${deviceToken}`);
      console.log(notificationPayload)
      const notification = admin.app('notification');
      await notification.messaging().send(notificationPayload);
    } catch (error) {
      console.error(`Failed to send message to ${deviceToken}:`, error.message);
      return deviceToken; // Return the failed token
    }
  });

  // Process results
  const failedTokens = await Promise.all(notificationPromises);
  // Filter out undefined values (successful sends)
  const invalidTokens = failedTokens.filter(Boolean);

  if (invalidTokens.length > 0) {
    user['pushTokens'] = user['pushTokens'].filter(tokenObj => !invalidTokens.includes(tokenObj.deviceToken));
    await this.save();
    console.log('User push tokens updated:', invalidTokens);
  }
};





/*
  * returns true on correct password, false otherwise.
  * @param password password in plain text
*/
UserSchema.methods.isValidPassword = async function (password) {
  // return compare(password, (this as UserDocument).password);
  return Password.isCorrectPassword(password, (this as UserDocument).password);
};
// Add 2dsphere index for geospatial queries on the location field
UserSchema.index({ "location.coordinates": "2dsphere" });

export { UserSchema };
