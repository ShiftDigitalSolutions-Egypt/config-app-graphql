import { Actions } from '../models/incentive.entity';
import { ProductDocument } from  '../models/product.entity';
import { ProductData } from  '../models/qr-code.entity';
import { ScanAction } from '../dto/create-scan.dto';
import { WalletType } from '../models/user-type.entity';
import { UserDocument } from '../models/_user.model';

export interface QrCodeFixConnection {
  _id: string;
  parents: [string];
  value: string;
  directParent: string;
  productDetails: ProductDocument;
}
export interface IncentiveOuterInput {
  action: Actions;
  segment: string;
  userTypeId: string;
  walletType: WalletType;
}
export interface ScanInWarehouseResponse {
  rootData: RootData[];
}
export interface ScanOutWarehouseResponse {
  rootData: RootDataOutWarehouse[];
  productData:ProductData[]
}
export interface Value {
  key: {
    _id: string;
    name: string;
  };
  value: {
    _id: string;
    name: string;
    unit: {
      _id: string;
      name: string;
    };
  };
}

export interface Product {
  id: string;
  values: Value[];
  name: string;
  image: string;
  counter: number;
}

export interface CounterPerProduct {
  _id: string;
  outers: number;
  products: Product[];
  productType: string;
  productTypeDetails: {
    id: string;
    name: string;
  };
}

export interface RootData {
  updatedList: string[];
  totalValidatedToScannedInWarehuse: number;
  totalNonValidToScannedInWarehuse: number;
  notConfigQrCodes:number;
  parentsData: string[];
}
export interface RootDataOutWarehouse {
  updatedList: string[];
  totalValidatedToScannedOutWarehouse: number;
  totalNonValidToScannedOutWarehouse: number;
  notConfigQrCodes:number;
  parentsData: string[];
}

export interface ScanInputDto {
  qrCode: string;
  scanAction: ScanAction;
  users: UsersScan;
  scannedFor?: string | UserDocument;
  scanFor?: UserDocument;
  mainProfile?: UserDocument;
}

export interface ScanInResultNewArch {
  count: number;
  qrType: string;
  isOpend: boolean;
  isScannedBeforeFromMeOrMyParentOrLowerLevel: number;
  parents: Array<string>;
  isNotValidNotEntered: Array<unknown>;
}
export interface UsersScan {
  me: UserDocument;
  parent: UserDocument | undefined;
  scannedFor: UserDocument | undefined;
}


export const FaceLiftSupplier =  ['Sanad','HSE-KSA', 'Saint-Gobain', 'Energya-El-Sewedy-Helal', 'ElAseel','AlamalAlsharif','KZ','Kenya', 'IFT'];