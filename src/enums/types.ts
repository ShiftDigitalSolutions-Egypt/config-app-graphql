import { UserDocument } from '../models/_user.model';
import { ProductData, QrCodeKind } from '../models/qr-code.entity';
import { QrCodeType } from '../models/covered-region.entity';
import { Actions, WalletType } from '../models/user-type.entity';
import { findOneIncentive } from '../utils/helperFuncs';
import { ScanAction } from '../dto/create-scan.dto';
import { ScanInputDto } from '../utils/interfaces';
import { WarehouseDetails } from '../models/qr-code-log.entity';

export enum EQrCodeValidations {
  InOrderQr = 'InOrderQr',
  HasBeenScannedBefore = 'HasBeenScannedBefore',
  HasBeenScannedBeforeInWarehouse = 'HasBeenScannedBeforeInWarehouse',
  HasOpend = 'HasOpend',
  HasTransferredForUsers = 'HasTransferredForUsers',
  HasScannedOutFromSameWarehouse = 'HasScannedOutFromSameWarehouse',
  NotConfigured = 'NotConfigured',
  OrderQr = 'OrderQr',
  HasBeenScannedOutFromWarehouse = 'HasBeenScannedOutFromWarehouse',
  CannotScanOutFromThisWarehouse = 'CannotScanOutFromThisWarehouse',
  HasBeenScannedBeforeInAnotherWarehouse = 'HasBeenScannedBeforeInAnotherWarehouse',
  VALID = 'VALID',
  CannotScanOutFromThisWarehouseAgain = 'CannotScanOutFromThisWarehouseAgain',
  UnAuthorizeToAccessThisQrCode = 'UnAuthorizeToAccessThisQrCode',
}

export const deletedAttributesForQrReset = [
  'vertical',
  'productId',
  'supplier',
  'productType',
  'product',
  'products',
  'workerName',
  'productionsDate',
  'operationBatch',
  'numberOfAgg',
  'aggQrCode',
  'hasAgg',
  'isIncentive',
  // 'productData',
  'supplierDetails',
  'verticalDetails',
  'productTypeDetails',
  'isConfigured',
  'parentConfigured',
  'isOpend',
  'isOpendOrder',
  'orderNum',
  'hasPallet',
  'warehouseDetails',
  'fromReset',
  'imageUrl',
  'orderNumber',
  'isScanRun',
  'hasWrongConfigrationPackage',
  'hasWrongConfigrationPallet',
  'configuredDate',
  'parentConfiguredDate',
  'scanArray',
  'totalOuters',
  'totalPallets',
  'totalPackages',
  'transferredFor',
  // 'parents',
  'directParent',
];

export const deletedAttributesForQrReplace = [
  'vertical',
  'productId',
  'supplier',
  'productType',
  'product',
  'products',
  'workerName',
  'productionsDate',
  'operationBatch',
  'numberOfAgg',
  'aggQrCode',
  'hasAgg',
  'isIncentive',
  // 'productData',
  'supplierDetails',
  'verticalDetails',
  'productTypeDetails',
  'isConfigured',
  'parentConfigured',
  'isOpend',
  'isOpendOrder',
  'orderNum',
  'hasPallet',
  'warehouseDetails',
  'fromReset',
  'imageUrl',
  'orderNumber',
  'isScanRun',
  'hasWrongConfigrationPackage',
  'hasWrongConfigrationPallet',
  'configuredDate',
  'parentConfiguredDate',
  'scanArray',
  'totalOuters',
  'totalPallets',
  'totalPackages',
  'transferredFor',
];

export enum EWarehouseOutType {
  INVOICE = 'INVOICE',
  QRCODES = 'QRCODES',
}

export interface ResetValidation {
  _id: string;
  warehouseDetails: WarehouseDetails | null;
  isQrCodeConfigured: boolean;
  isOpend: boolean;
  isScannedBefore: boolean;
  outersCount: number;
  orders: string[];
  qrType: QrCodeType;
  productSku: string;
  highestLayer: {
    outersCount: number;
    packagesCount: number;
    palletsCount: number;
    value: string;
    type: QrCodeType;
    layer: number;
    isOpend: boolean;
  };
  productData: ProductData;
  parentProductData: ProductData;
  isResetParent: boolean;
}

export const ScanInValidationStages = (
  qrCode: string,
  scanFor: UserDocument,
): unknown[] => [
  { $unwind: { preserveNullAndEmptyArrays: true, path: '$scanArray' } },
  {
    $group: {
      _id: null,
      isOpend: {
        // IF IT'S CHILDREN HAS SCANNED BEFORE
        $push: { $cond: [{ $eq: ['$isOpend', true] }, true, '$$REMOVE'] },
      },
      qrType: {
        $push: {
          $cond: [
            { $eq: ['$value', qrCode] },
            {
              $cond: [
                { $eq: ['$kind', QrCodeKind.COMPOSED] },
                {
                  $cond: [
                    { $eq: ['$directParent', ''] },
                    QrCodeType.PALLET,
                    QrCodeType.PACKAGE,
                  ],
                },
                {
                  $cond: [
                    { $eq: [{ $type: '$type' }, 'missing'] },
                    QrCodeType.ORDER,
                    '$type',
                  ],
                }, // in case condition fails so value will be => inner or outer
              ],
            },
            '$$REMOVE',
          ],
        },
      },

      parents: {
        $push: { $cond: [{ $eq: ['$value', qrCode] }, '$parents', '$$REMOVE'] },
      },
      // scanArray:{$push:"$scanArray"},
      count: {
        $sum: {
          $cond: [
            {
              $and: [
                {
                  $or: [
                    {
                      $gte: [
                        '$scanArray.userType.level',
                        scanFor.userType.id['level'],
                      ],
                    },
                    {
                      $and: [
                        { $eq: [scanFor.userType.id['isSubProfile'], true] },
                        {
                          $eq: [
                            scanFor.userType.id['parentProfile'],
                            '$scanArray.userType.level',
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  },
  {
    $group: {
      _id: null,
      isScannedBeforeFromMeOrMyParentOrLowerLevel: {
        //  IN CASE THAT THE QR HAS SCANNED FROM A LEVEL EQUAL TO MY LEVEL OR HIGHER LEVEL
        $sum: { $cond: [{ $gt: ['$count', 0] }, 1, 0] },
      },
      isNotValidNotEntered: {
        $push: '$count',
      },
      isOpend: { $first: '$isOpend' },
      qrType: { $first: '$qrType' },
      parents: { $first: '$parents' },
    },
  },
  {
    $project: {
      isScannedBeforeFromMeOrMyParentOrLowerLevel:
        '$isScannedBeforeFromMeOrMyParentOrLowerLevel',
      qrType: { $arrayElemAt: ['$qrType', 0] },
      isOpend: { $arrayElemAt: ['$isOpend', 0] },
      parents: { $arrayElemAt: ['$parents', 0] },
      count: '$count',
      isNotValidNotEntered: {
        $allElementsTrue: { $ifNull: ['$isNotValidNotEntered', []] },
      },
    },
  },
];
export const ScanOutValidationStages = (
  qrCode: string,
  scanFor: UserDocument,
): unknown[] => [
  { $unwind: { preserveNullAndEmptyArrays: true, path: '$scanArray' } },
  {
    $group: {
      _id: null,
      isOpend: {
        // IF IT'S CHILDREN HAS SCANNED BEFORE
        $push: { $cond: [{ $eq: ['$isOpend', true] }, true, '$$REMOVE'] },
      },

      qrType: {
        $push: {
          $cond: [
            { $eq: ['$value', qrCode] },
            {
              $cond: [
                { $eq: ['$kind', QrCodeKind.COMPOSED] },
                {
                  $cond: [
                    { $eq: ['$directParent', ''] },
                    QrCodeType.PALLET,
                    QrCodeType.PACKAGE,
                  ],
                },
                {
                  $cond: [
                    { $eq: [{ $type: '$type' }, 'missing'] },
                    QrCodeType.ORDER,
                    '$type',
                  ],
                }, // in case condition fails so value will be => inner or outer
              ],
            },
            '$$REMOVE',
          ],
        },
      },
      parents: {
        $push: { $cond: [{ $eq: ['$value', qrCode] }, '$parents', '$$REMOVE'] },
      },
      scanOutBeforeByMeOrMyParentProfile: {
        //  check if this qr has released from me or my parent profile
        $sum: {
          $cond: [
            {
              $and: [
                // { $ne: [{ $size: '$scannedFor' }, 0] },
                // { $ne: [{ $type: '$scannedFor' }, "object"] },

                {
                  $and: [
                    { $eq: ['$scanArray.action', ScanAction.SCANOUT] },

                    {
                      $or: [
                        {
                          $eq: [
                            '$scanArray.scannedFor.id',
                            (scanFor as UserDocument)._id,
                          ],
                        },

                        {
                          $eq: [
                            '$scanArray.scannedFor.id',
                            (scanFor as UserDocument).userType.id[
                              'isSubProfile'
                            ]
                              ? (scanFor as UserDocument).parentProfile
                              : 'not my parent',
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            1,
            0,
          ],
        },
      },
      scanInBeforeFromMeOrMyParent: {
        // Check if the qr is entered from me or my parent profile
        $sum: {
          $cond: [
            {
              $and: [
                // { $ne: [{ $size: '$scannedFor' }, 0] },

                {
                  $and: [
                    { $eq: ['$scanArray.action', ScanAction.SCANIN] },
                    {
                      $or: [
                        {
                          $eq: [
                            '$scanArray.scannedFor.id',
                            (scanFor as UserDocument)._id,
                          ],
                        },
                        {
                          $eq: [
                            '$scanArray.scannedFor.id',
                            (scanFor as UserDocument).userType.id[
                              'isSubProfile'
                            ]
                              ? (scanFor as UserDocument).parentProfile
                              : 'not my parent',
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            1,
            0,
          ],
        },
      },
      scanInBeforeFromAnotherWithInvalidLevel: {
        // Check if the qr is entered from me or my parent profile
        $sum: {
          $cond: [
            {
              $and: [
                // { $ne: [{ $size: '$scannedFor' }, 0] },

                {
                  $and: [
                    { $eq: ['$scanArray.action', ScanAction.SCANIN] },
                    {
                      $or: [
                        {
                          $gte: [
                            '$scanArray.userType.level',
                            scanFor.userType.id['level'],
                          ],
                        },
                        {
                          $and: [
                            {
                              $eq: [scanFor.userType.id['isSubProfile'], true],
                            },
                            {
                              $eq: [
                                scanFor.userType.id['parentProfile'],
                                '$scanArray.userType.level',
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
  },
  {
    $group: {
      _id: null,
      scanOutBeforeByMeOrMyParentProfile: {
        $first: '$scanOutBeforeByMeOrMyParentProfile',
      },
      scanInBeforeFromMeOrMyParent: { $first: '$scanInBeforeFromMeOrMyParent' },
      scanInBeforeFromAnotherWithInvalidLevel: {
        $first: '$scanInBeforeFromAnotherWithInvalidLevel',
      },
      isOpend: { $first: '$isOpend' },
      qrType: { $first: '$qrType' },
      parents: { $first: '$parents' },
    },
  },
  {
    $project: {
      qrType: { $arrayElemAt: ['$qrType', 0] },
      isOpend: { $arrayElemAt: ['$isOpend', 0] },
      parents: { $arrayElemAt: ['$parents', 0] },
      scanOutBeforeByMeOrMyParentProfile: 1,
      scanInBeforeFromMeOrMyParent: 1,
      scanInBeforeFromAnotherWithInvalidLevel: 1,
      // count: '$count',
      isNotValidNotEntered: {
        $allElementsTrue: { $ifNull: ['$isNotValidNotEntered', []] },
      },
    },
  },
];
export const ScanUseValidationStages = (qrCode: string): unknown[] => [
  {
    $group: {
      _id: null,
      qrType: {
        $push: {
          $cond: [
            { $eq: ['$value', qrCode] },
            {
              $cond: [
                { $eq: ['$kind', QrCodeKind.COMPOSED] },
                {
                  $cond: [
                    { $eq: ['$directParent', ''] },
                    QrCodeType.PALLET,
                    QrCodeType.PACKAGE,
                  ],
                },
                {
                  $cond: [
                    { $eq: [{ $type: '$type' }, 'missing'] },
                    QrCodeType.ORDER,
                    '$type',
                  ],
                }, // in case condition fails so value will be => inner or outer
              ],
            },
            '$$REMOVE',
          ],
        },
      },
      parents: {
        $push: { $cond: [{ $eq: ['$value', qrCode] }, '$parents', '$$REMOVE'] },
      },
      isUsedBefore: {
        $sum: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ['$scanArray', []] } }, 0] },
            1,
            0,
          ],
        },
      },
    },
  },
  {
    $group: {
      _id: null,
      isUsedBefore: { $first: '$isUsedBefore' },
      isOpend: { $first: '$isOpend' },
      qrType: { $first: '$qrType' },
      parents: { $first: '$parents' },
    },
  },
  {
    $project: {
      isUsedBefore: { $cond: [{ $gt: ['$isUsedBefore', 0] }, true, false] },
      qrType: { $arrayElemAt: ['$qrType', 0] },
      isOpend: { $arrayElemAt: ['$isOpend', 0] },
      parents: { $arrayElemAt: ['$parents', 0] },
      isNotValidNotEntered: {
        $allElementsTrue: { $ifNull: ['$isNotValidNotEntered', []] },
      },
    },
  },
];

export const FraudScanInValidation = [
  { $unwind: { path: '$scanArray', preserveNullAndEmptyArrays: true } },
  {
    $match: {
      'scanArray.action': { $ne: Actions.REWARD }, // include only scanIN and scanOUT
    },
  },
  {
    $addFields: {
      levelGrouping: {
        $cond: [
          { $eq: ['$scanArray.userType.isSubProfile', true] },
          '$scanArray.userType.parentProfile',
          '$scanArray.userType.level',
        ],
      },
    },
  },
  {
    $group: {
      _id: { action: '$scanArray.action', profile: '$levelGrouping' },
      count: { $sum: 1 },
      qrCodeValue: { $first: '$value' },
      parentProfileId: {
        $push: {
          $cond: [
            { $ne: ['$scanArray.userType.isSubProfile', true] },
            '$scanArray.scannedFor.id',
            '$$REMOVE',
          ],
        },
      },
    },
  },
  {
    $group: {
      _id: { levelOfMainProfile: '$_id.profile' },
      qrCodeValue: { $first: '$qrCodeValue' },
      parentProfileId: { $first: { $arrayElemAt: ['$parentProfileId', 0] } },
      scansInCount: {
        $sum: { $cond: [{ $eq: ['$_id.action', 'SCANIN'] }, '$count', 0] },
      },
      scansOutCount: {
        $sum: { $cond: [{ $eq: ['$_id.action', 'SCANOUT'] }, '$count', 0] },
      },
    },
  },
  {
    $match: {
      scansInCount: { $ne: 0 },
      scansOutCount: 0,
    },
  },
  {
    $addFields: {
      parentProfileId: { $toObjectId: '$parentProfileId' },
    },
  },
  {
    $lookup: {
      localField: 'parentProfileId',
      foreignField: '_id',
      as: 'userData',
      from: 'users',
      pipeline: [
        {
          $project: {
            _id: 1,
            userType: 1,
            firstName: 1,
            lastName: 1,
            wheelPoints: 1,
            totalpoints: 1,
            totalmoney: 1,
            walletType: 1,
            segment: 1,
            level: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$userData' },
  {
    $lookup: {
      localField: 'userData.userType.id',
      foreignField: '_id',
      as: 'userData.userType.id',
      from: 'usertypes',
      pipeline: [
        {
          $project: {
            reward: 1,
            name: 1,
            _id: 1,
            isSubProfile: 1,
            level: 1,
            isAffectedParent: 1,
            walletType: 1,
            segment: 1,
          },
        },
      ],
    },
  },
  { $unwind: '$userData.userType.id' },
  {
    $lookup: {
      from: 'monthpoints',
      localField: 'userData._id',
      foreignField: 'user',
      pipeline: [
        {
          $match: {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          },
        },
      ],
      as: 'monthPoint',
    },
  },
  {
    $unwind: {
      path: '$monthPoint',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $addFields: {
      monthPoint: {
        $ifNull: [
          '$monthPoint',
          {
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
            user: '$_id',
            totalPoints: 0,
            wheelPoints: 0,
          },
        ],
      },
    },
  },
];

export const ScanIncentive = (
  scanFor: UserDocument,
  ScanInputDto: ScanInputDto,
  scanAction: ScanAction = ScanAction.SCANIN,
  fraud = false,
) => [
  { $unwind: { path: '$productData' } },
  {
    $addFields: {
      disableIncentive: '$isDisableIncentiveOrder',
      productId: '$productData.productId',
      outerTotalNumber: { $ifNull: ['$productData.outers', 1] },
      counter: 1,
    },
  },
  {
    $lookup: {
      from: 'incentives',
      as: 'incentiveProductValues',
      let: {
        productData: '$$ROOT',
        disableIncentive: {
          $cond: [
            {
              $and: [
                {
                  $eq: ['$disableIncentive', true],
                },
                {
                  $or: [
                    {
                      $eq: ['$disableIncentiveType', 'ALL'],
                    },
                    {
                      $eq: ['$disableIncentiveType', 'OUTER'],
                    },
                  ],
                },
              ],
            },
            0,
            1,
          ],
        },
      },
      pipeline: findOneIncentive(
        {
          userTypeId: scanFor.userType.id['_id'],
          action:
            scanAction == ScanAction.SCANIN ? Actions.PURCHASE : Actions.SELLS,
          segment: scanFor.segment?.id ?? '',
          walletType: scanFor.walletType,
        },
        {
          userTypeId:
            ScanInputDto.users.parent &&
            ScanInputDto.users.parent.userType.id['_id'],
          action:
            scanAction == ScanAction.SCANIN ? Actions.PURCHASE : Actions.SELLS,
          segment:
            (ScanInputDto.users.parent &&
              ScanInputDto.users.parent.segment?.id) ||
            '',
          walletType:
            (ScanInputDto?.users?.parent &&
              ScanInputDto.users?.parent?.walletType) ||
            WalletType.POINTS,
        },
      ),
    },
  },
  {
    $unwind: {
      path: '$incentiveProductValues',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      wheeltValue: {
        $multiply: ['$outerTotalNumber', '$incentiveProductValues.wheeltValue'],
      },
      walletValue: {
        $multiply: ['$outerTotalNumber', '$incentiveProductValues.walletValue'],
      },
      walletMainValue: {
        $multiply: [
          '$outerTotalNumber',
          '$incentiveProductValues.walletMainValue',
        ],
      },
      wheelMainValue: {
        $multiply: [
          '$outerTotalNumber',
          '$incentiveProductValues.wheelMainValue',
        ],
      },
      productId: 1,
      isInvalidToScan: '$incentiveProductValues.isInvalidToScan',
    },
  },
  {
    $project: {
      isInvalidToScan: '$isInvalidToScan',
      totalMainWalletSum: '$walletMainValue',
      totalMainWheelSum: '$wheelMainValue',
      totalWalletSum: '$walletValue',
      totalWheelSum: '$wheeltValue',
      scans: {
        $cond: [
          { $eq: [scanFor.userType.id['isAffectedParent'], true] },
          [
            {
              action: scanAction,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: {
                id: scanFor._id,
                firstName: scanFor.firstName,
                lastName: scanFor.lastName,
              },
              userType: {
                _id: scanFor.userType.id['_id'],
                name: scanFor.userType.id['name'],
                level: scanFor.userType.id['level'],
                isSubProfile: scanFor.userType.id['isSubProfile'],
                parentProfile: scanFor.userType.id['parentProfile'],
              },
              purchasePoints:
                scanAction == ScanAction.SCANIN ? '$walletValue' : 0,
              sellsPoints: scanAction == ScanAction.SCANIN ? 0 : '$walletValue',
              usePoints: 0,
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheeltValue',
              level: scanFor.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType: scanFor.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
            {
              action: scanAction,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: ScanInputDto.users.parent && {
                id: ScanInputDto.users.parent._id,
                firstName: ScanInputDto.users.parent.firstName,
                lastName: ScanInputDto.users.parent.lastName,
              },
              userType: ScanInputDto.users.parent && {
                _id: ScanInputDto.users.parent.userType.id['_id'],
                name: ScanInputDto.users.parent.userType.id['name'],
                level: ScanInputDto.users.parent.userType.id['level'],
                isSubProfile:
                  ScanInputDto.users.parent.userType.id['isSubProfile'],
                parentProfile:
                  ScanInputDto.users.parent.userType.id['parentProfile'],
              },
              purchasePoints:
                scanAction == ScanAction.SCANIN ? '$walletMainValue' : 0,
              sellsPoints:
                scanAction == ScanAction.SCANIN ? 0 : '$walletMainValue',
              usePoints: 0,
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheelMainValue',
              level:
                ScanInputDto.users.parent && ScanInputDto.users.parent.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType:
                ScanInputDto.users.parent &&
                ScanInputDto.users.parent.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
          ],
          [
            {
              action: scanAction,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: {
                id: scanFor._id,
                firstName: scanFor.firstName,
                lastName: scanFor.lastName,
              },
              userType: {
                _id: scanFor.userType.id['_id'],
                name: scanFor.userType.id['name'],
                level: scanFor.userType.id['level'],
                isSubProfile: scanFor.userType.id['isSubProfile'],
                parentProfile: scanFor.userType.id['parentProfile'],
              },
              purchasePoints:
                scanAction == ScanAction.SCANIN ? '$walletValue' : 0,
              sellsPoints: scanAction == ScanAction.SCANIN ? 0 : '$walletValue',
              usePoints: 0,
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheeltValue',
              level: scanFor.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType: scanFor.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
          ],
        ],
      },
    },
  },
  {
    $group: {
      _id: null,
      isInvalidToScan: { $sum: '$isInvalidToScan' },
      scans: { $push: '$scans' },
      totalMainWalletSum: { $sum: '$totalMainWalletSum' },
      totalMainWheelSum: { $sum: '$totalMainWheelSum' },
      totalWalletSum: { $sum: '$totalWalletSum' },
      totalWheelSum: { $sum: '$totalWheelSum' },
    },
  },
  {
    $project: {
      _id: 0,
      isInvalidToScan: '$isInvalidToScan',
      scans: {
        $reduce: {
          input: '$scans',
          initialValue: [],
          in: {
            $concatArrays: ['$$value', '$$this'],
          },
        },
      },
      totalMainWalletSum: '$totalMainWalletSum',
      totalMainWheelSum: '$totalMainWheelSum',
      totalWalletSum: '$totalWalletSum',
      totalWheelSum: '$totalWheelSum',
    },
  },
];
export const ScanUseIncentive = (
  scanFor: UserDocument,
  ScanInputDto: ScanInputDto,
  fraud = false,
) => [
  { $unwind: { path: '$productData' } },
  {
    $addFields: {
      disableIncentive: '$isDisableIncentiveOrder',
      productId: '$productData.productId',
      outerTotalNumber: { $ifNull: ['$productData.outers', 1] },
      counter: 1,
    },
  },
  {
    $lookup: {
      from: 'incentives',
      as: 'incentiveProductValues',
      let: {
        productData: '$$ROOT',
        disableIncentive: {
          $cond: [
            {
              $and: [
                {
                  $eq: ['$disableIncentive', true],
                },
                {
                  $or: [
                    {
                      $eq: ['$disableIncentiveType', 'ALL'],
                    },
                    {
                      $eq: ['$disableIncentiveType', 'INNER'],
                    },
                  ],
                },
              ],
            },
            0,
            1,
          ],
        },
      },
      pipeline: findOneIncentive(
        {
          userTypeId: scanFor.userType.id['_id'],
          action: Actions.USE,
          segment: scanFor.segment?.id || '',
          walletType: scanFor.walletType,
        },
        {
          userTypeId:
            ScanInputDto.users.parent &&
            ScanInputDto.users.parent.userType.id['_id'],
          action: Actions.USE,
          segment:
            (ScanInputDto.users.parent &&
              ScanInputDto.users.parent.segment?.id) ||
            '',
          walletType:
            (ScanInputDto.users.parent &&
              ScanInputDto.users.parent.walletType) ||
            WalletType.POINTS,
        },
      ),
    },
  },
  {
    $unwind: {
      path: '$incentiveProductValues',
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      wheeltValue: {
        $multiply: ['$outerTotalNumber', '$incentiveProductValues.wheeltValue'],
      },
      walletValue: {
        $multiply: ['$outerTotalNumber', '$incentiveProductValues.walletValue'],
      },
      walletMainValue: {
        $multiply: [
          '$outerTotalNumber',
          '$incentiveProductValues.walletMainValue',
        ],
      },
      wheelMainValue: {
        $multiply: [
          '$outerTotalNumber',
          '$incentiveProductValues.wheelMainValue',
        ],
      },
      productId: 1,
      isInvalidToScan: '$incentiveProductValues.isInvalidToScan',
    },
  },
  {
    $project: {
      isInvalidToScan: '$isInvalidToScan',
      totalMainWalletSum: '$walletMainValue',
      totalMainWheelSum: '$wheelMainValue',
      totalWalletSum: '$walletValue',
      totalWheelSum: '$wheeltValue',
      scans: {
        $cond: [
          { $eq: [scanFor.userType.id['isAffectedParent'], true] },
          [
            {
              action: ScanAction.SCANUSE,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: {
                id: scanFor._id,
                firstName: scanFor.firstName,
                lastName: scanFor.lastName,
              },
              userType: {
                _id: scanFor.userType.id['_id'],
                name: scanFor.userType.id['name'],
                level: scanFor.userType.id['level'],
                isSubProfile: scanFor.userType.id['isSubProfile'],
                parentProfile: scanFor.userType.id['parentProfile'],
              },
              purchasePoints: 0,
              sellsPoints: 0,
              usePoints: '$walletValue',
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheeltValue',
              level: scanFor.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType: scanFor.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
            {
              action: ScanAction.SCANUSE,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: ScanInputDto.users.parent && {
                id: ScanInputDto.users.parent._id,
                firstName: ScanInputDto.users.parent.firstName,
                lastName: ScanInputDto.users.parent.lastName,
              },
              userType: ScanInputDto.users.parent && {
                _id: ScanInputDto.users.parent.userType.id['_id'],
                name: ScanInputDto.users.parent.userType.id['name'],
                level: ScanInputDto.users.parent.userType.id['level'],
                isSubProfile:
                  ScanInputDto.users.parent.userType.id['isSubProfile'],
                parentProfile:
                  ScanInputDto.users.parent.userType.id['parentProfile'],
              },
              purchasePoints: 0,
              sellsPoints: 0,
              usePoints: '$walletMainValue',
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheelMainValue',
              level:
                ScanInputDto.users.parent && ScanInputDto.users.parent.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType:
                ScanInputDto.users.parent &&
                ScanInputDto.users.parent.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
          ],
          [
            {
              action: ScanAction.SCANUSE,
              scannedBy: {
                id: ScanInputDto.users.me._id,
                firstName: ScanInputDto.users.me.firstName,
                lastName: ScanInputDto.users.me.lastName,
              },
              scannedFor: {
                id: scanFor._id,
                firstName: scanFor.firstName,
                lastName: scanFor.lastName,
              },
              userType: {
                _id: scanFor.userType.id['_id'],
                name: scanFor.userType.id['name'],
                level: scanFor.userType.id['level'],
                isSubProfile: scanFor.userType.id['isSubProfile'],
                parentProfile: scanFor.userType.id['parentProfile'],
              },
              purchasePoints: 0,
              sellsPoints: 0,
              usePoints: '$walletValue',
              backwordPoints: 0,
              backwordMoney: 0,
              wheelPoints: '$wheeltValue',
              level: scanFor.level,
              prodId: '$productId',
              createdAt: new Date(),
              isActionMaker: fraud ? true : false,
              walletType: scanFor.walletType,
              fraudMessage: {
                $cond: [{ $eq: [fraud, true] }, 'fraud detected', '$$REMOVE'],
              },
            },
          ],
        ],
      },
    },
  },
  {
    $group: {
      _id: null,
      isInvalidToScan: { $sum: '$isInvalidToScan' },
      scans: { $push: '$scans' },
      totalMainWalletSum: { $sum: '$totalMainWalletSum' },
      totalMainWheelSum: { $sum: '$totalMainWheelSum' },
      totalWalletSum: { $sum: '$totalWalletSum' },
      totalWheelSum: { $sum: '$totalWheelSum' },
    },
  },
  {
    $project: {
      _id: 0,
      isInvalidToScan: '$isInvalidToScan',
      scans: {
        $reduce: {
          input: '$scans',
          initialValue: [],
          in: {
            $concatArrays: ['$$value', '$$this'],
          },
        },
      },
      totalMainWalletSum: '$totalMainWalletSum',
      totalMainWheelSum: '$totalMainWheelSum',
      totalWalletSum: '$totalWalletSum',
      totalWheelSum: '$totalWheelSum',
    },
  },
];

export interface ScanOutValidation {
  scanOutBeforeByMeOrMyParentProfile: number;
  scanInBeforeFromMeOrMyParent: number;
  scanInBeforeFromAnotherWithInvalidLevel: number;
  isNotValidNotEntered: Array<unknown>;
  qrType: string;
  isOpend: boolean;
  parents: Array<string>;
}

export interface ScanUseValidation {
  count: number;
  qrType: string;
  isOpend: boolean;
  isUsedBefore: boolean;
  parents: Array<string>;
  isNotValidNotEntered: Array<unknown>;
}
