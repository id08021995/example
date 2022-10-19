import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { messages } from 'src/config';
import {
  createOnePlain,
  PlainEntityWithoutId,
  updateOnePlain,
  softDeleteOne,
  createOneWithRelations,
  NewEntity,
} from 'src/tools';
import { Repository } from 'typeorm';
import { Comment } from '../model';

@Injectable()
export class CommentsRepo {
  constructor(
    @InjectRepository(Comment)
    private readonly repo: Repository<Comment>,
  ) {}

  getAll() {
    return this.repo.find({ relations: ['author', 'expenseCell'] });
  }

  async getOneByIdAndAuthorId(id: number, authorId: number) {
    const comment = await this.repo.findOne({
      where: { id, authorId },
      relations: ['author'],
    });
    if (!comment)
      throw new BadRequestException(
        messages.repo.common.cantGetNotFoundById('author', authorId),
      );
    return comment;
  }

  async getByCellId(id: number) {
    return this.repo
      .createQueryBuilder('comments')
      .where('comments.expenseCellId = :id', {
        id,
      })
      .leftJoin('comments.author', 'author')
      .leftJoinAndSelect('comments.expenseCell', 'expenseCell')
      .leftJoin('expenseCell.accountInstance', 'accountInstance')
      .addSelect([
        'accountInstance.id',
        'accountInstance.accountGroupInstanceId',
      ])
      .addSelect([
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.icon',
        'author.email',
      ])
      .orderBy('comments.createdAt', 'ASC')
      .getMany();
  }

  createOnePlain(newComment: PlainEntityWithoutId<Comment>) {
    return createOnePlain(this.repo, newComment, 'comment');
  }

  async getLastOnesOfSpecificRollupNode(rollupNodeId: number) {
    return this.repo
      .createQueryBuilder('comments')
      .leftJoin('comments.author', 'author')
      .leftJoinAndSelect('comments.expenseCell', 'expenseCell')
      .leftJoin('expenseCell.accountInstance', 'accountInstance')
      .addSelect([
        'accountInstance.id',
        'accountInstance.accountGroupInstanceId',
      ])
      .leftJoin('accountInstance.accountGroupInstance', 'accountGroupInstance')
      .leftJoin('accountGroupInstance.accountGroup', 'accountGroup')
      .leftJoin('accountGroup.rollupNode', 'rollupNode')
      .where('rollupNode.id = :rollupNodeId', { rollupNodeId })
      .addSelect([
        'author.id',
        'author.firstName',
        'author.lastName',
        'author.icon',
        'author.email',
      ])
      .orderBy('comments.createdAt', 'DESC')
      .distinct()
      .getMany();
  }
}
