export {
  UserRepository,
  type UserRecord,
  type UserStoreRecord,
  type CreateUserInput,
  type UserAccessConfig,
} from './user.repository.js';

export {
  RoleRepository,
  type RoleRecord,
  type RoleWithPermissions,
} from './role.repository.js';

export {
  PermissionRepository,
  type PermissionRecord,
} from './permission.repository.js';

export {
  ArticleRepository,
  type ArticleRecord,
  type CreateArticleInput,
  type UpdateArticleInput,
} from './article.repository.js';
