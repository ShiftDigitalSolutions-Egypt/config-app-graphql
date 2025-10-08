import { QrCodeType, WalletType } from '../models/covered-region.entity';
import { IncentiveOuterInput } from './interfaces';
import { QrCodeKind } from '../models/qr-code.entity';

export function fetchQrType(rootDocument?: string) {
  return {
    $cond: [
      {
        $eq: [
          rootDocument ? `${rootDocument}.kind` : '$kind',
          QrCodeKind.COMPOSED,
        ],
      },
      {
        $cond: [
          {
            $eq: [
              rootDocument ? `${rootDocument}.directParent` : '$directParent',
              '',
            ],
          },
          QrCodeType.PALLET,
          QrCodeType.PACKAGE,
        ],
      },
      {
        $cond: [
          {
            $and: [
              {
                $eq: [
                  { $type: rootDocument ? `${rootDocument}.type` : '$type' },
                  'missing',
                ],
              },
              {
                $eq: [
                  rootDocument ? `${rootDocument}.kind` : '$kind',
                  QrCodeKind.SINGLE,
                ],
              },
            ],
          },
          QrCodeType.ORDER,
          rootDocument ? `${rootDocument}.type` : '$type',
        ],
      },
    ],
  };
}
export function isConfiguredDataCondition<T>(
  invoiceQrCode: string,
  fieldData: T,
  configrationName: string,
) {
  return {
    $cond: [
      {
        $eq: ['$value', invoiceQrCode],
      },
      fieldData,
      configrationName,
    ],
  };
}
export function findOneIncentive(
  { userTypeId, action, segment, walletType }: IncentiveOuterInput,
  mainData?: IncentiveOuterInput,
) {
  return [
    {
      $match: {
        $expr: {
          $or: [
            { $and: [{ $eq: ['$userType', userTypeId] }] },
            mainData?.userTypeId && {
              $and: [{ $eq: ['$userType', mainData?.userTypeId] }],
            },
          ],
        },
      },
    },

    {
      $set: {
        counter: {
          productId: '$$productData.productId',
          counter: '$$productData.counter',
        },
      },
    },
    {
      $lookup: {
        as: 'pricelist',
        from: 'pricelists',
        foreignField: '_id',
        localField: 'priceList',
      },
    },
    { $unwind: { path: '$pricelist', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $expr: {
          $or: [
            { $eq: ['$pricelist.product', '$$productData.productId'] },
            { $eq: ['$pricelist.product', '$$productData.productId'] },
          ],
        },
      },
    },

    {
      $addFields: {
        'baseInsentive.profitMarginValue': {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$baseInsentive.profitMargin', 0.01] },
                '$pricelist.priceInfo.finalPrice',
              ],
            },
            0,
          ],
        },
        'baseInsentive.profitMarginAllownaceValue': {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$baseInsentive.baseIncentiveAllownace', 0.01] },
                '$pricelist.priceInfo.basePrice',
              ],
            },
            0,
          ],
        },
      },
    },

    { $addFields: { product: { $toObjectId: '$product' } } },

    {
      $addFields: {
        segmentPercentage: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$segmentation',
                as: 'segment',
                cond: {
                  $eq: ['$$segment.segment', segment],
                },
              },
            },
            0,
          ],
        },

        counterValue: '$counter',

        rewardStream: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$rewardStreams',
                as: 'reward',
                cond: {
                  $eq: ['$$reward.action', action],
                },
              },
            },
            0,
          ],
        },
        rewardStreamArray: {
          $filter: {
            input: '$rewardStreams',
            as: 'reward',
            cond: {
              $eq: ['$$reward.action', action],
            },
          },
        },
      },
    },

    {
      $addFields: {
        isInvalidToScan: {
          $cond: [{ $eq: [{ $size: '$rewardStreamArray' }, 0] }, 1, 0],
        },
      },
    },

    {
      $addFields: {
        wheelValue: {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$rewardStream.wheel', 0.01] },
                '$baseInsentive.profitMarginAllownaceValue',
                '$$disableIncentive',
              ],
            },
            0,
          ],
        },
        walletValue: {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$rewardStream.wallet', 0.01] },
                '$baseInsentive.profitMarginAllownaceValue',
                '$$disableIncentive',
              ],
            },
            0,
          ],
        },
      },
    },

    {
      $addFields: {
        walletValueFinal: {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$segmentPercentage.value', 0.01] },
                '$walletValue',
              ],
            },
            0,
          ],
        },
        wheelValueFinal: {
          $ifNull: [
            {
              $multiply: [
                { $multiply: ['$segmentPercentage.value', 0.01] },
                '$wheelValue',
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $addFields: {
        wheelValueFinalAfterPlaying: {
          $ceil: {
            $ifNull: [
              {
                $multiply: ['$wheelValueFinal', 10],
              },
              0,
            ],
          },
        },

        walletValueFinalAfterPlaying: {
          $cond: [
            { $eq: ['$userType', userTypeId] },
            walletType === WalletType.POINTS
              ? {
                  $ceil: {
                    $ifNull: [
                      {
                        $multiply: ['$walletValueFinal', 10],
                      },
                      0,
                    ],
                  },
                }
              : {
                  $multiply: [
                    {
                      $ceil: {
                        $multiply: [{ $ifNull: ['$walletValueFinal', 0] }, 100],
                      },
                    },
                    0.01,
                  ],
                },
            mainData?.walletType === WalletType.POINTS
              ? {
                  $ceil: {
                    $ifNull: [
                      {
                        $multiply: ['$walletValueFinal', 10],
                      },
                      0,
                    ],
                  },
                }
              : {
                  $multiply: [
                    {
                      $ceil: {
                        $multiply: [{ $ifNull: ['$walletValueFinal', 0] }, 100],
                      },
                    },
                    0.01,
                  ],
                },
          ],
        },
      },
    },
    {
      $project: {
        product: '$product',
        userType: '$userType',
        isInvalidToScan: '$isInvalidToScan',

        wheelValueAfterMultibly: {
          $ifNull: [
            {
              $multiply: [
                '$wheelValueFinalAfterPlaying',
                '$counterValue.counter',
              ],
            },
            0,
          ],
        },
        whaletValueAfterMultibly: {
          $ifNull: [
            {
              $multiply: [
                '$walletValueFinalAfterPlaying',
                '$counterValue.counter',
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        wheeltValue: {
          $sum: {
            $cond: [
              { $eq: ['$userType', userTypeId] },
              '$wheelValueAfterMultibly',
              '$$REMOVE',
            ],
          },
        },

        walletValue: {
          $sum: {
            $cond: [
              { $eq: ['$userType', userTypeId] },
              '$whaletValueAfterMultibly',
              '$$REMOVE',
            ],
          },
        },

        walletMainValue: {
          $sum: {
            $cond: [
              { $eq: ['$userType', mainData?.userTypeId] },
              '$whaletValueAfterMultibly',
              '$$REMOVE',
            ],
          },
        },
        wheelMainValue: {
          $sum: {
            $cond: [
              { $eq: ['$userType', mainData?.userTypeId] },
              '$wheelValueAfterMultibly',
              '$$REMOVE',
            ],
          },
        },
        /*  wheelValueFinalAfterPlaying: {
            $sum: { $cond: [{ $eq: ['$userType', userTypeId] }, '$wheelValueFinalAfterPlaying', '$$REMOVE'] },
          },
  
          walletValueFinalAfterPlaying: {
            $sum: { $cond: [{ $eq: ['$userType', userTypeId] }, '$walletValueFinalAfterPlaying', '$$REMOVE'] },
          },
  
          walletMainValueAfterPlay: {
            $sum: { $cond: [{ $eq: ['$userType', mainData?.userTypeId] }, '$walletValueFinalAfterPlaying', '$$REMOVE'] },
          },
          wheelMainValueAfterPlay: {
            $sum: { $cond: [{ $eq: ['$userType', mainData?.userTypeId] }, '$wheelValueFinalAfterPlaying', '$$REMOVE'] },
          }, */
        isInvalidToScan: { $sum: '$isInvalidToScan' },
        product: { $first: '$product' },
      },
    },
    {
      $addFields: {
        hasSegment: segment !== undefined,
        hasMainSegment: mainData?.segment !== undefined,
      },
    },
    {
      $addFields: {
        wheeltValue: {
          $cond: [{ $eq: ['$hasSegment', true] }, '$wheeltValue', 0],
        },
        walletValue: {
          $cond: [{ $eq: ['$hasSegment', true] }, '$walletValue', 0],
        },
        walletMainValue: {
          $cond: [{ $eq: ['$hasMainSegment', true] }, '$walletMainValue', 0],
        },
        wheelMainValue: {
          $cond: [{ $eq: ['$hasMainSegment', true] }, '$wheelMainValue', 0],
        },
      },
    },
  ];
}
