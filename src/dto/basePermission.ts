import APP_USER_PERMISSION from './application.permission';
import DASHBOARD_USER_PERMISSION from './dashboard.permission';

const BasePermission = {
  ...APP_USER_PERMISSION,
  ...DASHBOARD_USER_PERMISSION,
};

type BasePermission = APP_USER_PERMISSION | DASHBOARD_USER_PERMISSION;

export default BasePermission;
