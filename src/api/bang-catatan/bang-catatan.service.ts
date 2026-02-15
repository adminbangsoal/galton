import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateBangCatatanDTO,
  GetCatatanTimelineDTO,
  ReportCatatanDTO,
} from './bang-catatan.dto';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { and, eq, inArray, like, or, sql, desc, notInArray } from 'drizzle-orm';
import { S3Service } from '../../s3/s3.service';
import { FirebaseService } from '../../database/firebase/firebase.service';
import { PageDto, PageMetaDto } from '../../common/dtos/page.dtos';
import SESService from '../../ses/ses.service';

@Injectable()
class BangCatatanService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private s3Service: S3Service,
    private firebaseService: FirebaseService,
    private sesService: SESService,
  ) {}

  async createCatatan(data: CreateBangCatatanDTO, userId: string) {
    const {
      asset_url,
      color_pallete,
      description,
      subject_id,
      thumbnail_url,
      note_type,
      title,
      topic_id,
    } = data;

    const isTopicExist = await this.db
      .select()
      .from(schema.topics)
      .where(({ id, subject_id: subjectId }) =>
        and(eq(id, topic_id), eq(subjectId, subject_id)),
      )
      .execute();

    if (!isTopicExist.length) {
      throw new NotFoundException('Subject or Topic not found');
    }

    const newCatatan = await this.db
      .insert(schema.bangCatatan)
      .values({
        asset_url: asset_url,
        color_pallete: color_pallete,
        description: description,
        thumbnail_url: thumbnail_url,
        note_type: note_type,
        title: title,
        subject_id: subject_id,
        topic_id: topic_id,
        user_id: userId,
      })
      .returning()
      .execute();

    return newCatatan[0];
  }

  async getCatatan(id: string, userId: string) {
    const catatan = await this.db
      .select({
        id: schema.bangCatatan.id,
        title: schema.bangCatatan.title,
        description: schema.bangCatatan.description,
        thumbnail_url: schema.bangCatatan.thumbnail_url,
        color_pallete: schema.bangCatatan.color_pallete,
        subject_id: schema.bangCatatan.subject_id,
        topic_id: schema.bangCatatan.topic_id,
        note_type: schema.bangCatatan.note_type,
        like_count: schema.bangCatatan.like_count,
        download_count: schema.bangCatatan.download_count,
        author: schema.users.full_name,
        author_picture: schema.users.profile_img,
        topic: schema.topics.name,
        subject: {
          name: schema.subjects.name,
          alternate_name: schema.subjects.alternate_name,
        },
        is_liked: sql<boolean>`false`.as('is_liked'),
      })
      .from(schema.bangCatatan)
      .where(({ id: catatanId }) => eq(catatanId, id))
      .leftJoin(schema.users, eq(schema.bangCatatan.user_id, schema.users.id))
      .leftJoin(
        schema.topics,
        eq(schema.bangCatatan.topic_id, schema.topics.id),
      )
      .leftJoin(
        schema.subjects,
        eq(schema.bangCatatan.subject_id, schema.subjects.id),
      )
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const result = catatan[0];

    const thumbnailKey = this.s3Service.getObjectKeyFromUrl(
      result.thumbnail_url,
    );
    if (thumbnailKey) {
      const url = await this.s3Service.getPresignedUrl(thumbnailKey);
      result.thumbnail_url = url;
    }

    const authorPictureKey = this.s3Service.getObjectKeyFromUrl(
      result.author_picture,
    );
    if (authorPictureKey) {
      const url = await this.s3Service.getPresignedUrl(authorPictureKey);
      result.author_picture = url;
    }

    result.is_liked = await this.isCatatanLiked(result.id, userId);

    return result;
  }

  async getCatatanLikeCount(catatanId: string, userId: string) {
    const catatan = await this.db
      .select()
      .from(schema.bangCatatan)
      .where(({ id }) => eq(id, catatanId))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const isLiked = await this.isCatatanLiked(catatanId, userId);

    return {
      catatan_id: catatanId,
      like_count: catatan[0].like_count,
      is_liked: isLiked,
    };
  }

  async getCatatanTimeline(
    catatanTimelineDTO: GetCatatanTimelineDTO,
    userId: string,
  ) {
    const { limit, page } = catatanTimelineDTO;

    let is_liked = null;
    if (catatanTimelineDTO.is_liked === 'true') is_liked = true;
    else if (catatanTimelineDTO.is_liked === 'false') is_liked = false;

    const searchQuery = catatanTimelineDTO.query
      ? `%${catatanTimelineDTO.query.toLowerCase()}%`
      : null;

    const userCatatanLikedHistoryRef =
      this.getCatatanLikedHistoryOfUserDocRef(userId);
    const userCatatanHistoryDoc = await userCatatanLikedHistoryRef.get();
    const likedCatatanIds: string[] = userCatatanHistoryDoc.exists
      ? userCatatanHistoryDoc.data().catatan_ids
      : [];

    const catatanQ = this.db
      .select({
        id: schema.bangCatatan.id,
        thumbnail_url: schema.bangCatatan.thumbnail_url,
        title: schema.bangCatatan.title,
        description: schema.bangCatatan.description,
        color_pallete: schema.bangCatatan.color_pallete,
        subject_id: schema.bangCatatan.subject_id,
        topic_id: schema.bangCatatan.topic_id,
        note_type: schema.bangCatatan.note_type,
        like_count: schema.bangCatatan.like_count,
        author: schema.users.full_name,
        author_picture: schema.users.profile_img,
        topic: schema.topics.name,
        subject: schema.subjects.alternate_name,
        download_count: schema.bangCatatan.download_count,
        is_liked: sql<boolean>`false`.as('is_liked'),
      })
      .from(schema.bangCatatan)
      .leftJoin(schema.users, eq(schema.bangCatatan.user_id, schema.users.id))
      .leftJoin(
        schema.topics,
        eq(schema.bangCatatan.topic_id, schema.topics.id),
      )
      .leftJoin(
        schema.subjects,
        eq(schema.bangCatatan.subject_id, schema.subjects.id),
      )
      .limit(limit)
      .offset((page - 1) * limit)
      .where(({ id, title, author, subject_id, topic_id, note_type }) =>
        // conditional query
        and(
          is_liked
            ? likedCatatanIds.length
              ? inArray(id, likedCatatanIds)
              : sql`1=0` // won't show anything since user haven't like any catatan (inArray can't accept empty array)
            : undefined,
          is_liked === false && likedCatatanIds.length
            ? notInArray(id, likedCatatanIds)
            : undefined,
          searchQuery
            ? or(
                sql`lower(${title}) like ${searchQuery}`,
                sql`lower(${author}) like ${searchQuery}`,
              )
            : undefined,
          catatanTimelineDTO.subject_id
            ? eq(subject_id, catatanTimelineDTO.subject_id)
            : undefined,
          catatanTimelineDTO.topic_id
            ? eq(topic_id, catatanTimelineDTO.topic_id)
            : undefined,
          catatanTimelineDTO.note_type
            ? eq(note_type, catatanTimelineDTO.note_type)
            : undefined,
        ),
      )
      .orderBy(
        desc(schema.bangCatatan.like_count),
        desc(schema.bangCatatan.download_count),
        desc(schema.bangCatatan.created_at),
      );

    const catatan = await catatanQ.execute();

    for (let i = 0; i < catatan.length; i++) {
      const thumbnailKey = this.s3Service.getObjectKeyFromUrl(
        catatan[i].thumbnail_url,
      );
      if (thumbnailKey) {
        const url = await this.s3Service.getPresignedUrl(thumbnailKey);
        catatan[i].thumbnail_url = url;
      }

      const authorPictureKey = this.s3Service.getObjectKeyFromUrl(
        catatan[i].author_picture,
      );
      if (authorPictureKey) {
        const url = await this.s3Service.getPresignedUrl(authorPictureKey);
        catatan[i].author_picture = url;
      }

      if (is_liked) {
        catatan[i].is_liked = true;
      } else if (is_liked === null) {
        catatan[i].is_liked = likedCatatanIds.includes(catatan[i].id);
      }
    }

    const pageMetadata = new PageMetaDto({
      itemCount: catatan.length,
      pageOptionsDto: catatanTimelineDTO,
    });

    return new PageDto(catatan, pageMetadata);
  }

  async downloadCatatan(catatanId: string) {
    const catatan = await this.db
      .select()
      .from(schema.bangCatatan)
      .where(({ id }) => eq(id, catatanId))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const result = catatan[0];

    const key = this.s3Service.getObjectKeyFromUrl(result.asset_url);
    if (key) {
      const url = await this.s3Service.getPresignedUrl(key);
      result.asset_url = url;
    } else {
      result.asset_url = null;
    }

    await this.db
      .update(schema.bangCatatan)
      .set({
        download_count: result.download_count + 1,
      })
      .where(eq(schema.bangCatatan.id, catatanId))
      .execute();

    return {
      url: result.asset_url,
    };
  }

  async likeCatatan(catatanId: string, userId: string) {
    const catatan = await this.db
      .select({
        id: schema.bangCatatan.id,
        user_id: schema.bangCatatan.user_id,
        like_count: schema.bangCatatan.like_count,
      })
      .from(schema.bangCatatan)
      .where(and(eq(schema.bangCatatan.id, catatanId)))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const catatanLikedHistoryRef = this.getCatatanLikedHistoryDocRef(catatanId);
    const userCatatanLikedHistoryRef =
      this.getCatatanLikedHistoryOfUserDocRef(userId);

    let updatedLikeCount = catatan[0].like_count;

    await this.firebaseService.getDb().runTransaction(async (t) => {
      const catatanHistoryDoc = await t.get(catatanLikedHistoryRef);
      const userCatatanHistoryDoc = await t.get(userCatatanLikedHistoryRef);

      const userIds: string[] = catatanHistoryDoc.exists
        ? catatanHistoryDoc.data().histories
        : [];
      const userIndex = userIds.indexOf(userId);

      const catatanIds: string[] = userCatatanHistoryDoc.exists
        ? userCatatanHistoryDoc.data().catatan_ids
        : [];
      const catatanIndex = catatanIds.indexOf(catatanId);

      if (userIndex != -1 && catatanIndex != -1) {
        throw new BadRequestException('Catatan already liked');
      }

      if (userIndex == -1) {
        userIds.push(userId);
        if (catatanHistoryDoc.exists) {
          t.update(catatanLikedHistoryRef, {
            histories: userIds,
          });
        } else {
          t.set(catatanLikedHistoryRef, {
            histories: userIds,
          });
        }
      }

      if (catatanIndex == -1) {
        catatanIds.push(catatanId);
        if (userCatatanHistoryDoc.exists) {
          t.update(userCatatanLikedHistoryRef, {
            catatan_ids: catatanIds,
          });
        } else {
          t.set(userCatatanLikedHistoryRef, {
            catatan_ids: catatanIds,
          });
        }
      }

      if (userIds.length !== catatan[0].like_count + 1) {
        console.log(
          `${new Date().toISOString()}: synchronizing like count from db (${
            catatan[0].like_count + 1
          }) to firebase (${userIds.length}) - catatanId: '${catatanId}'`,
        );
      }
      updatedLikeCount = userIds.length; // the like histories in firebase will be the source of truth
    });

    console.log(
      `${new Date().toISOString()}: like catatan - id: '${catatanId}' - updating like count from ${
        catatan[0].like_count
      } to ${updatedLikeCount}`,
    );

    await this.db
      .update(schema.bangCatatan)
      .set({
        like_count: updatedLikeCount,
      })
      .where(eq(schema.bangCatatan.id, catatanId))
      .execute();

    return {
      message: 'Catatan liked',
      catatan_id: catatanId,
      like_count: updatedLikeCount,
    };
  }

  async unlikeCatatan(catatanId: string, userId: string) {
    const catatan = await this.db
      .select({
        id: schema.bangCatatan.id,
        user_id: schema.bangCatatan.user_id,
        like_count: schema.bangCatatan.like_count,
      })
      .from(schema.bangCatatan)
      .where(and(eq(schema.bangCatatan.id, catatanId)))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const catatanLikedHistoryRef = this.getCatatanLikedHistoryDocRef(catatanId);
    const userCatatanLikedHistoryRef =
      this.getCatatanLikedHistoryOfUserDocRef(userId);

    let updatedLikeCount = catatan[0].like_count;

    await this.firebaseService.getDb().runTransaction(async (t) => {
      const catatanHistoryDoc = await t.get(catatanLikedHistoryRef);
      const userCatatanHistoryDoc = await t.get(userCatatanLikedHistoryRef);

      const userIds: string[] = catatanHistoryDoc.exists
        ? catatanHistoryDoc.data().histories
        : [];
      const userIndex = userIds.indexOf(userId);

      const catatanIds: string[] = userCatatanHistoryDoc.exists
        ? userCatatanHistoryDoc.data().catatan_ids
        : [];
      const catatanIndex = catatanIds.indexOf(catatanId);

      if (userIndex == -1 && catatanIndex == -1) {
        throw new BadRequestException('Catatan not liked');
      }

      if (userIndex != -1) {
        userIds.splice(userIndex, 1);
        if (catatanHistoryDoc.exists) {
          t.update(catatanLikedHistoryRef, {
            histories: userIds,
          });
        } else {
          t.set(catatanLikedHistoryRef, {
            histories: userIds,
          });
        }
      }

      if (catatanIndex != -1) {
        catatanIds.splice(catatanIndex, 1);
        if (userCatatanHistoryDoc.exists) {
          t.update(userCatatanLikedHistoryRef, {
            catatan_ids: catatanIds,
          });
        } else {
          t.set(userCatatanLikedHistoryRef, {
            catatan_ids: catatanIds,
          });
        }
      }

      if (userIds.length !== catatan[0].like_count - 1) {
        console.log(
          `${new Date().toISOString()}: synchronizing like count from db (${
            catatan[0].like_count - 1
          }) to firebase (${userIds.length}) - catatanId: '${catatanId}'`,
        );
      }
      updatedLikeCount = userIds.length; // the like histories in firebase will be the source of truth
    });

    console.log(
      `${new Date().toISOString()}: unlike catatan - id: '${catatanId}' - updating like count from ${
        catatan[0].like_count
      } to ${updatedLikeCount}`,
    );

    await this.db
      .update(schema.bangCatatan)
      .set({
        like_count: updatedLikeCount,
      })
      .where(eq(schema.bangCatatan.id, catatanId))
      .execute();

    return {
      message: 'Catatan unliked',
      catatan_id: catatanId,
      like_count: updatedLikeCount,
    };
  }

  async deleteCatatan(catatanId: string, userId: string) {
    const catatan = await this.db
      .select({
        id: schema.bangCatatan.id,
        user_id: schema.bangCatatan.user_id,
      })
      .from(schema.bangCatatan)
      .where(and(eq(schema.bangCatatan.id, catatanId)))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    if (userId != catatan[0].user_id) {
      throw new UnauthorizedException(`Cannot delete other user's note`);
    }

    await this.db
      .delete(schema.bangCatatan)
      .where(eq(schema.bangCatatan.id, catatanId))
      .execute();

    await this.firebaseService
      .getDb()
      .collection('liked_catatan_history')
      .doc(catatanId)
      .delete();

    return {
      message: 'Catatan deleted',
    };
  }

  async reportCatatan(
    catatanId: string,
    userId: string,
    report: ReportCatatanDTO,
  ) {
    const catatan = await this.db
      .select({
        id: schema.bangCatatan.id,
        user_id: schema.bangCatatan.user_id,
        title: schema.bangCatatan.title,
        description: schema.bangCatatan.description,
      })
      .from(schema.bangCatatan)
      .where(and(eq(schema.bangCatatan.id, catatanId)))
      .execute();

    if (!catatan.length) {
      throw new NotFoundException('Catatan not found');
    }

    const reportCatatan = await this.db
      .insert(schema.bangCatatanReport)
      .values({
        catatan_id: catatanId,
        user_id: userId,
        reason: report.reason,
        created_at: new Date(),
      })
      .returning();

    const reports = await this.db
      .select()
      .from(schema.bangCatatanReport)
      .where(eq(schema.bangCatatanReport.catatan_id, catatanId));

    await this.sesService.sendMail(
      `admin@bangsoal.co.id`,
      'Bang Catatan Report',
      `Catatan ID: ${catatan[0].id}\nTitle: ${catatan[0].title}\nDescription: ${catatan[0].description}\nTotal Reports: ${reports.length}\n\nReport ID: ${reportCatatan[0].id}\nReason: ${report.reason}`,
    );

    console.log(
      `${new Date().toISOString()}: new report of bang catatan with id '${catatanId}' - total reports: ${
        reports.length
      }`,
    );

    return {
      message: 'Catatan has been reported',
      catatan_id: catatanId,
      reason: report.reason,
      catatan_report_id: reportCatatan[0].id,
    };
  }

  async isCatatanLiked(catatanId: string, userId: string) {
    const userCatatanHistoryDoc = await this.getCatatanLikedHistoryOfUserDocRef(
      userId,
    ).get();
    const catatanIds: string[] = userCatatanHistoryDoc.exists
      ? userCatatanHistoryDoc.data().catatan_ids
      : [];
    return catatanIds.includes(catatanId);
  }

  getCatatanLikedHistoryDocRef(catatanId: string) {
    return this.firebaseService
      .getDb()
      .collection('liked_catatan_history')
      .doc(catatanId);
  }

  getCatatanLikedHistoryOfUserDocRef(userId: string) {
    return this.firebaseService
      .getDb()
      .collection('user_liked_catatan_history')
      .doc(userId);
  }
}

export default BangCatatanService;
