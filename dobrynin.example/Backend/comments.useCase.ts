import { BadRequestException, Injectable } from '@nestjs/common';
import { messages } from 'src/config';
import { NewEntity, PlainEntityWithoutId } from 'src/tools';
import { CommentStatusType, NewCommentRequestDTO } from 'src/types';
import { AccountGroupInstanceUseCase } from '../accountGroupInstance';
import { UserAuthInfo } from '../auth';
import { repo } from '../infrastructure';
import { MailUseCase } from '../mail';
import { Comment, ExpenseCell } from '../infrastructure/model';

@Injectable()
export class CommentsUseCase {
  constructor(
    private readonly commentsRepo: repo.CommentsRepo,
    private readonly expenseCellRepo: repo.ExpenseCellRepo,
    private readonly userRepo: repo.UserRepo,
    private readonly mailUseCase: MailUseCase,
    private readonly accountGroupInstanceUseCase: AccountGroupInstanceUseCase,
  ) {}

  getAll() {
    return this.commentsRepo.getAll();
  }

  async createOrUpdate(message: NewCommentRequestDTO) {
    const user = await this.getUser(message.userId);
    this.checkAvailabilityToMakeCommentsFor(user);

    const expenseCell = await this.findOrCreateExpenseCell(message);

    if (message.commentType === CommentStatusType.CUSTOM) {
      await this.openDiscussion(expenseCell);
    }

    return this.createOrUpdateComment(message, expenseCell.id);
  }

  async create(newComment: PlainEntityWithoutId<Comment>) {
    return this.commentsRepo.createOnePlain(newComment);
  }

  async createManySystemComments(updatedExpenseCells: any[]) {
    await Promise.all(
      updatedExpenseCells.map((expenseCell) => {
        const message: NewCommentRequestDTO = {
          accountInstanceId: expenseCell.accountInstanceId,
          date: `${expenseCell.year}:${expenseCell.month}`,
          commentType: CommentStatusType.SYSTEM,
          value: expenseCell.isManagerView
            ? `Value was changed ${expenseCell.valueForSeniorView} → ${expenseCell.valueForManagerView}`
            : `Value was changed ${expenseCell.valueForManagerView} → ${expenseCell.valueForSeniorView}`,
          userId: expenseCell.userId,
        };
        return this.createOrUpdate(message);
      }),
    );
  }

  async updateOne(commentId: number, value: string) {
    const newComment = {
      value,
    };
    await this.commentsRepo.updateOnePlain(commentId, newComment);
    return this.commentsRepo.getOneById(commentId);
  }

  async removeComment(user: UserAuthInfo, commentId: number) {
    const comment = await this.commentsRepo.getOneByIdAndAuthorId(
      commentId,
      user.id,
    );
    return this.commentsRepo.softDeleteOne(comment);
  }

  private async openDiscussion(expenseCell: ExpenseCell) {
    await this.updateIsDiscussionActive(expenseCell, true);
  }

  async closeDiscussion(accountInstanceId: number, date: string) {
    const expenseCell = await this.getExpenseCellByAccountInstanceIdAndDate(
      accountInstanceId,
      date,
    );

    await this.updateIsDiscussionActive(expenseCell, false);
  }

  checkAvailabilityToMakeCommentsFor(user: UserAuthInfo) {
    this.checkAvailability(user.activeCompany?.config.areCommentsAvailable);
  }

  private checkAvailability(areCommentsAvailable: boolean) {
    if (!areCommentsAvailable)
      throw new BadRequestException(messages.comments.areNotAvailable);
  }

  private async getUser(userId: number) {
    return this.userRepo.getOneByIdWithAccessScopesCompanyAndAppSettings(
      userId,
    );
  }

  private async getExpenseCellByAccountInstanceIdAndDate(
    accountInstanceId: number,
    date: string,
  ) {
    const [year, month] = date.split(':');
    const expenseCell =
      await this.expenseCellRepo.getOneByAccountInstanceIdAndDate(
        accountInstanceId,
        +month,
        +year,
      );
    return expenseCell;
  }

  private async findOrCreateExpenseCell(message: NewCommentRequestDTO) {
    const [year, month] = message.date.split(':');
    const cell: NewEntity<ExpenseCell> = {
      month: +month,
      year: +year,
      accountInstanceId: message.accountInstanceId,
    };
    return this.expenseCellRepo.upsertOne(cell);
  }

  private async createOrUpdateComment(
    message: NewCommentRequestDTO,
    expenseCellId: number,
  ) {
    const newComment: PlainEntityWithoutId<Comment> = {
      expenseCellId,
      value: message.value,
      authorId: message.userId,
      commentType: message.commentType,
    };

    const wasUpdated = !!message.id;

    const commentFromDB = await (wasUpdated
      ? this.updateOne(message.id, message.value)
      : this.create(newComment));

    void this.mailUseCase.voidablePromise(
      this.mailUseCase.sendNotificationCommentCreatedOrUpdated(
        commentFromDB,
        wasUpdated,
      ),
    );

    return commentFromDB;
  }

  private async updateIsDiscussionActive(
    expenseCell: ExpenseCell,
    isDiscussionActive: boolean,
  ) {
    if (expenseCell.isDiscussionActive === isDiscussionActive) return;

    void this.mailUseCase.voidablePromise(
      this.mailUseCase.sendNotificationDiscussionClosedOrOpened(
        expenseCell.id,
        !isDiscussionActive,
      ),
    );
    return this.expenseCellRepo.updateOnePlain(expenseCell.id, {
      isDiscussionActive,
    });
  }
}
