import type {PrismaClient} from '@prisma/client';
import {prisma} from '../db/prisma.client.js';
import {RbacContext} from './context.js';
import {
  AccessDeniedError,
  EntityNotFoundError,
  ValidationError,
} from './errors.js';
import {
  ArticleRepository,
  type ArticleRecord,
  type CreateArticleInput,
  type UpdateArticleInput,
} from '../repositories/article.repository.js';

export class ArticleService {
  private readonly articleRepo: ArticleRepository;

  constructor(db?: PrismaClient) {
    const client = db || RbacContext.db || prisma;
    this.articleRepo = new ArticleRepository(client);
  }

  public async createArticle(
    input: CreateArticleInput,
  ): Promise<ArticleRecord> {
    const title = input.title?.trim();
    const content = input.content?.trim();

    if (!title || !content) {
      throw new ValidationError('Article title and content are required');
    }

    return this.articleRepo.create({
      title,
      content,
      authorId: input.authorId,
      isPublished: input.isPublished,
    });
  }

  public async getAllArticles(): Promise<ArticleRecord[]> {
    return this.articleRepo.getAll();
  }

  public async getArticleById(id: number): Promise<ArticleRecord> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ValidationError('Invalid article ID');
    }

    const article = await this.articleRepo.getById(id);
    if (!article) {
      throw new EntityNotFoundError(`Article with ID ${id} not found`);
    }

    return article;
  }

  public async updateArticle(
    id: number,
    data: UpdateArticleInput,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<ArticleRecord> {
    const existing = await this.getArticleById(id);

    if (!isAdmin && existing.authorId !== requesterId) {
      throw new AccessDeniedError(
        'Access denied: only the author or an Admin can edit this article',
      );
    }

    return this.articleRepo.update(id, data);
  }

  public async deleteArticle(
    id: number,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const existing = await this.getArticleById(id);

    if (!isAdmin && existing.authorId !== requesterId) {
      throw new AccessDeniedError(
        'Access denied: only the author or an Admin can delete this article',
      );
    }

    await this.articleRepo.deleteById(id);
  }
}
