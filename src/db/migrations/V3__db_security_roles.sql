-- 1. Создание логина и пользователя БД для Node.js приложения
CREATE LOGIN RbacAppLogin WITH PASSWORD = 'StrongPassword123!';
CREATE USER RbacAppUser FOR LOGIN RbacAppLogin;

-- 2. Создание кастомной роли базы данных
CREATE ROLE rbac_app_role;
ALTER ROLE rbac_app_role ADD MEMBER RbacAppUser;

-- 3. Выдача гранулярных прав (Принцип наименьших привилегий)
-- Разрешаем CRUD операции только для конкретных таблиц
GRANT SELECT, INSERT, UPDATE, DELETE ON Roles TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON Permissions TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON RolePermissions TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON Users TO rbac_app_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON UserRoles TO rbac_app_role;

-- Разрешаем чтение представления
GRANT SELECT ON vw_UserEffectivePermissions TO rbac_app_role;

-- Разрешаем выполнение хранимой процедуры
GRANT EXECUTE ON sp_AssignRoleToUser TO rbac_app_role;