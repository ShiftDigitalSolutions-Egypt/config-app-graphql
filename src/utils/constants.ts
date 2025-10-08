export class Constants {
  public static readonly EMAIL_REGX =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  public static readonly PHONE_REGX = /\+(\d-)?(\d{1,4}-?){1,3}\d{1,14}$/;
  public static readonly MessageQueues = {
    TEST: 'test',
    TEST1: 'test1',
    QRCODE: 'qrCode',
    NOTIFICATION: 'notification',
    WALLETTRANSACTIONS: 'walletTransactions',
    QRCONFIGRATION: 'qrConfig',
    DLQ_QRCONFIGRATION: 'dlqQrConfig',
    PALLETAGG: 'palletAgg',
    DLQ_PALLETAGG: 'dlqPalletAgg',
    GENERATE_BATCH_EXCEL: 'generateBatchExcel',
    BACKWORD_ACTION: 'backwordAction',
    EXCHANGE_BACKWORD_ACTION: 'exchangeBackwordAction',
    ROUTE_BACKWORD_ACTION: 'routeBackwordAction',
    INVOICE_QUEUE: 'invoiceQueue',
    EXCHANGE_INVOICE_QUEUE: 'exchangeInvoiceQueue',
    ROUTE_INVOICE_QUEUE: 'routeInvoiceQueue',
    WAREHOUSE_QUEUE: 'warehouseQueue',
    EXCHANGE_WAREHOUSE: 'exchangeWarehouse',
    ROUTE_WAREHOUSE: 'routeWarehouse',
    END_OF_MONTH: 'end-of-month',
    EXCHANGE_QR_CONFIG: 'qr-config-ex',
    ROUTE_QR_CONFIG: 'qr-route',
    EXCHANGE_PALLETAGG: 'pallet-agg-exchange',
    ROUTE_PALLETAGG: 'pallet-agg-route',
    VERTICAL_UPDATE: 'vertical-update',
    EXCHANGE_VERTICAL_UPDATE: 'ex-vertical-update',
    ROUTE_VERTICAL_UPDATE: 'route-vertical-update',
    PORDUCT_TYPE_QUEUE: 'product-type-queue',
    E_VOUCHER: 'e-voucher',
    UPDATE_USERS_SEGMENTS: 'update-users-segments',
    UPDATE_USERS_SEGMENTS_DELAY: 'update-users-segments-delay',
    EXCHANGE_UPDATE_USERS_SEGMENTS: 'exchange-update-users-segments',
    EXCHANGE_UPDATE_USERS_SEGMENTS_DELAY: 'exchange-update-users-segments-delay',
    ROUTE_UPDATE_USERS_SEGMENTS: 'route-update-users-segments',
    HOLD_INCENTIVE: 'hold-incentive',
  };

  public static readonly GET_POSTS_CACHE_KEY = 'GET_POSTS_CACHE';
  public static readonly repponsecode = {
    SUCCESS: 200,
    CREATED: 201,
    ACCEPTED: 202,
    NO_CONTENT: 204, // delete functtion
    FORBIDDEN: 403, //protect roles endpoint ,
    END_OF_MONTH: 426, //updateVersioning
    REQUIST_TIME_OUT: 408,
    BAD_REQUIST: 400,
    NOT_AUTHURIZED: 401,
    UNSUPPORTED_MEDIA_TYPE: 415,
    // CANNOT_CHANGE_NOW : 400,
    EXPECTATION_FAILED: 422,
    // INVALID_TOKEN : 401,
    NETWORK_ERROR: 12029,
    NOT_FOUND: 404,
    CONFLICT_REQUEST: 409,
    FAILUER: 406,
    UNKNOWN_CONNECTION: 409,
    VERSION_CHECK: 451,
    SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    FIREBASE_ERROR: 600,
  };

  public static repponseMessageQrcode: {
    101: { flag: '101'; description: 'doc not found !!' };
    102: { flag: '102'; description: 'unknown !!' };
    103: { flag: '103'; description: 'doc not found !!' };
    104: { flag: '104'; description: 'Invalid Entry!!' };
    105: { flag: '105'; description: 'Another Device !!' };
    106: { flag: '106'; description: 'Invalid Token !!' };
    107: { flag: '107'; description: 'End OF Month !!' };
    108: { flag: '108'; description: 'Maintenance !!' };
    109: { flag: '109'; description: 'Not Approved !!' };
    110: { flag: '110'; description: 'Critical Upgrade !!' };
    111: { flag: '110'; description: 'Critical Upgrade !!' };

    USED_BEFORE: 'USED_BEFORE';
    VALID: 'VALID';
    QR_NOT_ACTIVATED: 'QR_NOT_ACTIVATED';
    QR_CODE_NOT_CONFIGURE: 'QR_CODE_NOT_CONFIGURE';
    QR_NOT_AUTH: 'QR_NOT_AUTH';
    QR_NOT_FOUND_IN_STOCK: 'QR_NOT_FOUND_IN_STOCK';
  };
  public static readonly repponseMessage: {
    OK: 'OK';
    ENTITY_REQUIRED: 'ENTITY_REQUIRED';
    VALID_TOKEN: 'VALID_TOKEN';
    INVALID_TOKEN: 'INVALID_TOKEN';
    END_OF_MONTH: 'END_OF_MONTH';
    MAINTINANCE: 'MAINTINANCE';
    UPGRADE_REQUIRED: 'UPGRADE_REQUIRED';
    USER_NOT_FOUND: 'NOT_FOUND';
    JOINING_REQUEST: 'JOINING_REQUEST';
    NEW_USER: 'NEW_USER';
    NOT_APPROVED: 'NOT_APPROVED';
    CRITICAL_UPGRADE: 'CRITICAL_UPGRADE';
    NOMINAL_UPGRADE: 'NOMINAL_UPGRADE';
    UNABLE_TO_PLAY_WHEEL: 'UNABLE_TO_PLAY_WHEEL';
  };
}
