BEGIN TRY

BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[Articles]', N'U') IS NOT NULL
    DROP TABLE [dbo].[Articles];

IF OBJECT_ID(N'[dbo].[DF_Users_createdAt]', N'D') IS NOT NULL
    ALTER TABLE [dbo].[Users] DROP CONSTRAINT [DF_Users_createdAt];

IF COL_LENGTH(N'[dbo].[Users]', N'createdAt') IS NOT NULL
    ALTER TABLE [dbo].[Users] DROP COLUMN [createdAt];

IF COL_LENGTH(N'[dbo].[Users]', N'fullName') IS NOT NULL
    ALTER TABLE [dbo].[Users] DROP COLUMN [fullName];

IF COL_LENGTH(N'[dbo].[Users]', N'passwordHash') IS NOT NULL
    ALTER TABLE [dbo].[Users] DROP COLUMN [passwordHash];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW;

END CATCH
