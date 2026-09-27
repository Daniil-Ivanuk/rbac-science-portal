CREATE VIEW vw_UserEffectivePermissions AS
SELECT DISTINCT 
    u.Id AS UserId,
    u.Username,
    p.Name AS PermissionName,
    p.Resource
FROM Users u
INNER JOIN UserRoles ur ON u.Id = ur.UserId
INNER JOIN Roles r ON ur.RoleId = r.Id
INNER JOIN RolePermissions rp ON r.Id = rp.RoleId
INNER JOIN Permissions p ON rp.PermissionId = p.Id
WHERE u.IsActive = 1;

CREATE PROCEDURE sp_AssignRoleToUser
    @UserId UNIQUEIDENTIFIER,
    @RoleName NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        DECLARE @RoleId INT;
        SELECT @RoleId = Id FROM Roles WHERE Name = @RoleName;
        
        IF @RoleId IS NULL
            THROW 50001, 'Role does not exist.', 1;

        IF NOT EXISTS (SELECT 1 FROM UserRoles WHERE UserId = @UserId AND RoleId = @RoleId)
        BEGIN
            INSERT INTO UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;