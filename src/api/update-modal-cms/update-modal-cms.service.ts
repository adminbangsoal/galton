import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import { and, eq, sql, asc, gt, lt, desc, lte } from 'drizzle-orm';
import dayjs from 'dayjs';
import { CreateUpdateModalDto } from './update-modal-cms.dto';

@Injectable()
class UpdateModalCMSService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createUpdateModal(modalData: CreateUpdateModalDto) {
    const createdUpdateModal = await this.db
      .insert(schema.update_modals)
      .values(modalData)
      .returning();

    if (!createdUpdateModal.length) {
      console.log(
        `${dayjs().toISOString()}: update-modal-cms - failed to create new: ${modalData}`,
      );
      throw new BadRequestException(
        `Failed to create new update modal for what's new feature`,
      );
    }

    return createdUpdateModal[0];
  }

  async deleteUpdateModal(id: string) {
    const updateModal = await this.db.query.update_modals.findFirst({
      where: (modal, { eq }) => eq(modal.id, id),
    });
    if (!updateModal)
      throw new NotFoundException(`Update modal not found with id '${id}'`);

    const deletedUpdateModal = await this.db
      .delete(schema.update_modals)
      .where(eq(schema.update_modals.id, id))
      .returning();

    if (!deletedUpdateModal.length) {
      console.log(
        `${dayjs().toISOString()}: update-modal-cms - failed to delete with id: '${id}'`,
      );
      throw new InternalServerErrorException(
        `Failed to delete update modal for what's new feature`,
      );
    }

    return deletedUpdateModal[0];
  }
}

export default UpdateModalCMSService;
