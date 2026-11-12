import type {Article, PrismaClient} from '@prisma/client';

export interface ArticleRecord {
  id: number;
  title: string;
  content: string;
  isPublished: boolean;
  authorId: string;
  authorUsername?: string | undefined;
  authorFullName?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArticleInput {
  title: string;
  content: string;
  authorId: string;
  isPublished?: boolean | undefined;
}

export interface UpdateArticleInput {
  title?: string | undefined;
  content?: string | undefined;
  isPublished?: boolean | undefined;
}

type ArticleWithAuthor = Article & {
  author?: {
    username: string;
    fullName: string | null;
  };
};

export class ArticleRepository {
  constructor(private readonly db: PrismaClient) {}

  private static _toRead(article: ArticleWithAuthor): ArticleRecord {
    return {
      id: article.id,
      title: article.title,
      content: article.content,
      isPublished: article.isPublished,
      authorId: article.authorId,
      authorUsername: article.author?.username,
      authorFullName: article.author?.fullName,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  public async create(data: CreateArticleInput): Promise<ArticleRecord> {
    const article = await this.db.article.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: data.authorId,
        isPublished: data.isPublished ?? false,
      },
      include: {
        author: {
          select: {username: true, fullName: true},
        },
      },
    });
    return ArticleRepository._toRead(article);
  }

  public async getAll(): Promise<ArticleRecord[]> {
    const articles = await this.db.article.findMany({
      include: {
        author: {
          select: {username: true, fullName: true},
        },
      },
      orderBy: {createdAt: 'desc'},
    });
    return articles.map((article) => ArticleRepository._toRead(article));
  }

  public async getById(id: number): Promise<ArticleRecord | null> {
    const article = await this.db.article.findUnique({
      where: {id},
      include: {
        author: {
          select: {username: true, fullName: true},
        },
      },
    });
    return article ? ArticleRepository._toRead(article) : null;
  }

  public async update(
    id: number,
    data: UpdateArticleInput,
  ): Promise<ArticleRecord> {
    const updatePayload: {
      title?: string;
      content?: string;
      isPublished?: boolean;
    } = {};

    if (data.title !== undefined) {
      updatePayload.title = data.title;
    }
    if (data.content !== undefined) {
      updatePayload.content = data.content;
    }
    if (data.isPublished !== undefined) {
      updatePayload.isPublished = data.isPublished;
    }

    const article = await this.db.article.update({
      where: {id},
      data: updatePayload,
      include: {
        author: {
          select: {username: true, fullName: true},
        },
      },
    });
    return ArticleRepository._toRead(article);
  }

  public async deleteById(id: number): Promise<void> {
    await this.db.article.delete({where: {id}});
  }
}
