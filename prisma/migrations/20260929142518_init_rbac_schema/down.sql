BEGIN TRY

BEGIN TRAN;

-- 1. Drop junction tables with foreign key constraints first
IF OBJECT_ID(N'[dbo].[RolePermissions]', N'U') IS NOT NULL
    DROP TABLE [dbo].[RolePermissions];

IF OBJECT_ID(N'[dbo].[UserRoles]', N'U') IS NOT NULL
    DROP TABLE [dbo].[UserRoles];

-- 2. Drop primary tables
IF OBJECT_ID(N'[dbo].[Permissions]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Permissions];

IF OBJECT_ID(N'[dbo].[Roles]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Roles];

IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Users];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH
