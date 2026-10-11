CREATE LOGIN RbacAppLogin WITH PASSWORD = '$(RbacAppPassword)';
CREATE USER RbacAppUser FOR LOGIN RbacAppLogin;

CREATE ROLE rbac_app_role;
ALTER ROLE rbac_app_role ADD MEMBER RbacAppUser;

GRANT SELECT, INSERT, UPDATE, DELETE ON Roles TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON Permissions TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON RolePermissions TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON Users TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON UserRoles TO rbac_app_role;

GRANT SELECT ON vw_UserEffectivePermissions TO rbac_app_role;

GRANT EXECUTE ON sp_AssignRoleToUser TO rbac_app_role;